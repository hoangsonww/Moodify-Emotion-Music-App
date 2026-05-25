"""Tests for the Django backend SRE metrics layer.

Mirrors ``modal_inference/tests/test_metrics.py`` -- recorder, store,
middleware, and the ``/api/metrics/`` endpoint. Mongo is stubbed via a
fake collection so the suite stays fully offline.
"""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from observability import recorder as recorder_module
from observability import store as store_module
from observability.recorder import MetricsRecorder, _percentile


# ---------------- Percentile primitive --------------------------------
class TestPercentile:
    def test_empty(self):
        assert _percentile([], 95) == 0.0

    def test_single(self):
        assert _percentile([42.0], 99) == 42.0

    def test_known_quantiles(self):
        samples = list(range(1, 101))
        assert _percentile(samples, 50) == pytest.approx(50.5, abs=0.5)
        assert _percentile(samples, 95) == pytest.approx(95.05, abs=0.5)
        assert _percentile(samples, 99) == pytest.approx(99.01, abs=0.5)


# ---------------- Recorder -------------------------------------------
class TestRecorder:
    def test_starts_empty(self):
        r = MetricsRecorder()
        snap = r.snapshot()
        assert snap["endpoints"] == []
        assert snap["uptime_seconds"] >= 0

    def test_record_one_request(self):
        r = MetricsRecorder()
        r.record("/users/login/", "POST", 200, 42.0)
        snap = r.snapshot()
        assert len(snap["endpoints"]) == 1
        ep = snap["endpoints"][0]
        assert ep["endpoint"] == "/users/login/"
        assert ep["count"] == 1
        assert ep["error_count"] == 0
        assert ep["latency_ms"]["p50"] == 42.0

    def test_classify_errors(self):
        r = MetricsRecorder()
        for s in (200, 401, 404, 500, 502, 200):
            r.record("/x", "POST", s, 10.0)
        ep = r.snapshot()["endpoints"][0]
        assert ep["count"] == 6
        assert ep["error_count"] == 4
        assert ep["error_rate"] == pytest.approx(4 / 6, abs=1e-3)

    def test_record_never_raises(self):
        r = MetricsRecorder()
        r.record(endpoint=None, method=None, status="bad", latency_ms="oops")
        r.snapshot()

    def test_per_endpoint_isolation(self):
        r = MetricsRecorder()
        r.record("/users/login/", "POST", 200, 1)
        r.record("/users/register/", "POST", 400, 2)
        eps = {e["endpoint"]: e for e in r.snapshot()["endpoints"]}
        assert eps["/users/login/"]["error_count"] == 0
        assert eps["/users/register/"]["error_count"] == 1


# ---------------- Store (stubbed Mongo) -------------------------------
class _FakeCollection:
    def __init__(self):
        self.events: list[dict] = []

    def insert_one(self, doc):
        self.events.append(doc)

    def aggregate(self, pipeline, allowDiskUse=False):  # noqa: N803
        match = pipeline[0]["$match"]
        rows: dict[tuple, dict] = {}
        for ev in self.events:
            if ev["meta"]["service"] != match["meta.service"]:
                continue
            if ev["ts"] < match["ts"]["$gte"]:
                continue
            if "meta.endpoint" in match and ev["meta"]["endpoint"] != match["meta.endpoint"]:
                continue
            key = (ev["meta"]["endpoint"], ev["meta"]["method"])
            row = rows.setdefault(key, {
                "_id": {"endpoint": key[0], "method": key[1]},
                "count": 0, "errors_4xx": 0, "errors_5xx": 0,
                "latencies": [], "status_codes": [],
            })
            row["count"] += 1
            if ev["meta"]["status_class"] == "4xx":
                row["errors_4xx"] += 1
            if ev["meta"]["status_class"] == "5xx":
                row["errors_5xx"] += 1
            row["latencies"].append(ev["latency_ms"])
            row["status_codes"].append(ev["status"])
        return list(rows.values())


@pytest.fixture
def fake_store(monkeypatch, settings):
    """Stub Mongo + force METRICS_ENABLED=True for the test.

    The local dev `.env` sometimes sets `METRICS_ENABLED=False` so a
    dev's request path doesn't touch the metrics store; that override
    leaks into the test process via `decouple.config()` and the
    middleware would then short-circuit, leaving the fake collection
    empty. Pin the setting to True for the lifetime of this fixture
    so the middleware always writes when the test expects it to.
    """
    settings.METRICS_ENABLED = True
    coll = _FakeCollection()
    monkeypatch.setattr(store_module, "_get_collection", lambda: coll)
    return coll


@pytest.fixture(autouse=True)
def _reset_recorder():
    recorder_module.reset_recorder()
    store_module.reset_for_tests()
    yield
    recorder_module.reset_recorder()
    store_module.reset_for_tests()


class TestStore:
    def test_insert_writes_one_row(self, fake_store):
        store_module.insert_event(
            endpoint="/users/login/", method="POST", status=200,
            latency_ms=42.0, container_id="c1",
        )
        assert len(fake_store.events) == 1
        ev = fake_store.events[0]
        assert ev["meta"]["service"] == "django"
        assert ev["meta"]["status_class"] == "2xx"
        assert ev["latency_ms"] == 42.0

    def test_insert_silent_on_failure(self, monkeypatch):
        def boom():
            raise RuntimeError("simulated atlas outage")
        monkeypatch.setattr(store_module, "_get_collection", boom)
        # Must not raise.
        store_module.insert_event(
            endpoint="/x", method="GET", status=200, latency_ms=1, container_id="c"
        )

    def test_aggregate_groups_by_endpoint(self, fake_store):
        for status, lat in [(200, 100), (200, 150), (500, 800)]:
            store_module.insert_event(
                endpoint="/users/login/", method="POST", status=status,
                latency_ms=lat, container_id="c1",
            )
        result = store_module.aggregate_window(window="1h")
        login = next(e for e in result["endpoints"] if e["endpoint"] == "/users/login/")
        assert login["count"] == 3
        assert login["error_count"] == 1
        assert login["latency_ms"]["p50"] == pytest.approx(150, abs=1)
        assert login["latency_ms"]["p99"] >= 700
        assert login["status_codes"] == {"200": 2, "500": 1}

    def test_aggregate_unavailable_when_no_store(self, monkeypatch):
        monkeypatch.setattr(store_module, "_get_collection", lambda: None)
        result = store_module.aggregate_window(window="1h")
        assert result["available"] is False
        assert result["endpoints"] == []


# ---------------- Middleware end-to-end through the Django test client
class TestMiddlewareIntegration:
    """Drive the live middleware via APIClient against a real Django URL."""

    def test_health_call_is_recorded_live_but_not_persisted(self, fake_store):
        client = APIClient()
        r = client.get("/api/health/")
        assert r.status_code == 200
        # /api/health is on the skip list -- no persisted event.
        assert not any(
            ev["meta"]["endpoint"].startswith("/api/health") for ev in fake_store.events
        )

    def test_real_endpoint_is_persisted(self, fake_store):
        client = APIClient()
        # /users/register/ with bad data -> 400, but recorded.
        r = client.post("/users/register/", {}, format="json")
        assert r.status_code in (400, 401)
        # We persisted at least one row for /users/register/.
        assert any(
            ev["meta"]["endpoint"].startswith("/users/register")
            for ev in fake_store.events
        ), f"events: {[e['meta']['endpoint'] for e in fake_store.events]}"

    def test_path_collapses_to_route_template(self, fake_store):
        """High-cardinality path params (/users/<id>/...) collapse to
        the route template so we don't blow up the time-series."""
        client = APIClient()
        # Hit one user-id-bearing endpoint twice with different ids.
        client.get("/users/recommendations/get/abc123/")
        client.get("/users/recommendations/get/xyz789/")
        endpoints = {ev["meta"]["endpoint"] for ev in fake_store.events}
        # Both calls collapsed to the same key -- not two distinct buckets.
        recs = [e for e in endpoints if "recommendations/get" in e]
        assert len(recs) == 1


# ---------------- /api/metrics/ endpoint ------------------------------
_ADMIN = "test-admin-token"


@pytest.fixture
def admin_settings(settings):
    """Apply admin-only auth knobs for /api/metrics/ tests."""
    settings.ADMIN_METRICS_TOKEN = _ADMIN
    settings.MODAL_SERVICE_TOKEN = ""
    return settings


class TestMetricsEndpoint:
    def test_requires_admin_token(self, fake_store, admin_settings):
        client = APIClient()
        r = client.get("/api/metrics/")
        assert r.status_code == 401

    def test_rejects_wrong_token(self, fake_store, admin_settings):
        client = APIClient()
        r = client.get("/api/metrics/", HTTP_AUTHORIZATION="Bearer not-the-admin")
        assert r.status_code == 401

    def test_returns_live_and_persisted(self, fake_store, admin_settings):
        client = APIClient()
        # Generate one persisted event.
        client.post("/users/register/", {}, format="json")
        r = client.get(
            "/api/metrics/?window=1h",
            HTTP_AUTHORIZATION=f"Bearer {_ADMIN}",
        )
        assert r.status_code == 200
        body = r.json()
        assert body["service"] == "django"
        assert "live" in body
        assert "persisted" in body
        assert body["persisted"]["available"] is True

    def test_metrics_endpoint_is_not_self_recorded(self, fake_store, admin_settings):
        client = APIClient()
        client.get("/api/metrics/", HTTP_AUTHORIZATION=f"Bearer {_ADMIN}")
        # /api/metrics/ is on the middleware skip list.
        assert not any(
            ev["meta"]["endpoint"].startswith("/api/metrics") for ev in fake_store.events
        )
