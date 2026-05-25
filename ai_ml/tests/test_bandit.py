"""Unit tests for the Thompson Sampling bandit."""

from __future__ import annotations

import random

import pytest

from ai_ml.src.rl import bandit
from ai_ml.src.rl import track_features as tf


def _make_tracks(n: int):
    years = [1965, 1975, 1985, 1995, 2005, 2015, 2020, 2022, 2024, 1970]
    return [
        {
            "name": f"track-{i}",
            "release_date": f"{years[i % len(years)]}-01-01",
            "duration_ms": 60_000 + (i * 10_000) % 360_000,
            "popularity": i * 5,
        }
        for i in range(n)
    ]


class TestUpdatePosterior:
    def test_like_increments_alpha(self):
        features = [0.0] * tf.FEATURE_DIM
        features[0] = 1.0
        features[3] = 1.0
        updated = bandit.update_posterior(None, features, "like")
        assert updated["alpha"][0] == bandit.PRIOR_ALPHA + bandit.WEIGHTS["like"]
        assert updated["alpha"][3] == bandit.PRIOR_ALPHA + bandit.WEIGHTS["like"]
        assert updated["alpha"][1] == bandit.PRIOR_ALPHA
        assert updated["beta"][0] == bandit.PRIOR_BETA
        assert updated["events"] == 1

    def test_unlike_increments_beta(self):
        features = [0.0] * tf.FEATURE_DIM
        features[5] = 1.0
        updated = bandit.update_posterior(None, features, "unlike")
        assert updated["beta"][5] == bandit.PRIOR_BETA + bandit.WEIGHTS["unlike"]
        assert updated["alpha"][5] == bandit.PRIOR_ALPHA

    def test_open_deezer_half_weight_on_alpha(self):
        features = [0.0] * tf.FEATURE_DIM
        features[2] = 1.0
        updated = bandit.update_posterior(None, features, "open_deezer")
        assert updated["alpha"][2] == bandit.PRIOR_ALPHA + 0.5

    def test_unknown_signal_is_noop(self):
        features = [1.0] * tf.FEATURE_DIM
        original = bandit.update_posterior(None, features, "like")
        same = bandit.update_posterior(original, features, "skip")
        assert same == original

    def test_dim_mismatch_is_noop(self):
        before = bandit.update_posterior(None, [1.0] * tf.FEATURE_DIM, "like")
        after = bandit.update_posterior(before, [1.0] * (tf.FEATURE_DIM + 5), "like")
        assert after == before

    def test_accumulates(self):
        features = [0.0] * tf.FEATURE_DIM
        features[0] = 1.0
        profile = None
        for _ in range(4):
            profile = bandit.update_posterior(profile, features, "like")
        assert profile["events"] == 4
        assert profile["alpha"][0] == bandit.PRIOR_ALPHA + 4 * bandit.WEIGHTS["like"]

    def test_short_stored_vector_is_padded(self):
        stale = {"alpha": [5.0, 6.0], "beta": [2.0, 1.0], "events": 7}
        features = [0.0] * tf.FEATURE_DIM
        features[0] = 1.0
        updated = bandit.update_posterior(stale, features, "like")
        assert len(updated["alpha"]) == tf.FEATURE_DIM
        assert updated["alpha"][0] == 5.0 + bandit.WEIGHTS["like"]
        assert updated["events"] == 8

    def test_input_is_not_mutated(self):
        features = [0.0] * tf.FEATURE_DIM
        features[0] = 1.0
        original = bandit.update_posterior(None, features, "like")
        alpha_before = list(original["alpha"])
        beta_before = list(original["beta"])
        bandit.update_posterior(original, features, "unlike")
        assert original["alpha"] == alpha_before
        assert original["beta"] == beta_before


class TestRerank:
    def test_empty_or_singleton_passthrough(self):
        assert bandit.rerank([], taste_profile={}, context_emotion="joy") == []
        single = [{"name": "only"}]
        assert bandit.rerank(single, taste_profile={}, context_emotion="joy") == single

    def test_cold_user_returns_input_order(self):
        tracks = _make_tracks(5)
        assert bandit.rerank(tracks, taste_profile=None, context_emotion="joy") == tracks

    def test_below_threshold_returns_input(self):
        tracks = _make_tracks(5)
        profile = {"alpha": [1.0] * tf.FEATURE_DIM,
                   "beta": [1.0] * tf.FEATURE_DIM, "events": 1}
        assert bandit.rerank(tracks, taste_profile=profile, context_emotion="joy") == tracks

    def test_warm_user_reorders_toward_strong_axis(self):
        tracks = _make_tracks(10)
        alpha = [0.01] * tf.FEATURE_DIM
        beta = [100.0] * tf.FEATURE_DIM
        slot = len(tf.EMOTIONS) + tf.DECADES.index("2010plus")
        alpha[slot] = 100.0
        beta[slot] = 0.01

        profile = {
            "alpha": alpha, "beta": beta,
            "events": bandit.COLD_START_MIN_EVENTS + 1,
        }
        out = bandit.rerank(tracks, taste_profile=profile,
                            context_emotion="joy", rng=random.Random(42))
        assert len(out) == len(tracks)
        top_year = int(out[0]["release_date"].split("-")[0])
        assert top_year >= 2010

    def test_preserves_track_set(self):
        tracks = _make_tracks(10)
        profile = {
            "alpha": [5.0] * tf.FEATURE_DIM,
            "beta": [1.0] * tf.FEATURE_DIM,
            "events": bandit.COLD_START_MIN_EVENTS + 5,
        }
        out = bandit.rerank(tracks, taste_profile=profile,
                            context_emotion="joy", rng=random.Random(0))
        assert {t["name"] for t in out} == {t["name"] for t in tracks}


class TestReplay:
    def test_replay_builds_warm_profile(self):
        events = []
        for i in range(25):
            events.append({
                "track": {"release_date": "2020-01-01",
                          "duration_ms": 200_000, "popularity": 70},
                "signal": "like",
                "context_emotion": "joy",
            })
        profile = bandit.replay(events)
        assert profile["events"] == 25
        slot = len(tf.EMOTIONS) + tf.DECADES.index("2010plus")
        assert profile["alpha"][slot] > bandit.PRIOR_ALPHA

    def test_replay_ignores_unknown_signals(self):
        profile = bandit.replay([
            {"track": {}, "signal": "skip", "context_emotion": "joy"}
        ])
        # No usable events -> empty starting posterior is returned.
        assert profile["events"] == 0


class TestColdStartConstant:
    def test_threshold_is_20(self):
        assert bandit.COLD_START_MIN_EVENTS == 20
