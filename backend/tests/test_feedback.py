"""Tests for the unified feedback endpoint and its Mongo store.

Mongo is stubbed via a fake collection so the suite stays fully offline
(matches the pattern in ``test_metrics.py``).
"""

from __future__ import annotations

import pytest

from api import feedback_store
from api.models import UserProfile


# ---------------------------------------------------------------------------
# Fake collection -- captures inserts in-memory
# ---------------------------------------------------------------------------
class _FakeCollection:
    def __init__(self):
        self.events: list[dict] = []

    def insert_one(self, doc):
        self.events.append(doc)


@pytest.fixture
def fake_store(monkeypatch):
    """Replace ``_get_collection`` with one fake collection per kind."""
    mood = _FakeCollection()
    track = _FakeCollection()

    def get(kind: str):
        if kind == feedback_store.MOOD_KIND:
            return mood
        if kind == feedback_store.TRACK_KIND:
            return track
        raise ValueError(kind)

    monkeypatch.setattr(feedback_store, "_get_collection", get)
    return {"mood": mood, "track": track}


@pytest.fixture(autouse=True)
def _reset_feedback_store():
    feedback_store.reset_for_tests()
    yield
    feedback_store.reset_for_tests()


# ---------------------------------------------------------------------------
# Store helpers
# ---------------------------------------------------------------------------
class TestStore:
    def test_insert_mood_writes_one_row(self, fake_store):
        feedback_store.insert_mood_feedback(
            username="alice",
            predicted="joy",
            actual="love",
            input_type="text",
            confidence=0.82,
            session_id="sess-1",
        )
        assert len(fake_store["mood"].events) == 1
        ev = fake_store["mood"].events[0]
        assert ev["meta"]["username"] == "alice"
        assert ev["meta"]["predicted"] == "joy"
        assert ev["meta"]["actual"] == "love"
        assert ev["meta"]["input_type"] == "text"
        assert ev["confidence"] == 0.82
        assert ev["session_id"] == "sess-1"
        assert "ts" in ev

    def test_insert_track_writes_one_row(self, fake_store):
        feedback_store.insert_track_feedback(
            username="alice",
            track_id="deezer:12345",
            signal="like",
            context_emotion="joy",
        )
        assert len(fake_store["track"].events) == 1
        ev = fake_store["track"].events[0]
        assert ev["meta"]["username"] == "alice"
        assert ev["meta"]["signal"] == "like"
        assert ev["meta"]["context_emotion"] == "joy"
        assert ev["track_id"] == "deezer:12345"

    def test_insert_silent_on_failure(self, monkeypatch):
        def boom(_kind):
            raise RuntimeError("simulated atlas outage")

        monkeypatch.setattr(feedback_store, "_get_collection", boom)
        # Must not raise.
        feedback_store.insert_mood_feedback(
            username="alice", predicted="joy", actual="love",
            input_type="text", confidence=None, session_id=None,
        )
        feedback_store.insert_track_feedback(
            username="alice", track_id="t1", signal="like",
            context_emotion=None,
        )

    def test_insert_noop_when_collection_unavailable(self, monkeypatch):
        monkeypatch.setattr(feedback_store, "_get_collection", lambda _kind: None)
        # No exception, no events written.
        feedback_store.insert_mood_feedback(
            username="alice", predicted="joy", actual="love",
            input_type="text", confidence=None, session_id=None,
        )

    def test_unknown_kind_rejected_at_store(self):
        # Programmer-error guard -- defence in depth for code that
        # bypasses the endpoint validator.
        with pytest.raises(ValueError):
            feedback_store._get_collection("garbage")


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------
URL = "/api/feedback/"


class TestEndpointAuth:
    def test_anonymous_request_is_rejected(self, api_client, fake_store):
        resp = api_client.post(
            URL,
            {"kind": "mood", "predicted": "joy", "actual": "love",
             "input_type": "text"},
            format="json",
        )
        assert resp.status_code == 401
        assert fake_store["mood"].events == []


class TestMoodEndpoint:
    def test_accepts_valid_mood_payload(self, auth_client, fake_store):
        resp = auth_client.post(
            URL,
            {
                "kind": "mood",
                "predicted": "joy",
                "actual": "love",
                "input_type": "text",
                "confidence": 0.82,
                "session_id": "sess-1",
            },
            format="json",
        )
        assert resp.status_code == 202
        # Event persisted.
        assert len(fake_store["mood"].events) == 1
        ev = fake_store["mood"].events[0]
        assert ev["meta"]["username"] == auth_client.user.username
        assert ev["meta"]["predicted"] == "joy"
        assert ev["meta"]["actual"] == "love"
        # Calibration bumped.
        profile = UserProfile.objects(username=auth_client.user.username).first()
        assert profile.mood_calibration == {"joy": {"love": 1}}

    def test_self_confirmation_does_not_bump_calibration(self, auth_client, fake_store):
        resp = auth_client.post(
            URL,
            {"kind": "mood", "predicted": "joy", "actual": "joy",
             "input_type": "text"},
            format="json",
        )
        assert resp.status_code == 202
        # Event still persisted (we want to track agreement frequency).
        assert len(fake_store["mood"].events) == 1
        # Calibration map untouched.
        profile = UserProfile.objects(username=auth_client.user.username).first()
        assert profile.mood_calibration == {}

    def test_calibration_accumulates_across_calls(self, auth_client, fake_store):
        for actual in ("love", "love", "anger"):
            resp = auth_client.post(
                URL,
                {"kind": "mood", "predicted": "joy", "actual": actual,
                 "input_type": "text"},
                format="json",
            )
            assert resp.status_code == 202

        profile = UserProfile.objects(username=auth_client.user.username).first()
        assert profile.mood_calibration == {"joy": {"love": 2, "anger": 1}}

    @pytest.mark.parametrize("bad_field, value, hint", [
        ("predicted", "happiness", "predicted"),
        ("actual", "joyy", "actual"),
        ("input_type", "video", "input_type"),
    ])
    def test_rejects_invalid_enum_values(self, auth_client, fake_store, bad_field, value, hint):
        payload = {
            "kind": "mood",
            "predicted": "joy",
            "actual": "love",
            "input_type": "text",
        }
        payload[bad_field] = value
        resp = auth_client.post(URL, payload, format="json")
        assert resp.status_code == 400
        assert hint in resp.data["error"]
        assert fake_store["mood"].events == []

    def test_rejects_out_of_range_confidence(self, auth_client, fake_store):
        resp = auth_client.post(
            URL,
            {"kind": "mood", "predicted": "joy", "actual": "love",
             "input_type": "text", "confidence": 1.5},
            format="json",
        )
        assert resp.status_code == 400
        assert "confidence" in resp.data["error"]

    def test_accepts_neutral_label(self, auth_client, fake_store):
        # Inference returns "neutral" on degrade -- the user must be
        # able to correct it to something real.
        resp = auth_client.post(
            URL,
            {"kind": "mood", "predicted": "neutral", "actual": "joy",
             "input_type": "speech"},
            format="json",
        )
        assert resp.status_code == 202


class TestTrackEndpoint:
    @pytest.mark.parametrize("signal", ["like", "unlike", "open_deezer"])
    def test_accepts_each_track_signal(self, auth_client, fake_store, signal):
        resp = auth_client.post(
            URL,
            {"kind": "track", "track_id": "deezer:1", "signal": signal,
             "context_emotion": "joy"},
            format="json",
        )
        assert resp.status_code == 202
        assert len(fake_store["track"].events) == 1
        assert fake_store["track"].events[0]["meta"]["signal"] == signal

    def test_rejects_unknown_signal(self, auth_client, fake_store):
        resp = auth_client.post(
            URL,
            {"kind": "track", "track_id": "deezer:1", "signal": "skip"},
            format="json",
        )
        assert resp.status_code == 400
        assert "signal" in resp.data["error"]
        assert fake_store["track"].events == []

    def test_rejects_missing_track_id(self, auth_client, fake_store):
        resp = auth_client.post(
            URL,
            {"kind": "track", "signal": "like"},
            format="json",
        )
        assert resp.status_code == 400
        assert "track_id" in resp.data["error"]

    def test_rejects_overlong_track_id(self, auth_client, fake_store):
        resp = auth_client.post(
            URL,
            {"kind": "track", "track_id": "x" * 200, "signal": "like"},
            format="json",
        )
        assert resp.status_code == 400

    def test_invalid_context_emotion_is_rejected(self, auth_client, fake_store):
        resp = auth_client.post(
            URL,
            {"kind": "track", "track_id": "deezer:1", "signal": "like",
             "context_emotion": "ecstatic"},
            format="json",
        )
        assert resp.status_code == 400
        assert "context_emotion" in resp.data["error"]


class TestDispatch:
    def test_rejects_unknown_kind(self, auth_client, fake_store):
        resp = auth_client.post(
            URL,
            {"kind": "fish", "predicted": "joy", "actual": "love",
             "input_type": "text"},
            format="json",
        )
        assert resp.status_code == 400
        assert "kind" in resp.data["error"]

    def test_rejects_missing_kind(self, auth_client, fake_store):
        resp = auth_client.post(URL, {}, format="json")
        assert resp.status_code == 400

    def test_track_payload_does_not_write_mood_collection(self, auth_client, fake_store):
        resp = auth_client.post(
            URL,
            {"kind": "track", "track_id": "deezer:1", "signal": "like"},
            format="json",
        )
        assert resp.status_code == 202
        assert fake_store["mood"].events == []
        assert len(fake_store["track"].events) == 1

    def test_mood_payload_does_not_write_track_collection(self, auth_client, fake_store):
        resp = auth_client.post(
            URL,
            {"kind": "mood", "predicted": "joy", "actual": "love",
             "input_type": "text"},
            format="json",
        )
        assert resp.status_code == 202
        assert fake_store["track"].events == []
        assert len(fake_store["mood"].events) == 1


class TestCalibrationResilience:
    """The persisted event must land even if calibration bump fails."""

    def test_persists_event_when_profile_missing(self, auth_client, fake_store, monkeypatch):
        # Drop the profile so the bump can't find it.
        UserProfile.objects(username=auth_client.user.username).delete()
        resp = auth_client.post(
            URL,
            {"kind": "mood", "predicted": "joy", "actual": "love",
             "input_type": "text"},
            format="json",
        )
        assert resp.status_code == 202
        assert len(fake_store["mood"].events) == 1


class _FakeAggCollection:
    """Captures the aggregate pipeline and returns canned rows."""

    def __init__(self, rows):
        self._rows = rows
        self.pipelines: list = []

    def aggregate(self, pipeline):
        self.pipelines.append(pipeline)
        return iter(self._rows)


class TestTrackFeedbackQuery:
    def test_maps_latest_signal_per_track(self, monkeypatch):
        coll = _FakeAggCollection([
            {"_id": "deezer:1", "signal": "like"},
            {"_id": "deezer:2", "signal": "unlike"},
        ])
        monkeypatch.setattr(feedback_store, "_get_collection", lambda _k: coll)
        out = feedback_store.query_track_feedback("alice", ["deezer:1", "deezer:2"])
        assert out == {"deezer:1": "like", "deezer:2": "unlike"}
        # Only explicit votes are queried -- never open_deezer.
        match = coll.pipelines[0][0]["$match"]
        assert set(match["meta.signal"]["$in"]) == {"like", "unlike"}

    def test_empty_ids_short_circuits(self, monkeypatch):
        def boom(_k):
            raise AssertionError("should not touch the collection")

        monkeypatch.setattr(feedback_store, "_get_collection", boom)
        assert feedback_store.query_track_feedback("alice", []) == {}

    def test_failure_returns_empty(self, monkeypatch):
        def boom(_k):
            raise RuntimeError("mongo down")

        monkeypatch.setattr(feedback_store, "_get_collection", boom)
        assert feedback_store.query_track_feedback("alice", ["deezer:1"]) == {}


class TestTrackFeedbackStateEndpoint:
    URL = "/api/feedback/tracks/"

    def test_anonymous_rejected(self, api_client):
        resp = api_client.get(f"{self.URL}?ids=deezer:1")
        assert resp.status_code in (401, 403)

    def test_returns_state_for_ids(self, auth_client, monkeypatch):
        captured = {}

        def fake_query(username, ids):
            captured["username"] = username
            captured["ids"] = list(ids)
            return {"deezer:1": "like"}

        monkeypatch.setattr(feedback_store, "query_track_feedback", fake_query)
        resp = auth_client.get(f"{self.URL}?ids=deezer:1,deezer:2")
        assert resp.status_code == 200
        assert resp.data["feedback"] == {"deezer:1": "like"}
        assert captured["ids"] == ["deezer:1", "deezer:2"]
        assert captured["username"] == auth_client.user.username

    def test_no_ids_returns_empty_without_querying(self, auth_client, monkeypatch):
        def boom(*_a, **_k):
            raise AssertionError("should not query when no ids")

        monkeypatch.setattr(feedback_store, "query_track_feedback", boom)
        resp = auth_client.get(self.URL)
        assert resp.status_code == 200
        assert resp.data["feedback"] == {}
