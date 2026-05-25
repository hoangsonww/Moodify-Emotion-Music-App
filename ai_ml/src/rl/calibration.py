"""Per-user mood-detection calibration map.

Pure-function mirror of ``backend/api/calibration.py``. Drop the
collected `mood_feedback` log into a nested counter, then call
``apply_calibration(predicted, calibration_map)`` to rewrite the
predicted label when a dominant correction exists.
"""

from __future__ import annotations

from typing import Iterable, Mapping, Optional


CALIBRATION_THRESHOLD = 3


def apply_calibration(
    predicted: str,
    calibration: Optional[Mapping[str, Mapping[str, int]]],
) -> str:
    """Return the recalibrated label or the original prediction.

    Ties (two `actual`s with the same dominant count) resolve to "no
    change" -- a tie isn't enough signal to overrule the model.
    """
    if not predicted or not calibration:
        return predicted

    bucket = calibration.get(predicted) or {}
    if not bucket:
        return predicted

    best_label: Optional[str] = None
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


def bump_calibration(
    calibration: Optional[Mapping[str, Mapping[str, int]]],
    predicted: str,
    actual: str,
) -> dict:
    """Return a new calibration map with `(predicted -> actual)` +1.

    Self-confirmations (predicted == actual) are intentionally ignored
    -- they don't carry correction signal and the map only tracks
    dominant disagreements.
    """
    out = {k: dict(v) for k, v in (calibration or {}).items()}
    if not predicted or not actual or predicted == actual:
        return out
    bucket = out.setdefault(predicted, {})
    bucket[actual] = int(bucket.get(actual, 0)) + 1
    return out


def build_from_log(events: Iterable[dict]) -> dict:
    """Roll a list of `mood_feedback` events into a calibration map.

    Each event is a dict with `predicted` and `actual` keys. Useful for
    rebuilding the per-user map from a CSV export.
    """
    cal: dict = {}
    for ev in events:
        cal = bump_calibration(cal, ev.get("predicted"), ev.get("actual"))
    return cal


__all__ = [
    "CALIBRATION_THRESHOLD",
    "apply_calibration",
    "bump_calibration",
    "build_from_log",
]
