"""Unit tests for the per-user mood calibration map."""

from __future__ import annotations

import pytest

from api.calibration import CALIBRATION_THRESHOLD, apply_calibration


class TestApplyCalibration:
    def test_empty_map_passthrough(self):
        assert apply_calibration("joy", None) == "joy"
        assert apply_calibration("joy", {}) == "joy"

    def test_no_bucket_for_predicted(self):
        assert apply_calibration("joy", {"sadness": {"anger": 5}}) == "joy"

    def test_below_threshold_passthrough(self):
        calibration = {"joy": {"love": CALIBRATION_THRESHOLD - 1}}
        assert apply_calibration("joy", calibration) == "joy"

    def test_at_threshold_rewrites(self):
        calibration = {"joy": {"love": CALIBRATION_THRESHOLD}}
        assert apply_calibration("joy", calibration) == "love"

    def test_above_threshold_rewrites(self):
        calibration = {"joy": {"love": CALIBRATION_THRESHOLD + 50}}
        assert apply_calibration("joy", calibration) == "love"

    def test_dominant_correction_wins(self):
        calibration = {
            "joy": {"love": 10, "anger": 2},
        }
        assert apply_calibration("joy", calibration) == "love"

    def test_tie_resolves_to_no_change(self):
        # Two actuals tied at the dominant count -- can't decide, keep
        # the model prediction.
        calibration = {"joy": {"love": 5, "anger": 5}}
        assert apply_calibration("joy", calibration) == "joy"

    def test_only_affects_matching_predicted(self):
        calibration = {"sadness": {"anger": 10}}
        assert apply_calibration("joy", calibration) == "joy"
        assert apply_calibration("sadness", calibration) == "anger"

    def test_empty_predicted_passthrough(self):
        assert apply_calibration("", {"joy": {"love": 100}}) == ""

    def test_garbage_count_is_ignored(self):
        calibration = {"joy": {"love": "not a number", "anger": CALIBRATION_THRESHOLD}}
        assert apply_calibration("joy", calibration) == "anger"

    def test_threshold_constant_is_three(self):
        # Plan says ≥ 3 same-direction corrections.
        assert CALIBRATION_THRESHOLD == 3
