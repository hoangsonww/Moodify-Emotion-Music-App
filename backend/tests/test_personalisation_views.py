"""Integration tests for personalisation wiring in api/views.py.

Covers the points where calibration + bandit hook into the proxied
text_emotion and music_recommendation views. The Modal calls are
stubbed by the autouse ``mock_inference`` fixture in conftest.

The contract is "augmentation, not replacement":

* Anonymous callers must see the rule-based output untouched.
* Authenticated cold-start users must also see untouched output.
* Authenticated warm users must see calibration / bandit effects.
"""

from __future__ import annotations

import pytest

from api import bandit, views
from api import track_features as tf
from api.calibration import CALIBRATION_THRESHOLD
from api.models import UserProfile


URL_TEXT = "/api/text_emotion/"
URL_MUSIC = "/api/music_recommendation/"


# ---------------------------------------------------------------------------
# Mood calibration in /api/text_emotion/
# ---------------------------------------------------------------------------
class TestTextEmotionCalibration:
    def test_anon_caller_gets_raw_emotion(self, api_client, monkeypatch):
        monkeypatch.setattr(
            views,
            "modal_text",
            lambda text: {"emotion": "joy", "recommendations": []},
        )
        resp = api_client.post(URL_TEXT, {"text": "hi"}, format="json")
        assert resp.status_code == 200
        assert resp.data["emotion"] == "joy"
        assert "calibrated_from" not in resp.data

    def test_authed_cold_user_gets_raw_emotion(self, auth_client, monkeypatch):
        monkeypatch.setattr(
            views,
            "modal_text",
            lambda text: {"emotion": "joy", "recommendations": []},
        )
        resp = auth_client.post(URL_TEXT, {"text": "hi"}, format="json")
        assert resp.status_code == 200
        assert resp.data["emotion"] == "joy"
        assert "calibrated_from" not in resp.data

    def test_authed_warm_user_gets_calibrated_emotion(self, auth_client, monkeypatch):
        # Seed the calibration map past threshold.
        profile = UserProfile.objects(username=auth_client.user.username).first()
        profile.mood_calibration = {"joy": {"love": CALIBRATION_THRESHOLD}}
        profile.save()

        monkeypatch.setattr(
            views,
            "modal_text",
            lambda text: {"emotion": "joy", "recommendations": []},
        )
        resp = auth_client.post(URL_TEXT, {"text": "hi"}, format="json")
        assert resp.status_code == 200
        assert resp.data["emotion"] == "love"
        assert resp.data["calibrated_from"] == "joy"

    def test_calibration_only_acts_on_matching_predicted(self, auth_client, monkeypatch):
        profile = UserProfile.objects(username=auth_client.user.username).first()
        profile.mood_calibration = {"sadness": {"anger": 99}}
        profile.save()

        monkeypatch.setattr(
            views,
            "modal_text",
            lambda text: {"emotion": "joy", "recommendations": []},
        )
        resp = auth_client.post(URL_TEXT, {"text": "hi"}, format="json")
        assert resp.status_code == 200
        assert resp.data["emotion"] == "joy"


# ---------------------------------------------------------------------------
# Bandit re-rank in /api/music_recommendation/
# ---------------------------------------------------------------------------
def _two_decade_tracks() -> list[dict]:
    return [
        {"name": "old", "release_date": "1985-01-01",
         "duration_ms": 200_000, "popularity": 50},
        {"name": "new", "release_date": "2020-01-01",
         "duration_ms": 200_000, "popularity": 50},
    ]


class TestMusicBanditRerank:
    def test_anon_caller_gets_base_order(self, api_client, monkeypatch):
        base = _two_decade_tracks()
        monkeypatch.setattr(
            views,
            "modal_music",
            lambda emotion, market=None, history=None, genre=None: {
                "emotion": emotion, "recommendations": base, "market": None,
            },
        )
        resp = api_client.post(URL_MUSIC, {"emotion": "joy"}, format="json")
        assert resp.status_code == 200
        assert [t["name"] for t in resp.data["recommendations"]] == ["old", "new"]

    def test_authed_cold_user_gets_base_order(self, auth_client, monkeypatch):
        base = _two_decade_tracks()
        monkeypatch.setattr(
            views,
            "modal_music",
            lambda emotion, market=None, history=None, genre=None: {
                "emotion": emotion, "recommendations": base, "market": None,
            },
        )
        resp = auth_client.post(URL_MUSIC, {"emotion": "joy"}, format="json")
        assert resp.status_code == 200
        # Cold start -> identity.
        assert [t["name"] for t in resp.data["recommendations"]] == ["old", "new"]

    def test_authed_warm_user_gets_reranked(self, auth_client, monkeypatch):
        # Seed a posterior that strongly prefers the 2010+ decade.
        alpha = [0.01] * tf.FEATURE_DIM
        beta = [100.0] * tf.FEATURE_DIM
        decade_slot = len(tf.EMOTIONS) + tf.DECADES.index("2010plus")
        alpha[decade_slot] = 100.0
        beta[decade_slot] = 0.01

        profile = UserProfile.objects(username=auth_client.user.username).first()
        profile.taste_profile = {
            "alpha": alpha, "beta": beta,
            "events": bandit.COLD_START_MIN_EVENTS + 1,
        }
        profile.save()

        base = _two_decade_tracks()
        monkeypatch.setattr(
            views,
            "modal_music",
            lambda emotion, market=None, history=None, genre=None: {
                "emotion": emotion, "recommendations": base, "market": None,
            },
        )
        resp = auth_client.post(URL_MUSIC, {"emotion": "joy"}, format="json")
        assert resp.status_code == 200
        names = [t["name"] for t in resp.data["recommendations"]]
        # New track now leads the list.
        assert names[0] == "new"
        # Set of tracks unchanged -- bandit only reorders.
        assert set(names) == {"old", "new"}

    def test_bandit_failure_falls_back_to_base_order(self, auth_client, monkeypatch):
        """Even if the bandit blows up, the request still succeeds."""
        base = _two_decade_tracks()
        monkeypatch.setattr(
            views,
            "modal_music",
            lambda emotion, market=None, history=None, genre=None: {
                "emotion": emotion, "recommendations": base, "market": None,
            },
        )

        # Force the rerank call to raise.
        def boom(*_args, **_kwargs):
            raise RuntimeError("bandit imploded")

        monkeypatch.setattr(views.bandit, "rerank", boom)

        # Make the user "warm" so we actually enter the rerank branch.
        profile = UserProfile.objects(username=auth_client.user.username).first()
        profile.taste_profile = {
            "alpha": [1.0] * tf.FEATURE_DIM,
            "beta": [1.0] * tf.FEATURE_DIM,
            "events": bandit.COLD_START_MIN_EVENTS + 5,
        }
        profile.save()

        resp = auth_client.post(URL_MUSIC, {"emotion": "joy"}, format="json")
        assert resp.status_code == 200
        # Fell back cleanly to the base order.
        assert [t["name"] for t in resp.data["recommendations"]] == ["old", "new"]


# ---------------------------------------------------------------------------
# Feedback -> taste_profile wiring
# ---------------------------------------------------------------------------
URL_FEEDBACK = "/api/feedback/"


class TestFeedbackWiresIntoTasteProfile:
    def test_like_with_track_dict_updates_posterior(self, auth_client):
        track = {"release_date": "2020-01-01",
                 "duration_ms": 200_000, "popularity": 75}
        resp = auth_client.post(
            URL_FEEDBACK,
            {"kind": "track", "track_id": "deezer:1", "signal": "like",
             "context_emotion": "joy", "track": track},
            format="json",
        )
        assert resp.status_code == 202

        profile = UserProfile.objects(username=auth_client.user.username).first()
        taste = profile.taste_profile
        assert taste.get("events") == 1
        # 2010+ decade slot should have its alpha bumped above the prior.
        decade_slot = len(tf.EMOTIONS) + tf.DECADES.index("2010plus")
        assert taste["alpha"][decade_slot] > bandit.PRIOR_ALPHA

    def test_unlike_with_track_dict_increments_beta(self, auth_client):
        track = {"release_date": "1985-01-01",
                 "duration_ms": 200_000, "popularity": 30}
        resp = auth_client.post(
            URL_FEEDBACK,
            {"kind": "track", "track_id": "deezer:2", "signal": "unlike",
             "context_emotion": "sadness", "track": track},
            format="json",
        )
        assert resp.status_code == 202

        profile = UserProfile.objects(username=auth_client.user.username).first()
        taste = profile.taste_profile
        decade_slot = len(tf.EMOTIONS) + tf.DECADES.index("80s")
        assert taste["beta"][decade_slot] > bandit.PRIOR_BETA

    def test_open_deezer_uses_half_weight(self, auth_client):
        track = {"release_date": "2020-01-01",
                 "duration_ms": 200_000, "popularity": 75}
        resp = auth_client.post(
            URL_FEEDBACK,
            {"kind": "track", "track_id": "deezer:3", "signal": "open_deezer",
             "context_emotion": "joy", "track": track},
            format="json",
        )
        assert resp.status_code == 202

        profile = UserProfile.objects(username=auth_client.user.username).first()
        taste = profile.taste_profile
        decade_slot = len(tf.EMOTIONS) + tf.DECADES.index("2010plus")
        # Half weight on alpha.
        assert taste["alpha"][decade_slot] == bandit.PRIOR_ALPHA + 0.5

    def test_track_signal_without_track_dict_still_persists_event(self, auth_client):
        # Without a track payload, we can't update the posterior -- but
        # the event log must still capture the signal.
        resp = auth_client.post(
            URL_FEEDBACK,
            {"kind": "track", "track_id": "deezer:99", "signal": "like"},
            format="json",
        )
        assert resp.status_code == 202

        profile = UserProfile.objects(username=auth_client.user.username).first()
        # No posterior update.
        assert not profile.taste_profile

    def test_invalid_track_field_type_is_rejected(self, auth_client):
        resp = auth_client.post(
            URL_FEEDBACK,
            {"kind": "track", "track_id": "deezer:1", "signal": "like",
             "track": "not a dict"},
            format="json",
        )
        assert resp.status_code == 400
