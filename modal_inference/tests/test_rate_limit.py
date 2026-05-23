"""Tests for the SlidingWindowLimiter primitive and its wiring into the API."""

import time

import jwt
import pytest
from fastapi.testclient import TestClient

import config
import service
from rate_limit import SlidingWindowLimiter, caller_key


# ---------------- SlidingWindowLimiter primitive ----------------------
class TestSlidingWindowPrimitive:
    def test_allows_under_limit(self):
        rl = SlidingWindowLimiter(limit=3, window=60)
        for _ in range(3):
            assert rl.check("k").allowed is True

    def test_blocks_after_limit(self):
        rl = SlidingWindowLimiter(limit=3, window=60)
        for _ in range(3):
            assert rl.check("k").allowed is True
        d = rl.check("k")
        assert d.allowed is False
        assert d.retry_after > 0
        assert d.current == 3

    def test_window_slides_forward(self, monkeypatch):
        now = [1000.0]
        monkeypatch.setattr("rate_limit.time.monotonic", lambda: now[0])
        rl = SlidingWindowLimiter(limit=2, window=10)
        assert rl.check("k").allowed is True
        assert rl.check("k").allowed is True
        assert rl.check("k").allowed is False
        # Advance past the window -- earlier timestamps fall off.
        now[0] += 11
        assert rl.check("k").allowed is True

    def test_separate_keys_have_separate_buckets(self):
        rl = SlidingWindowLimiter(limit=1, window=60)
        assert rl.check("a").allowed is True
        assert rl.check("b").allowed is True
        assert rl.check("a").allowed is False
        assert rl.check("b").allowed is False

    def test_decision_headers_on_allow(self):
        rl = SlidingWindowLimiter(limit=5, window=60)
        d = rl.check("k")
        headers = d.as_headers()
        assert headers["X-RateLimit-Limit"] == "5"
        assert headers["X-RateLimit-Remaining"] == "4"
        assert "Retry-After" not in headers

    def test_decision_headers_on_block(self):
        rl = SlidingWindowLimiter(limit=1, window=60)
        rl.check("k")
        d = rl.check("k")
        headers = d.as_headers()
        assert headers["X-RateLimit-Limit"] == "1"
        assert headers["X-RateLimit-Remaining"] == "0"
        # Retry-After must round UP so the client doesn't bounce off again.
        assert int(headers["Retry-After"]) >= 1

    def test_max_keys_eviction(self):
        rl = SlidingWindowLimiter(limit=10, window=60, max_keys=2)
        rl.check("a")
        rl.check("b")
        rl.check("c")  # should evict "a" (oldest)
        assert rl.stats()["tracked_keys"] == 2

    def test_stats_counts_allow_and_block(self):
        rl = SlidingWindowLimiter(limit=1, window=60)
        rl.check("k")          # allow
        rl.check("k")          # block
        rl.check("other")      # allow
        stats = rl.stats()
        assert stats["allowed"] == 2
        assert stats["blocked"] == 1
        assert stats["block_ratio"] == pytest.approx(1 / 3, abs=1e-3)

    def test_clear_resets_buckets(self):
        rl = SlidingWindowLimiter(limit=1, window=60)
        rl.check("k")
        assert rl.check("k").allowed is False
        rl.clear()
        assert rl.check("k").allowed is True

    def test_invalid_args(self):
        with pytest.raises(ValueError):
            SlidingWindowLimiter(limit=0, window=60)
        with pytest.raises(ValueError):
            SlidingWindowLimiter(limit=1, window=0)
        with pytest.raises(ValueError):
            SlidingWindowLimiter(limit=1, window=1, max_keys=0)


# ---------------- caller_key -----------------------------------------
class TestCallerKey:
    def test_service_token_returns_none(self):
        assert caller_key({"kind": "service"}) is None

    def test_user_keyed_by_sub(self):
        key = caller_key({"kind": "user", "claims": {"sub": "abc"}})
        assert key == "user:abc"

    def test_user_keyed_by_user_id_when_no_sub(self):
        key = caller_key({"kind": "user", "claims": {"user_id": "42"}})
        assert key == "user:42"

    def test_user_without_sub_still_keys_consistently(self):
        ctx = {"kind": "user", "claims": {"email": "x@example.com"}}
        assert caller_key(ctx) == caller_key(ctx)

    def test_empty_ctx_returns_none(self):
        assert caller_key({}) is None
        assert caller_key(None) is None

    def test_user_with_list_claims_does_not_crash(self):
        """Regression: claims containing list/dict values used to raise
        TypeError from the builtin hash() of an unhashable tuple."""
        ctx = {
            "kind": "user",
            "claims": {
                "roles": ["admin", "user"],
                "permissions": {"can_post": True},
                "email": "x@example.com",
            },
        }
        key = caller_key(ctx)
        assert isinstance(key, str)
        assert key.startswith("jwt:")
        # Same claims hash to the same key across calls (stable).
        assert caller_key(ctx) == key

    def test_user_with_sub_is_preferred_over_claim_hash(self):
        """Even when other claims exist, ``sub`` takes precedence."""
        with_sub = caller_key({"kind": "user", "claims": {"sub": "u1", "roles": ["a"]}})
        without_sub = caller_key({"kind": "user", "claims": {"roles": ["a"]}})
        assert with_sub == "user:u1"
        assert with_sub != without_sub


# ---------------- end-to-end via TestClient ---------------------------
_KEY = "test-jwt-key"
_SERVICE_TOKEN = "service-secret"


class _FakeText:
    loaded = True

    def predict(self, text):
        return "joy"


@pytest.fixture
def app_client(monkeypatch):
    monkeypatch.setattr(config, "JWT_SIGNING_KEY", _KEY)
    monkeypatch.setattr(config, "MODAL_SERVICE_TOKEN", _SERVICE_TOKEN)
    monkeypatch.setattr(service, "get_music_recommendation", lambda *a, **k: [])
    return TestClient(
        service.build_app(_FakeText(), _FakeText(), _FakeText()),
        raise_server_exceptions=True,
    )


def _user_token(sub="u1"):
    return jwt.encode(
        {"sub": sub, "type": "access", "exp": int(time.time()) + 60},
        _KEY,
        algorithm="HS256",
    )


class TestEndToEndRateLimit:
    def test_user_jwt_returns_rate_limit_headers(self, app_client, monkeypatch):
        # Lower the limit so this test is cheap.
        service.get_rate_limiter()._limit = 5  # noqa: SLF001
        token = _user_token("rateA")
        resp = app_client.post(
            "/text_emotion",
            json={"text": "hi"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.headers["X-RateLimit-Limit"] == "5"
        assert resp.headers["X-RateLimit-Remaining"] == "4"

    def test_user_jwt_429_after_exhausting_window(self, app_client):
        service.get_rate_limiter()._limit = 3  # noqa: SLF001
        token = _user_token("burst")
        for _ in range(3):
            r = app_client.post(
                "/text_emotion",
                json={"text": "hi"},
                headers={"Authorization": f"Bearer {token}"},
            )
            assert r.status_code == 200
        # 4th request is over the limit.
        r = app_client.post(
            "/text_emotion",
            json={"text": "hi"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 429
        assert "Retry-After" in r.headers
        assert int(r.headers["Retry-After"]) >= 1

    def test_separate_users_have_separate_budgets(self, app_client):
        service.get_rate_limiter()._limit = 1  # noqa: SLF001
        for sub in ("alice", "bob"):
            token = _user_token(sub)
            r = app_client.post(
                "/text_emotion",
                json={"text": "hi"},
                headers={"Authorization": f"Bearer {token}"},
            )
            assert r.status_code == 200, f"first call from {sub} must succeed"

    def test_service_token_bypasses_limit(self, app_client):
        service.get_rate_limiter()._limit = 2  # noqa: SLF001
        # Even after 5 service-token calls, none are blocked.
        for _ in range(5):
            r = app_client.post(
                "/text_emotion",
                json={"text": "hi"},
                headers={"Authorization": f"Bearer {_SERVICE_TOKEN}"},
            )
            assert r.status_code == 200
        # No headers added for service-token callers (key was None).
        assert "X-RateLimit-Remaining" not in r.headers

    def test_health_is_not_rate_limited(self, app_client):
        # Hit /health far above the user limit -- it must always pass.
        service.get_rate_limiter()._limit = 1  # noqa: SLF001
        for _ in range(10):
            r = app_client.get("/health")
            assert r.status_code == 200

    def test_health_reports_cache_and_rate_limit(self, app_client):
        body = app_client.get("/health").json()
        assert "caches" in body
        assert "text_emotion" in body["caches"]
        assert "deezer_search" in body["caches"]
        assert "speech_emotion" in body["caches"]
        assert "facial_emotion" in body["caches"]
        assert body["rate_limit"]["enabled"] is True
        # Both tiers are reported so dashboards can show each independently.
        assert body["rate_limit"]["general"]["limit"] > 0
        assert body["rate_limit"]["media"]["limit"] > 0
        # /health must not be cached by intermediaries.
        resp = app_client.get("/health")
        assert resp.headers.get("Cache-Control") == "no-store"

    def test_rate_limit_disabled_bypasses_entirely(self, app_client, monkeypatch):
        monkeypatch.setattr(config, "RATE_LIMIT_ENABLED", False)
        service.get_rate_limiter()._limit = 1  # noqa: SLF001
        token = _user_token("nolimit")
        for _ in range(5):
            r = app_client.post(
                "/text_emotion",
                json={"text": "hi"},
                headers={"Authorization": f"Bearer {token}"},
            )
            assert r.status_code == 200


class TestMediaRateLimit:
    """Media endpoints use a separate, tighter limit."""

    def test_media_limit_is_independent_from_general(self, app_client):
        """Exhausting the media budget does NOT block /text_emotion."""
        service.get_media_rate_limiter()._limit = 2  # noqa: SLF001
        service.get_rate_limiter()._limit = 10       # noqa: SLF001
        token = _user_token("split")
        headers = {"Authorization": f"Bearer {token}"}
        for _ in range(2):
            r = app_client.post(
                "/speech_emotion",
                files={"file": ("a.wav", b"unique-blob-" + str(_).encode(), "audio/wav")},
                headers=headers,
            )
            assert r.status_code == 200
        # 3rd media call -> blocked
        r = app_client.post(
            "/speech_emotion",
            files={"file": ("a.wav", b"unique-blob-Z", "audio/wav")},
            headers=headers,
        )
        assert r.status_code == 429
        # But /text_emotion still works on the general budget.
        r = app_client.post("/text_emotion", json={"text": "hi"}, headers=headers)
        assert r.status_code == 200

    def test_content_length_too_large_returns_413(self, app_client, monkeypatch):
        """The Content-Length precheck rejects oversized uploads early
        (before the body is buffered)."""
        monkeypatch.setattr(service, "MAX_UPLOAD_BYTES", 50)
        r = app_client.post(
            "/speech_emotion",
            files={"file": ("a.wav", b"x" * 500, "audio/wav")},
            headers={"Authorization": f"Bearer {_SERVICE_TOKEN}"},
        )
        assert r.status_code == 413


class TestHealthRobustness:
    """``/health`` must never return a 5xx even if a sub-system is broken."""

    def test_health_degrades_when_stats_raises(self, app_client, monkeypatch):
        # Force one cache's .stats() to raise.
        from inference import text_emotion as te
        monkeypatch.setattr(
            te.get_cache(),
            "stats",
            lambda: (_ for _ in ()).throw(RuntimeError("boom")),
        )
        resp = app_client.get("/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "degraded"
        assert body["caches"]["text_emotion"] == {"error": "RuntimeError"}
        # Other caches still reported normally.
        assert "size" in body["caches"]["deezer_search"]

    def test_health_sets_no_store_cache_control(self, app_client):
        resp = app_client.get("/health")
        assert resp.headers.get("Cache-Control") == "no-store"
