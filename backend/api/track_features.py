"""Fixed-order feature extraction for the contextual bandit.

The bandit learns one Beta-Bernoulli posterior per *feature*, not per
track -- so a brand-new track shares posterior mass with every track
that resembles it on these axes. Keeping the axes coarse (and the
vector short) is deliberate: the posterior converges with O(features)
events, not O(tracks), and tracks are 60-at-a-time ephemeral.

The extractor only uses fields the Deezer recommender already returns:
``release_date``, ``duration_ms``, ``popularity``. Genre is omitted on
purpose -- Deezer's search result doesn't include it, and a second
network round-trip per track to fetch it would dwarf the inference
budget. The context emotion (the mood that produced the
recommendation list) is folded in so the bandit learns *per-mood*
preferences without an explicit cross product.

Vector layout (length = 22, fixed forever; appending new buckets is
safe, reordering is NOT):

  0..5    emotion one-hot   (sadness, joy, love, anger, fear, neutral)
  6..12   decade one-hot    (pre-1960s, 60s, 70s, 80s, 90s, 2000s, 2010s+)
 13..16   duration one-hot  (<2 min, 2-4, 4-6, 6+ min)
 17..21   popularity one-hot (rank quintiles within the candidate list)

The output is a list[float] of 0.0 / 1.0 -- the bandit treats it as a
soft attribution weight. Popularity buckets are computed *relative to
the candidate list* so the posterior can't get stuck on the absolute
distribution of one user's history.
"""

from __future__ import annotations

import re
from typing import Iterable

# Keep these in lockstep with feedback_views._CANONICAL_EMOTIONS / the
# Modal TEXT_EMOTION_LABELS. Order is load-bearing -- never reorder.
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


def _emotion_bucket(emotion: str | None) -> int:
    """Return the index for an emotion or the neutral slot on miss."""
    if not emotion:
        return EMOTIONS.index("neutral")
    e = emotion.strip().lower()
    if e in EMOTIONS:
        return EMOTIONS.index(e)
    return EMOTIONS.index("neutral")


_YEAR_RE = re.compile(r"(\d{4})")


def _decade_bucket(release_date: str | None) -> int:
    """Extract a 4-digit year from a Deezer release_date and bucket it.

    Deezer returns either ``YYYY-MM-DD`` or just ``YYYY``; both match
    the regex. Missing / un-parseable dates land in pre-1960 by
    convention (it's the catch-all bucket).
    """
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


def _duration_bucket(duration_ms: int | float | None) -> int:
    if not duration_ms:
        return DURATION_BUCKETS.index("2_4m")  # treat unknown as median
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


def _popularity_bucket_for_value(
    popularity: int | float | None, sorted_pops: list[float]
) -> int:
    """Bucket a popularity score relative to the candidate list.

    Quintile rank inside ``sorted_pops`` (ascending). A track in the
    bottom 20 % of this batch lands in ``p0``; top 20 % in ``p4``. The
    bucket is *list-relative* so the posterior is invariant to absolute
    popularity drift across moods (sad-pop is less popular on average
    than mainstream pop; we don't want that to bias the rating).
    """
    if popularity is None or not sorted_pops:
        return POPULARITY_BUCKETS.index("p2")  # median bucket
    try:
        value = float(popularity)
    except (TypeError, ValueError):
        return POPULARITY_BUCKETS.index("p2")

    n = len(sorted_pops)
    # Lower-bound binary search: rank = number of values STRICTLY less
    # than `value`. That gives "value X in [X, ...]" a percentile of 0
    # (top of its own bucket), which is the natural quintile mapping.
    lo, hi = 0, n
    while lo < hi:
        mid = (lo + hi) // 2
        if sorted_pops[mid] < value:
            lo = mid + 1
        else:
            hi = mid
    rank_pct = lo / n  # in [0, 1]
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
    context_emotion: str | None,
    sorted_pops: list[float] | None = None,
) -> list[float]:
    """Return the feature vector for one track in the fixed layout.

    ``sorted_pops`` is the sorted list of all popularity values in the
    candidate set, used to compute list-relative popularity buckets.
    Pass an empty list (or ``None``) for a single-track call -- the
    extractor falls back to the median bucket.
    """
    vec = [0.0] * FEATURE_DIM

    vec[_EMO_OFFSET + _emotion_bucket(context_emotion)] = 1.0

    vec[_DEC_OFFSET + _decade_bucket(track.get("release_date"))] = 1.0

    vec[_DUR_OFFSET + _duration_bucket(track.get("duration_ms"))] = 1.0

    vec[_POP_OFFSET + _popularity_bucket_for_value(
        track.get("popularity"), sorted_pops or []
    )] = 1.0

    return vec


def featurize_batch(
    tracks: Iterable[dict],
    *,
    context_emotion: str | None,
) -> list[list[float]]:
    """Featurize a whole candidate list at once.

    Pre-sorts popularity once so each per-track bucket lookup is
    O(log n) and the popularity buckets are list-relative.
    """
    tracks = list(tracks)
    pops: list[float] = []
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
