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
        assert body["rate_limit"]["enabled"] is True
        assert body["rate_limit"]["limit"] > 0

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
