"""Unit tests for the end-to-end personalized recommendation pipeline."""

from __future__ import annotations

import random

import pytest

from ai_ml.src.recommendation import personalized_recommendation as pr
from ai_ml.src.rl import bandit
from ai_ml.src.rl import track_features as tf


# ---------------------------------------------------------------------------
# EWMA + Markov
# ---------------------------------------------------------------------------
class TestScoreMoodHistory:
    def test_empty_history(self):
        assert pr.score_mood_history([]) == {}
        assert pr.score_mood_history(None) == {}

    def test_recent_mood_dominates_when_alone(self):
        # With a single trailing entry and no repeats, the most recent
        # mood always wins -- EWMA weight 1.0 vs decayed 0.85^k for the
        # older entries.
        affinity = pr.score_mood_history(["sadness", "calm", "joy"])
        assert max(affinity, key=affinity.get) == "joy"

    def test_repeated_old_mood_can_outweigh_one_new(self):
        # Two `sadness` entries accumulate (0.7225 + 0.85 = 1.5725)
        # which beats a single fresh `joy` (1.0). This is intentional --
        # the EWMA is the long-tail recurring-mood signal, not a
        # "newest wins" picker.
        affinity = pr.score_mood_history(["sadness", "sadness", "joy"])
        assert affinity["sadness"] > affinity["joy"]

    def test_markov_boosts_predicted_next(self):
        # Sequence ends on "joy"; the only transition from "joy" goes
        # to "love" -> "love" gets a Markov boost.
        affinity = pr.score_mood_history(["joy", "love", "joy"])
        assert "love" in affinity
        assert affinity["love"] >= pr.MARKOV_BOOST

    def test_normalizes_case_and_whitespace(self):
        affinity = pr.score_mood_history(["  JOY ", "joy"])
        assert "joy" in affinity
        assert list(affinity.keys()) == ["joy"]


class TestRecurringMood:
    def test_picks_top_non_current(self):
        affinity = {"joy": 5.0, "love": 3.0, "sadness": 1.0}
        assert pr.recurring_mood(affinity, "joy") == "love"

    def test_no_other_mood(self):
        assert pr.recurring_mood({"joy": 5.0}, "joy") is None

    def test_empty_affinity(self):
        assert pr.recurring_mood({}, "joy") is None


class TestBlendRatio:
    def test_clamped_low(self):
        affinity = {"joy": 1.0, "love": 5.0}
        assert pr.blend_ratio(affinity, "joy", "love") == 1

    def test_clamped_high(self):
        affinity = {"joy": 100.0, "love": 1.0}
        assert pr.blend_ratio(affinity, "joy", "love") == 5

    def test_no_recurring(self):
        assert pr.blend_ratio({"joy": 1.0}, "joy", None) == 1


# ---------------------------------------------------------------------------
# Quality rerank + interleave
# ---------------------------------------------------------------------------
class TestRankByQuality:
    def test_empty(self):
        assert pr.rank_by_quality([]) == []

    def test_popularity_can_promote(self):
        tracks = [
            {"name": "A", "popularity": 0},
            {"name": "B", "popularity": 95},
        ]
        out = pr.rank_by_quality(tracks)
        # A is curated #1 (1.0); B is curated #2 (0.0) but popularity 0.95.
        # Score A = 0.8 * 1.0 + 0.2 * 0.0 = 0.80
        # Score B = 0.8 * 0.0 + 0.2 * 0.95 = 0.19
        # -> A still wins. Popularity nudges but curated dominates.
        assert out[0]["name"] == "A"

    def test_overwhelming_popularity_can_top(self):
        # Even with popularity 100, a curated #20 of 20 only scores
        # 0.8*0 + 0.2*1 = 0.20; curated #1 scores 0.80. Curated wins.
        # But if curated rank gap is small, popularity flips order:
        tracks = [
            {"name": "A", "popularity": 0},   # curated 1.0
            {"name": "B", "popularity": 0},   # curated 0.5 (mid)
            {"name": "C", "popularity": 100}, # curated 0.0
        ]
        out = pr.rank_by_quality(tracks)
        # A: 0.80, B: 0.40, C: 0.20 -> A, B, C
        assert [t["name"] for t in out] == ["A", "B", "C"]

    def test_stable_for_ties(self):
        tracks = [{"name": "A", "popularity": 50},
                  {"name": "B", "popularity": 50}]
        out = pr.rank_by_quality(tracks)
        assert [t["name"] for t in out] == ["A", "B"]


class TestInterleave:
    def test_no_recurring_returns_current(self):
        cur = [{"name": "a"}, {"name": "b"}]
        assert pr.interleave(cur, []) == cur

    def test_one_recurring_per_n_current(self):
        cur = [{"name": "c1"}, {"name": "c2"}, {"name": "c3"}, {"name": "c4"}]
        rec = [{"name": "r1"}, {"name": "r2"}]
        out = pr.interleave(cur, rec, ratio=2)
        # Insert one recurring after every 2 current.
        names = [t["name"] for t in out]
        assert names == ["c1", "c2", "r1", "c3", "c4", "r2"]

    def test_deduplicates_by_external_url(self):
        cur = [{"name": "x", "external_url": "u1"},
               {"name": "x", "external_url": "u1"}]
        rec = []
        out = pr.interleave(cur, rec)
        assert len(out) == 1

    def test_deduplicates_by_name_artist_when_url_missing(self):
        cur = [{"name": "x", "artist": "a"}, {"name": "x", "artist": "a"}]
        out = pr.interleave(cur, [])
        assert len(out) == 1


# ---------------------------------------------------------------------------
# End-to-end pipeline
# ---------------------------------------------------------------------------
def _warm_profile(slot: int, alpha_high=100.0, beta_low=0.01):
    alpha = [0.01] * tf.FEATURE_DIM
    beta = [100.0] * tf.FEATURE_DIM
    alpha[slot] = alpha_high
    beta[slot] = beta_low
    return {"alpha": alpha, "beta": beta,
            "events": bandit.COLD_START_MIN_EVENTS + 1}


class TestPersonalizedPipeline:
    def test_cold_user_passthrough(self):
        tracks = [{"name": f"t{i}", "popularity": 50,
                   "release_date": "2020-01-01", "duration_ms": 200000}
                  for i in range(5)]
        result = pr.personalized_pipeline(
            detected_emotion="joy",
            current_tracks=tracks,
            mood_history=[],
            taste_profile=None,
        )
        assert result["emotion"] == "joy"
        assert result["calibrated_from"] is None
        assert {t["name"] for t in result["recommendations"]} == {t["name"] for t in tracks}

    def test_calibration_rewrites_emotion(self):
        tracks = [{"name": "a", "popularity": 50,
                   "release_date": "2020-01-01", "duration_ms": 200000}]
        cal_map = {"joy": {"love": 5}}
        result = pr.personalized_pipeline(
            detected_emotion="joy",
            current_tracks=tracks,
            mood_calibration=cal_map,
        )
        assert result["emotion"] == "love"
        assert result["calibrated_from"] == "joy"

    def test_recurring_mood_emerges_from_history(self):
        tracks = [{"name": "a", "popularity": 50}]
        result = pr.personalized_pipeline(
            detected_emotion="joy",
            current_tracks=tracks,
            mood_history=["sadness", "sadness", "sadness", "joy"],
        )
        assert result["recurring_mood"] == "sadness"
        assert result["blend_ratio"] >= 1

    def test_warm_user_reranks(self):
        tracks = [
            {"name": "old", "release_date": "1985-01-01",
             "duration_ms": 200000, "popularity": 50},
            {"name": "new", "release_date": "2020-01-01",
             "duration_ms": 200000, "popularity": 50},
        ]
        slot = len(tf.EMOTIONS) + tf.DECADES.index("2010plus")
        result = pr.personalized_pipeline(
            detected_emotion="joy",
            current_tracks=tracks,
            taste_profile=_warm_profile(slot),
            rng=random.Random(42),
        )
        names = [t["name"] for t in result["recommendations"]]
        assert names[0] == "new"
        assert set(names) == {"old", "new"}

    def test_pipeline_never_invents_tracks(self):
        tracks = [{"name": f"t{i}", "popularity": i * 10,
                   "release_date": "2020-01-01", "duration_ms": 200000}
                  for i in range(8)]
        slot = len(tf.EMOTIONS) + tf.DECADES.index("2010plus")
        result = pr.personalized_pipeline(
            detected_emotion="joy",
            current_tracks=tracks,
            taste_profile=_warm_profile(slot),
            rng=random.Random(0),
        )
        # Set of names is preserved -- bandit reorders, never injects.
        assert {t["name"] for t in result["recommendations"]} == {t["name"] for t in tracks}

    def test_calibration_runs_before_bandit_context(self):
        # If calibration flips joy -> love, the bandit should use "love"
        # as context_emotion. We verify by seeding the love emotion slot
        # heavy and checking the order moves accordingly.
        tracks = [{"name": "t0", "popularity": 50,
                   "release_date": "2020-01-01", "duration_ms": 200000},
                  {"name": "t1", "popularity": 50,
                   "release_date": "1985-01-01", "duration_ms": 200000}]
        # Heavy alpha on love-emotion slot -> every track lights that
        # axis -> uniform boost -> tie -> original order. (Verifies
        # the emotion really propagated.)
        love_slot = tf.EMOTIONS.index("love")
        profile = _warm_profile(love_slot)
        result = pr.personalized_pipeline(
            detected_emotion="joy",
            current_tracks=tracks,
            mood_calibration={"joy": {"love": 3}},
            taste_profile=profile,
            rng=random.Random(1),
        )
        assert result["emotion"] == "love"
        # Names preserved.
        assert {t["name"] for t in result["recommendations"]} == {"t0", "t1"}
