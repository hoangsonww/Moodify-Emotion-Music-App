"""Fixed-order feature extraction for the contextual bandit.

Identical layout to ``backend/api/track_features.py`` so a posterior
learned in offline experiments can be poured straight into a
production ``UserProfile.taste_profile`` without reshaping. Pure
Python, no NumPy dependency.

Vector layout (length = 22, fixed forever; appending new buckets is
safe, reordering is NOT):

  0..5    emotion one-hot   (sadness, joy, love, anger, fear, neutral)
  6..12   decade one-hot    (pre-1960s, 60s, 70s, 80s, 90s, 2000s, 2010plus)
 13..16   duration one-hot  (<2 min, 2-4, 4-6, 6+ min)
 17..21   popularity one-hot (rank quintiles within the candidate list)
"""

from __future__ import annotations

import re
from typing import Iterable, List, Optional, Sequence


EMOTIONS = ("sadness", "joy", "love", "anger", "fear", "neutral")
DECADES = ("pre1960", "60s", "70s", "80s", "90s", "2000s", "2010plus")
DURATION_BUCKETS = ("under_2m", "2_4m", "4_6m", "over_6m")
POPULARITY_BUCKETS = ("p0", "p1", "p2", "p3", "p4")

FEATURE_DIM = (
    len(EMOTIONS)
    + len(DECADES)
    + len(DURATION_BUCKETS)
    + len(POPULARITY_BUCKETS)
)

_EMO_OFFSET = 0
_DEC_OFFSET = len(EMOTIONS)
_DUR_OFFSET = _DEC_OFFSET + len(DECADES)
_POP_OFFSET = _DUR_OFFSET + len(DURATION_BUCKETS)


def _emotion_bucket(emotion: Optional[str]) -> int:
    if not emotion:
        return EMOTIONS.index("neutral")
    e = emotion.strip().lower()
    if e in EMOTIONS:
        return EMOTIONS.index(e)
    return EMOTIONS.index("neutral")


_YEAR_RE = re.compile(r"(\d{4})")


def _decade_bucket(release_date: Optional[str]) -> int:
    if not release_date:
        return DECADES.index("pre1960")
    m = _YEAR_RE.search(str(release_date))
    if not m:
        return DECADES.index("pre1960")
    try:
        year = int(m.group(1))
    except ValueError:
        return DECADES.index("pre1960")
    if year < 1960:
        return DECADES.index("pre1960")
    if year < 1970:
        return DECADES.index("60s")
    if year < 1980:
        return DECADES.index("70s")
    if year < 1990:
        return DECADES.index("80s")
    if year < 2000:
        return DECADES.index("90s")
    if year < 2010:
        return DECADES.index("2000s")
    return DECADES.index("2010plus")


def _duration_bucket(duration_ms) -> int:
    if not duration_ms:
        return DURATION_BUCKETS.index("2_4m")
    try:
        seconds = float(duration_ms) / 1000.0
    except (TypeError, ValueError):
        return DURATION_BUCKETS.index("2_4m")
    if seconds < 120:
        return DURATION_BUCKETS.index("under_2m")
    if seconds < 240:
        return DURATION_BUCKETS.index("2_4m")
    if seconds < 360:
        return DURATION_BUCKETS.index("4_6m")
    return DURATION_BUCKETS.index("over_6m")


def _popularity_bucket_for_value(popularity, sorted_pops: List[float]) -> int:
    """Quintile rank inside ``sorted_pops``. Lower-bound (`<`) semantics
    so a value at index k of an evenly-spaced list lands in bucket k."""
    if popularity is None or not sorted_pops:
        return POPULARITY_BUCKETS.index("p2")
    try:
        value = float(popularity)
    except (TypeError, ValueError):
        return POPULARITY_BUCKETS.index("p2")

    n = len(sorted_pops)
    lo, hi = 0, n
    while lo < hi:
        mid = (lo + hi) // 2
        if sorted_pops[mid] < value:
            lo = mid + 1
        else:
            hi = mid
    rank_pct = lo / n
    if rank_pct < 0.2:
        return POPULARITY_BUCKETS.index("p0")
    if rank_pct < 0.4:
        return POPULARITY_BUCKETS.index("p1")
    if rank_pct < 0.6:
        return POPULARITY_BUCKETS.index("p2")
    if rank_pct < 0.8:
        return POPULARITY_BUCKETS.index("p3")
    return POPULARITY_BUCKETS.index("p4")


def featurize(
    track: dict,
    *,
    context_emotion: Optional[str],
    sorted_pops: Optional[Sequence[float]] = None,
) -> List[float]:
    """Return the feature vector for one track in the fixed layout."""
    vec = [0.0] * FEATURE_DIM
    vec[_EMO_OFFSET + _emotion_bucket(context_emotion)] = 1.0
    vec[_DEC_OFFSET + _decade_bucket(track.get("release_date"))] = 1.0
    vec[_DUR_OFFSET + _duration_bucket(track.get("duration_ms"))] = 1.0
    vec[_POP_OFFSET + _popularity_bucket_for_value(
        track.get("popularity"), list(sorted_pops or [])
    )] = 1.0
    return vec


def featurize_batch(
    tracks: Iterable[dict],
    *,
    context_emotion: Optional[str],
) -> List[List[float]]:
    """Featurize a whole candidate list at once, list-relative popularity."""
    tracks = list(tracks)
    pops: List[float] = []
    for t in tracks:
        p = t.get("popularity")
        if p is None:
            continue
        try:
            pops.append(float(p))
        except (TypeError, ValueError):
            continue
    pops.sort()
    return [
        featurize(t, context_emotion=context_emotion, sorted_pops=pops)
        for t in tracks
    ]
