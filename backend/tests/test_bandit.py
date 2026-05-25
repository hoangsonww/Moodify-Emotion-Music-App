"""Unit tests for the Thompson Sampling bandit re-ranker."""

from __future__ import annotations

import random

import pytest

from api import bandit
from api import track_features as tf


# ---------------------------------------------------------------------------
# Posterior update
# ---------------------------------------------------------------------------
class TestUpdatePosterior:
    def test_like_increments_alpha_on_active_features(self):
        features = [0.0] * tf.FEATURE_DIM
        features[0] = 1.0
        features[3] = 1.0
        updated = bandit.update_posterior(None, features, "like")
        assert updated["alpha"][0] == bandit.PRIOR_ALPHA + bandit.WEIGHTS["like"]
        assert updated["alpha"][3] == bandit.PRIOR_ALPHA + bandit.WEIGHTS["like"]
        # Inactive feature untouched.
        assert updated["alpha"][1] == bandit.PRIOR_ALPHA
        assert updated["beta"][0] == bandit.PRIOR_BETA
        assert updated["events"] == 1

    def test_unlike_increments_beta(self):
        features = [0.0] * tf.FEATURE_DIM
        features[5] = 1.0
        updated = bandit.update_posterior(None, features, "unlike")
        assert updated["beta"][5] == bandit.PRIOR_BETA + bandit.WEIGHTS["unlike"]
        assert updated["alpha"][5] == bandit.PRIOR_ALPHA

    def test_open_deezer_uses_half_weight_on_alpha(self):
        features = [0.0] * tf.FEATURE_DIM
        features[2] = 1.0
        updated = bandit.update_posterior(None, features, "open_deezer")
        assert updated["alpha"][2] == bandit.PRIOR_ALPHA + 0.5
        assert updated["beta"][2] == bandit.PRIOR_BETA

    def test_unknown_signal_is_noop(self):
        features = [1.0] * tf.FEATURE_DIM
        original = bandit.update_posterior(None, features, "like")
        same = bandit.update_posterior(original, features, "skip")
        # No-op returns the existing profile unchanged.
        assert same == original

    def test_dim_mismatch_is_noop(self):
        # Wrong-length vector should not poison the posterior.
        before = bandit.update_posterior(None, [1.0] * tf.FEATURE_DIM, "like")
        after = bandit.update_posterior(before, [1.0] * (tf.FEATURE_DIM + 5), "like")
        assert after == before

    def test_accumulates_across_calls(self):
        features = [0.0] * tf.FEATURE_DIM
        features[0] = 1.0
        profile = None
        for _ in range(4):
            profile = bandit.update_posterior(profile, features, "like")
        assert profile["events"] == 4
        assert profile["alpha"][0] == bandit.PRIOR_ALPHA + 4 * bandit.WEIGHTS["like"]

    def test_short_stored_vector_is_padded(self):
        # Simulate an older profile that pre-dates a feature-vector
        # extension. The extractor must pad with priors, not crash.
        stale = {"alpha": [5.0, 6.0], "beta": [2.0, 1.0], "events": 7}
        features = [0.0] * tf.FEATURE_DIM
        features[0] = 1.0
        updated = bandit.update_posterior(stale, features, "like")
        assert len(updated["alpha"]) == tf.FEATURE_DIM
        assert updated["alpha"][0] == 5.0 + bandit.WEIGHTS["like"]
        assert updated["events"] == 8


# ---------------------------------------------------------------------------
# Re-rank
# ---------------------------------------------------------------------------
def _make_tracks(n: int) -> list[dict]:
    # Spread across decades so the 2010+ bucket is reachable by tests
    # that lean on it.
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


class TestRerank:
    def test_empty_or_singleton_passthrough(self):
        assert bandit.rerank([], taste_profile={}, context_emotion="joy") == []
        single = [{"name": "only"}]
        assert bandit.rerank(single, taste_profile={}, context_emotion="joy") == single

    def test_cold_user_returns_input_order(self):
        tracks = _make_tracks(5)
        out = bandit.rerank(tracks, taste_profile=None, context_emotion="joy")
        assert out == tracks

    def test_below_cold_start_threshold_returns_input(self):
        tracks = _make_tracks(5)
        # 1 event recorded, threshold is 20 -> passthrough.
        profile = {"alpha": [1.0] * tf.FEATURE_DIM,
                   "beta": [1.0] * tf.FEATURE_DIM, "events": 1}
        out = bandit.rerank(tracks, taste_profile=profile, context_emotion="joy")
        assert out == tracks

    def test_warm_user_reorders(self):
        tracks = _make_tracks(10)
        # Engineer the posterior so the 2010+ decade slot is the only
        # axis that samples non-zero: alpha >> beta there, alpha << beta
        # everywhere else. Tracks share the emotion / popularity /
        # duration samples so those axes can't break the tie -- only
        # the decade axis discriminates.
        alpha = [0.01] * tf.FEATURE_DIM
        beta = [100.0] * tf.FEATURE_DIM
        decade_slot = len(tf.EMOTIONS) + tf.DECADES.index("2010plus")
        alpha[decade_slot] = 100.0
        beta[decade_slot] = 0.01

        profile = {
            "alpha": alpha,
            "beta": beta,
            "events": bandit.COLD_START_MIN_EVENTS + 1,
        }

        rng = random.Random(42)
        out = bandit.rerank(tracks, taste_profile=profile,
                            context_emotion="joy", rng=rng)
        assert len(out) == len(tracks)
        # The top track should be from the 2010+ decade.
        top_year = int(out[0]["release_date"].split("-")[0])
        assert top_year >= 2010
        # The bottom track should NOT be from the 2010+ decade.
        bottom_year = int(out[-1]["release_date"].split("-")[0])
        assert bottom_year < 2010

    def test_rerank_preserves_set_of_tracks(self):
        # Bandit can REORDER but never inject / drop.
        tracks = _make_tracks(10)
        profile = {
            "alpha": [5.0] * tf.FEATURE_DIM,
            "beta": [1.0] * tf.FEATURE_DIM,
            "events": bandit.COLD_START_MIN_EVENTS + 5,
        }
        out = bandit.rerank(tracks, taste_profile=profile,
                            context_emotion="joy", rng=random.Random(0))
        assert len(out) == len(tracks)
        assert {t["name"] for t in out} == {t["name"] for t in tracks}


class TestColdStartThreshold:
    def test_threshold_constant_is_20(self):
        # Plan says 20. If this changes, the user-facing rollout note
        # must change too.
        assert bandit.COLD_START_MIN_EVENTS == 20
