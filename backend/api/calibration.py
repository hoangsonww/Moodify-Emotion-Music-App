"""Apply a user's mood-calibration map to a fresh inference result.

Layer L1 in the plan -- per-user, no model retrain, immediate. The map
is the ``UserProfile.mood_calibration`` field; the writer side (the
counter bump) lives in ``feedback_views``.

The contract is intentionally minimal:

* For the predicted label, find the most-corrected ``actual`` label.
* If that label has been logged at least
  ``CALIBRATION_THRESHOLD`` times in the same direction, rewrite the
  predicted label to it.
* Otherwise return the original label.

Ties (two actuals with the same count above threshold) fall back to
the original prediction -- a tie isn't enough signal to overrule the
model.
"""

from __future__ import annotations

from typing import Mapping

# Plan-specified threshold (≥ 3 same-direction corrections). Centralised
# so tests and the feedback writer agree on the bar.
CALIBRATION_THRESHOLD = 3


def apply_calibration(
    predicted: str,
    calibration: Mapping[str, Mapping[str, int]] | None,
) -> str:
    """Return the recalibrated label or the original prediction.

    ``calibration`` is the nested counter from ``UserProfile``:
    ``{predicted_label: {actual_label: count}}``.
    """
    if not predicted or not calibration:
        return predicted

    bucket = calibration.get(predicted) or {}
    if not bucket:
        return predicted

    # Find the most-corrected target. Ties resolve to "no change".
    best_label: str | None = None
    best_count = 0
    tied = False
    for label, raw_count in bucket.items():
        try:
            count = int(raw_count)
        except (TypeError, ValueError):
            continue
        if count > best_count:
            best_label = label
            best_count = count
            tied = False
        elif count == best_count and label != best_label:
            tied = True

    if tied or best_label is None:
        return predicted
    if best_count < CALIBRATION_THRESHOLD:
        return predicted
    return best_label
