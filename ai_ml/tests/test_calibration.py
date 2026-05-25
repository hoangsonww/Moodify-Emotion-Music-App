"""Unit tests for the mood-calibration map."""

from __future__ import annotations

from ai_ml.src.rl import calibration as cal


class TestApplyCalibration:
    def test_empty_map_passthrough(self):
        assert cal.apply_calibration("joy", None) == "joy"
        assert cal.apply_calibration("joy", {}) == "joy"

    def test_no_bucket(self):
        assert cal.apply_calibration("joy", {"sadness": {"anger": 5}}) == "joy"

    def test_below_threshold(self):
        m = {"joy": {"love": cal.CALIBRATION_THRESHOLD - 1}}
        assert cal.apply_calibration("joy", m) == "joy"

    def test_at_threshold(self):
        m = {"joy": {"love": cal.CALIBRATION_THRESHOLD}}
        assert cal.apply_calibration("joy", m) == "love"

    def test_above_threshold(self):
        m = {"joy": {"love": cal.CALIBRATION_THRESHOLD + 50}}
        assert cal.apply_calibration("joy", m) == "love"

    def test_dominant_wins(self):
        m = {"joy": {"love": 10, "anger": 2}}
        assert cal.apply_calibration("joy", m) == "love"

    def test_tie_returns_original(self):
        m = {"joy": {"love": 5, "anger": 5}}
        assert cal.apply_calibration("joy", m) == "joy"

    def test_garbage_count_ignored(self):
        m = {"joy": {"love": "x", "anger": cal.CALIBRATION_THRESHOLD}}
        assert cal.apply_calibration("joy", m) == "anger"

    def test_threshold_value(self):
        assert cal.CALIBRATION_THRESHOLD == 3


class TestBumpCalibration:
    def test_fresh_map(self):
        out = cal.bump_calibration(None, "joy", "love")
        assert out == {"joy": {"love": 1}}

    def test_accumulates(self):
        out = None
        for _ in range(4):
            out = cal.bump_calibration(out, "joy", "love")
        assert out["joy"]["love"] == 4

    def test_self_confirmation_ignored(self):
        out = cal.bump_calibration(None, "joy", "joy")
        assert out == {}

    def test_preserves_other_buckets(self):
        seed = {"sadness": {"anger": 2}}
        out = cal.bump_calibration(seed, "joy", "love")
        assert out["sadness"] == {"anger": 2}
        assert out["joy"] == {"love": 1}
        # Pure function: original unchanged.
        assert seed == {"sadness": {"anger": 2}}


class TestBuildFromLog:
    def test_rolls_log_into_map(self):
        events = [
            {"predicted": "joy", "actual": "love"},
            {"predicted": "joy", "actual": "love"},
            {"predicted": "joy", "actual": "anger"},
            {"predicted": "sadness", "actual": "neutral"},
            {"predicted": "joy", "actual": "joy"},  # self-confirmation, skipped
        ]
        m = cal.build_from_log(events)
        assert m == {
            "joy": {"love": 2, "anger": 1},
            "sadness": {"neutral": 1},
        }

    def test_empty_log(self):
        assert cal.build_from_log([]) == {}


class TestEndToEnd:
    def test_log_then_apply(self):
        log = [{"predicted": "joy", "actual": "love"} for _ in range(3)]
        m = cal.build_from_log(log)
        assert cal.apply_calibration("joy", m) == "love"
