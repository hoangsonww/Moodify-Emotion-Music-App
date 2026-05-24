"""Unit tests for the bandit feature extractor."""

from __future__ import annotations

import pytest

from api import track_features as tf


class TestVectorShape:
    def test_dim_is_stable(self):
        # If this breaks, you've reshaped the feature space -- which
        # invalidates every existing taste_profile in the DB. Bump a
        # version field on the profile (and grandfather old vectors)
        # before changing the layout.
        assert tf.FEATURE_DIM == (
            len(tf.EMOTIONS)
            + len(tf.DECADES)
            + len(tf.DURATION_BUCKETS)
            + len(tf.POPULARITY_BUCKETS)
        )

    def test_one_hot_per_axis(self):
        v = tf.featurize(
            {"release_date": "2015-04-01", "duration_ms": 200_000, "popularity": 80},
            context_emotion="joy",
            sorted_pops=[10, 40, 80, 90, 95],
        )
        assert len(v) == tf.FEATURE_DIM
        # Each axis lights exactly one bucket -> sum is exactly 4.
        assert sum(v) == 4.0


class TestEmotionBucket:
    @pytest.mark.parametrize("emo", tf.EMOTIONS)
    def test_known_emotion(self, emo):
        v = tf.featurize({}, context_emotion=emo)
        assert v[tf.EMOTIONS.index(emo)] == 1.0

    def test_unknown_emotion_falls_back_to_neutral(self):
        v = tf.featurize({}, context_emotion="ecstatic")
        assert v[tf.EMOTIONS.index("neutral")] == 1.0

    def test_missing_emotion_falls_back_to_neutral(self):
        v = tf.featurize({}, context_emotion=None)
        assert v[tf.EMOTIONS.index("neutral")] == 1.0


class TestDecadeBucket:
    @pytest.mark.parametrize("year,bucket", [
        ("1955-01-01", "pre1960"),
        ("1965-06-06", "60s"),
        ("1979-12-31", "70s"),
        ("1985", "80s"),
        ("1999-09-09", "90s"),
        ("2005-04-04", "2000s"),
        ("2015-11-11", "2010plus"),
        ("2025-01-01", "2010plus"),
    ])
    def test_year_to_bucket(self, year, bucket):
        v = tf.featurize({"release_date": year}, context_emotion="neutral")
        offset = len(tf.EMOTIONS)
        assert v[offset + tf.DECADES.index(bucket)] == 1.0

    def test_missing_date_lands_in_pre1960(self):
        v = tf.featurize({"release_date": None}, context_emotion="neutral")
        offset = len(tf.EMOTIONS)
        assert v[offset + tf.DECADES.index("pre1960")] == 1.0

    def test_garbage_date(self):
        v = tf.featurize({"release_date": "yesterday"}, context_emotion="neutral")
        offset = len(tf.EMOTIONS)
        assert v[offset + tf.DECADES.index("pre1960")] == 1.0


class TestDurationBucket:
    @pytest.mark.parametrize("ms,bucket", [
        (60_000, "under_2m"),
        (150_000, "2_4m"),
        (300_000, "4_6m"),
        (420_000, "over_6m"),
    ])
    def test_duration(self, ms, bucket):
        v = tf.featurize({"duration_ms": ms}, context_emotion="neutral")
        offset = len(tf.EMOTIONS) + len(tf.DECADES)
        assert v[offset + tf.DURATION_BUCKETS.index(bucket)] == 1.0

    def test_missing_duration_is_median_bucket(self):
        v = tf.featurize({"duration_ms": None}, context_emotion="neutral")
        offset = len(tf.EMOTIONS) + len(tf.DECADES)
        assert v[offset + tf.DURATION_BUCKETS.index("2_4m")] == 1.0


class TestPopularityBucket:
    def test_list_relative_quintiles(self):
        # 5 tracks evenly spread -> each lands in a different quintile.
        pops = [10, 30, 50, 70, 95]
        offset = len(tf.EMOTIONS) + len(tf.DECADES) + len(tf.DURATION_BUCKETS)
        for val, bucket in zip(pops, tf.POPULARITY_BUCKETS):
            v = tf.featurize({"popularity": val}, context_emotion="neutral",
                             sorted_pops=sorted(pops))
            assert v[offset + tf.POPULARITY_BUCKETS.index(bucket)] == 1.0

    def test_missing_popularity_is_median_bucket(self):
        offset = len(tf.EMOTIONS) + len(tf.DECADES) + len(tf.DURATION_BUCKETS)
        v = tf.featurize({"popularity": None}, context_emotion="neutral", sorted_pops=[])
        assert v[offset + tf.POPULARITY_BUCKETS.index("p2")] == 1.0


class TestBatchFeaturize:
    def test_preserves_input_order(self):
        # Five evenly-spaced popularities so the quintile boundaries
        # are clean (1:1 with the buckets).
        tracks = [{"popularity": p} for p in [10, 30, 50, 70, 95]]
        vectors = tf.featurize_batch(tracks, context_emotion="joy")
        assert len(vectors) == 5
        offset = len(tf.EMOTIONS) + len(tf.DECADES) + len(tf.DURATION_BUCKETS)
        # Bottom -> p0, top -> p4. Input order is preserved -- vector[i]
        # describes tracks[i], not the sorted-by-popularity index.
        assert vectors[0][offset + tf.POPULARITY_BUCKETS.index("p0")] == 1.0
        assert vectors[-1][offset + tf.POPULARITY_BUCKETS.index("p4")] == 1.0

    def test_empty_input(self):
        assert tf.featurize_batch([], context_emotion="joy") == []

    def test_ignores_garbage_popularity_in_sort(self):
        # Garbage popularity values are filtered out of the sorted_pops
        # baseline but the per-track call still returns a sane bucket.
        tracks = [{"popularity": p} for p in [10, "oops", 50, None, 95]]
        vectors = tf.featurize_batch(tracks, context_emotion="joy")
        assert len(vectors) == 5
        # All five vectors are well-formed (sum == 4.0 -> one bucket per axis).
        for v in vectors:
            assert sum(v) == 4.0
