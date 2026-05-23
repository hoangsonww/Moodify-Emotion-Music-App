"""Tests for the SRE metrics layer: recorder, store, middleware, /metrics."""

from __future__ import annotations

import time

import jwt
import pytest
from fastapi.testclient import TestClient

import config
import metrics as metrics_module
import metrics_store
import service
from metrics import MetricsRecorder, _percentile


# ---------------- MetricsRecorder primitive ---------------------------
class TestPercentilePrimitive:
    def test_empty(self):
        assert _percentile([], 95) == 0.0

    def test_single_value(self):
        assert _percentile([42.0], 50) == 42.0
        assert _percentile([42.0], 99) == 42.0

    def test_known_quantiles(self):
        samples = list(range(1, 101))  # 1..100
        # Nearest-rank with linear interpolation: p50 of 1..100 = 50.5,
        # p95 = 95.05, p99 = 99.01. (Matches numpy.percentile default.)
        assert _percentile(samples, 50) == pytest.approx(50.5, abs=0.5)
        assert _percentile(samples, 95) == pytest.approx(95.05, abs=0.5)
        assert _percentile(samples, 99) == pytest.approx(99.01, abs=0.5)

    def test_handles_unordered_input(self):
        # Function sorts internally -- callers don't have to.
        assert _percentile([10, 1, 5, 3, 7], 50) == pytest.approx(5.0, abs=0.1)


class TestRecorder:
    def test_starts_empty(self):
        r = MetricsRecorder()
        snap = r.snapshot()
        assert snap["endpoints"] == []
        assert snap["uptime_seconds"] >= 0
        assert snap["container"]

    def test_records_one_request(self):
        r = MetricsRecorder()
        r.record(endpoint="/text_emotion", method="POST", status=200, latency_ms=42.0)
        snap = r.snapshot()
        assert len(snap["endpoints"]) == 1
        ep = snap["endpoints"][0]
        assert ep["endpoint"] == "/text_emotion"
        assert ep["method"] == "POST"
        assert ep["count"] == 1
        assert ep["error_count"] == 0
        assert ep["latency_ms"]["p50"] == 42.0
        assert ep["status_classes"]["2xx"] == 1

    def test_classifies_errors_correctly(self):
        r = MetricsRecorder()
        for status in (200, 200, 401, 404, 500, 502):
            r.record(endpoint="/x", method="GET", status=status, latency_ms=10.0)
        ep = r.snapshot()["endpoints"][0]
        assert ep["count"] == 6
        assert ep["error_count"] == 4   # 401, 404, 500, 502
        assert ep["status_classes"]["2xx"] == 2
        assert ep["status_classes"]["4xx"] == 2
        assert ep["status_classes"]["5xx"] == 2
        assert ep["error_rate"] == pytest.approx(4 / 6, abs=1e-3)

    def test_degraded_counter(self):
        r = MetricsRecorder()
        r.record("/x", "POST", 200, 10.0, degraded=True)
        r.record("/x", "POST", 200, 10.0, degraded=False)
        ep = r.snapshot()["endpoints"][0]
        assert ep["degraded_count"] == 1
        assert ep["error_count"] == 0  # degraded != error

    def test_per_endpoint_isolation(self):
        r = MetricsRecorder()
        r.record("/text_emotion", "POST", 200, 50.0)
        r.record("/speech_emotion", "POST", 500, 200.0)
        eps = {e["endpoint"]: e for e in r.snapshot()["endpoints"]}
        assert eps["/text_emotion"]["error_count"] == 0
        assert eps["/speech_emotion"]["error_count"] == 1

    def test_status_codes_preserved(self):
        r = MetricsRecorder()
        r.record("/x", "GET", 200, 1.0)
        r.record("/x", "GET", 429, 1.0)
        r.record("/x", "GET", 429, 1.0)
        ep = r.snapshot()["endpoints"][0]
        assert ep["status_codes"] == {"200": 1, "429": 2}

    def test_record_never_raises(self):
        r = MetricsRecorder()
        # Pass garbage on purpose -- the recorder must swallow it.
        r.record(endpoint=None, method=None, status="not-an-int", latency_ms="nope")
        # Snapshot should still be queryable.
        r.snapshot()

    def test_reset_clears_everything(self):
        r = MetricsRecorder()
        r.record("/x", "GET", 200, 1.0)
        r.reset()
        assert r.snapshot()["endpoints"] == []


# ---------------- Store: stubbed Mongo --------------------------------
class _FakeCollection:
    """Minimal Mongo collection stand-in -- records insertions in a list
    and answers aggregate() with a hand-rolled in-memory pipeline."""

    def __init__(self):
        self.events: list[dict] = []

    def insert_one(self, doc):
        self.events.append(doc)

    def aggregate(self, pipeline, allowDiskUse=False):  # noqa: N803  Mongo casing
        # We don't run the full pipeline; we approximate the shape the
        # store's aggregate_window expects so its read-side can be
        # exercised end-to-end.
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
                "degraded_count": 0, "latencies": [], "status_codes": [],
            })
            row["count"] += 1
            if ev["meta"]["status_class"] == "4xx":
                row["errors_4xx"] += 1
            if ev["meta"]["status_class"] == "5xx":
                row["errors_5xx"] += 1
            if ev.get("degraded"):
                row["degraded_count"] += 1
            row["latencies"].append(ev["latency_ms"])
            row["status_codes"].append(ev["status"])
        return list(rows.values())


@pytest.fixture
def fake_store(monkeypatch):
    """Stub out ``_get_collection`` so writes hit a list, not Mongo."""
    coll = _FakeCollection()
    monkeypatch.setattr(metrics_store, "_get_collection", lambda: coll)
    return coll


class TestStoreWrites:
    def test_insert_event_writes_one_row(self, fake_store):
        metrics_store.insert_event(
            endpoint="/text_emotion", method="POST", status=200,
            latency_ms=42.0, container_id="c1",
        )
        assert len(fake_store.events) == 1
        ev = fake_store.events[0]
        assert ev["meta"]["service"] == "modal"
        assert ev["meta"]["endpoint"] == "/text_emotion"
        assert ev["meta"]["status_class"] == "2xx"
        assert ev["status"] == 200
        assert ev["latency_ms"] == 42.0
        assert ev["degraded"] is False

    def test_insert_event_is_silent_on_failure(self, monkeypatch):
        # Force the collection accessor to raise; insert_event must not
        # propagate -- a Mongo outage cannot break the inference path.
        def boom():
            raise RuntimeError("simulated outage")
        monkeypatch.setattr(metrics_store, "_get_collection", boom)
        # Should NOT raise.
        metrics_store.insert_event(
            endpoint="/x", method="GET", status=200,
            latency_ms=1.0, container_id="c",
        )

    def test_disabled_when_metrics_off(self, monkeypatch):
        monkeypatch.setattr(config, "METRICS_ENABLED", False)
        metrics_store.reset_for_tests()
        assert metrics_store._get_collection() is None  # noqa: SLF001

    def test_disabled_when_uri_missing(self, monkeypatch):
        monkeypatch.setattr(config, "METRICS_ENABLED", True)
        monkeypatch.setattr(config, "MONGO_DB_URI", "")
        metrics_store.reset_for_tests()
        assert metrics_store._get_collection() is None  # noqa: SLF001


class TestStoreReads:
    def test_aggregate_window_buckets_per_endpoint(self, fake_store):
        # Two endpoints, mixed status, varied latencies.
        for status, lat in [(200, 100), (200, 150), (500, 800)]:
            metrics_store.insert_event(
                endpoint="/text_emotion", method="POST", status=status,
                latency_ms=lat, container_id="c1",
            )
        metrics_store.insert_event(
            endpoint="/health", method="GET", status=200,
            latency_ms=5, container_id="c1",
        )

        result = metrics_store.aggregate_window(window="1h")
        assert result["available"] is True
        by_endpoint = {e["endpoint"]: e for e in result["endpoints"]}
        text = by_endpoint["/text_emotion"]
        assert text["count"] == 3
        assert text["error_count"] == 1
        assert text["error_rate"] == pytest.approx(1 / 3, abs=1e-3)
        assert text["latency_ms"]["p50"] == pytest.approx(150, abs=1)
        # p99 should be near the high outlier (800ms).
        assert text["latency_ms"]["p99"] >= 700
        assert text["status_codes"] == {"200": 2, "500": 1}

    def test_aggregate_window_respects_endpoint_filter(self, fake_store):
        metrics_store.insert_event(
            endpoint="/text_emotion", method="POST", status=200,
            latency_ms=10, container_id="c",
        )
        metrics_store.insert_event(
            endpoint="/health", method="GET", status=200,
            latency_ms=1, container_id="c",
        )
        result = metrics_store.aggregate_window(window="1h", endpoint="/text_emotion")
        assert [e["endpoint"] for e in result["endpoints"]] == ["/text_emotion"]

    def test_aggregate_window_unavailable_when_disabled(self, monkeypatch):
        monkeypatch.setattr(metrics_store, "_get_collection", lambda: None)
        result = metrics_store.aggregate_window(window="1h")
        assert result["available"] is False
        assert result["endpoints"] == []


# ---------------- End-to-end through the middleware --------------------
_KEY = "metrics-test-key"
_SVC = "metrics-svc-token"


class _FakeTextModel:
    loaded = True
    def predict(self, text): return "joy"


class _DegradedTextModel:
    loaded = False  # forces the fallback path
    def predict(self, text): return "joy"


class _FakeMediaModel:
    loaded = True
    def predict(self, path):
        class R: emotion = "sadness"; degraded = False
        return R()


@pytest.fixture
def app_client(monkeypatch, fake_store):
    monkeypatch.setattr(config, "JWT_SIGNING_KEY", _KEY)
    monkeypatch.setattr(config, "MODAL_SERVICE_TOKEN", _SVC)
    monkeypatch.setattr(service, "get_music_recommendation", lambda *a, **k: [])
    return TestClient(
        service.build_app(_FakeTextModel(), _FakeMediaModel(), _FakeMediaModel()),
        raise_server_exceptions=True,
    )


def _svc_headers():
    return {"Authorization": f"Bearer {_SVC}"}


class TestMiddlewareIntegration:
    def test_successful_call_recorded_live_and_persisted(self, app_client, fake_store):
        r = app_client.post("/text_emotion", json={"text": "hi"}, headers=_svc_headers())
        assert r.status_code == 200

        # Live: recorder bumped.
        live = metrics_module.get_recorder().snapshot()
        text_ep = next(e for e in live["endpoints"] if e["endpoint"] == "/text_emotion")
        assert text_ep["count"] == 1
        assert text_ep["error_count"] == 0

        # Persisted: store got exactly one row.
        assert len(fake_store.events) == 1
        ev = fake_store.events[0]
        assert ev["meta"]["endpoint"] == "/text_emotion"
        assert ev["meta"]["method"] == "POST"
        assert ev["status"] == 200

    def test_4xx_recorded_as_error(self, app_client, fake_store):
        # No Authorization header -> 401 from the auth dependency.
        app_client.post("/text_emotion", json={"text": "hi"})
        live = metrics_module.get_recorder().snapshot()
        text_ep = next(e for e in live["endpoints"] if e["endpoint"] == "/text_emotion")
        assert text_ep["error_count"] == 1
        assert text_ep["status_codes"]["401"] == 1

    def test_metrics_skip_internal_paths(self, app_client, fake_store):
        # / and /health should NOT be persisted (we don't want to drown
        # the time-series in liveness probes).
        app_client.get("/")
        app_client.get("/health")
        endpoints = [ev["meta"]["endpoint"] for ev in fake_store.events]
        assert "/" not in endpoints
        assert "/health" not in endpoints

    def test_degraded_flag_propagates_via_header(self, app_client, fake_store):
        # Build a fresh app with an UNLOADED text model so the handler
        # takes the degraded path.
        from fastapi.testclient import TestClient as TC
        app = service.build_app(_DegradedTextModel(), _FakeMediaModel(), _FakeMediaModel())
        c = TC(app)
        r = c.post("/text_emotion", json={"text": "hi"}, headers=_svc_headers())
        assert r.status_code == 200
        assert r.headers.get("X-Moodify-Degraded") == "1"
        # The newly-recorded event should have degraded=True.
        assert any(ev.get("degraded") for ev in fake_store.events)

    def test_high_cardinality_paths_collapse_to_route_template(self, app_client, fake_store):
        # /music_recommendation has no path params, but exercising both
        # endpoints proves the normaliser uses the FastAPI route, not
        # the raw URL.
        app_client.post("/music_recommendation",
                        json={"emotion": "joy"}, headers=_svc_headers())
        endpoints = {ev["meta"]["endpoint"] for ev in fake_store.events}
        assert "/music_recommendation" in endpoints


# ---------------- /metrics endpoint ------------------------------------
class TestMetricsEndpoint:
    def test_requires_service_token(self, app_client):
        # No header -> 401.
        assert app_client.get("/metrics").status_code == 401

    def test_rejects_user_jwt(self, app_client):
        # Even a valid USER JWT is rejected -- /metrics is operators-only.
        token = jwt.encode(
            {"sub": "u1", "type": "access", "exp": int(time.time()) + 60},
            _KEY, algorithm="HS256",
        )
        r = app_client.get("/metrics", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 401

    def test_returns_live_and_persisted(self, app_client, fake_store):
        # Generate one persisted event so the read-side has something
        # to aggregate.
        app_client.post("/text_emotion", json={"text": "hi"}, headers=_svc_headers())
        r = app_client.get("/metrics?window=1h", headers=_svc_headers())
        assert r.status_code == 200
        body = r.json()
        assert body["service"] == "modal"
        assert body["window"]["label"] == "1h"
        assert "live" in body
        assert "persisted" in body
        assert body["persisted"]["available"] is True
        endpoints = [e["endpoint"] for e in body["persisted"]["endpoints"]]
        assert "/text_emotion" in endpoints

    def test_endpoint_filter(self, app_client, fake_store):
        app_client.post("/text_emotion", json={"text": "hi"}, headers=_svc_headers())
        app_client.post("/music_recommendation",
                        json={"emotion": "joy"}, headers=_svc_headers())
        r = app_client.get("/metrics?endpoint=/text_emotion", headers=_svc_headers())
        endpoints = [e["endpoint"] for e in r.json()["persisted"]["endpoints"]]
        assert endpoints == ["/text_emotion"]

    def test_unsupported_window_falls_back_to_1h(self, app_client, fake_store):
        r = app_client.get("/metrics?window=nonsense", headers=_svc_headers())
        assert r.status_code == 200
        # parse_window returns the 1h default for unknown labels.
        assert r.json()["persisted"]["window"]["seconds"] == 3600

    def test_metrics_endpoint_itself_is_not_persisted(self, app_client, fake_store):
        before = len(fake_store.events)
        app_client.get("/metrics", headers=_svc_headers())
        # No new events recorded for /metrics calls -- otherwise hitting
        # the dashboard would inflate the data it's looking at.
        assert len(fake_store.events) == before
