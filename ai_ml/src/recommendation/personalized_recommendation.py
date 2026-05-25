"""End-to-end personalized recommendation pipeline (research-grade).

Three-layer stack, in apply order:

1. ``score_mood_history`` -- EWMA (recency-weighted) + first-order
   Markov over the user's mood history. Produces a `mood_affinity`
   dict and a recurring-mood label.
2. ``rank_by_quality`` -- blends a track's curated rank with its
   popularity quintile to give a "quality score" for use as the base
   ordering when there is no per-user bandit signal yet.
3. ``rerank`` (from ``ai_ml.src.rl.bandit``) -- Thompson Sampling
   contextual bandit re-rank using the user's posterior.

Each step is a pure function; chain them via ``personalized_pipeline``
or call them individually. No I/O, no Django -- safe to import from
notebooks for offline backtests.
"""

from __future__ import annotations

import math
import random
from typing import Iterable, List, Mapping, Optional, Sequence

from ai_ml.src.rl import bandit, calibration


# ---------------------------------------------------------------------------
# 1. EWMA + first-order Markov over the mood history
# ---------------------------------------------------------------------------
RECENCY_DECAY = 0.85
MARKOV_BOOST = 0.6


def score_mood_history(history: Sequence[str]) -> dict:
    """Score every distinct mood in ``history`` by recency + Markov pull.

    EWMA: each entry contributes ``RECENCY_DECAY ** (n - 1 - i)`` to
    its bucket. First-order Markov: the predicted next-mood (given the
    most recent entry) gets an extra ``MARKOV_BOOST`` mass.

    Returns a dict ``{mood: affinity}``. Empty histories -> empty dict.
    """
    history = [str(m).strip().lower() for m in (history or []) if m]
    if not history:
        return {}

    n = len(history)
    affinity: dict = {}
    for i, mood in enumerate(history):
        affinity[mood] = affinity.get(mood, 0.0) + RECENCY_DECAY ** (n - 1 - i)

    if n >= 2:
        # Build transition counts and pick the most likely next mood
        # from the last entry's row.
        transitions: dict = {}
        for prev, nxt in zip(history, history[1:]):
            row = transitions.setdefault(prev, {})
            row[nxt] = row.get(nxt, 0) + 1
        row = transitions.get(history[-1], {})
        if row:
            predicted_next = max(row.items(), key=lambda kv: kv[1])[0]
            affinity[predicted_next] = affinity.get(predicted_next, 0.0) + MARKOV_BOOST

    return affinity


def recurring_mood(affinity: Mapping[str, float], current: str) -> Optional[str]:
    """Return the top non-current mood in the affinity map, or None."""
    cur = (current or "").strip().lower()
    candidates = [(m, w) for m, w in affinity.items() if m != cur]
    if not candidates:
        return None
    candidates.sort(key=lambda kv: kv[1], reverse=True)
    return candidates[0][0]


def blend_ratio(affinity: Mapping[str, float], current: str, other: Optional[str]) -> int:
    """Adaptive interleave ratio, clamped to ``[1, 5]``.

    Mirrors the Modal implementation: how many "current" tracks the
    recommender plays between each "recurring" track.
    """
    if not other or other not in affinity or not current or current not in affinity:
        return 1
    cur = affinity[current]
    oth = affinity[other]
    if oth <= 0:
        return 1
    return max(1, min(5, round(cur / oth)))


# ---------------------------------------------------------------------------
# 2. Quality score (curated rank + popularity blend)
# ---------------------------------------------------------------------------
POPULARITY_WEIGHT = 0.2


def rank_by_quality(tracks: Sequence[dict]) -> List[dict]:
    """Reorder a track list by blended quality (curated rank + popularity).

    The input order is treated as a curated rank (index 0 = top). A
    higher popularity nudges a track upward in proportion to
    ``POPULARITY_WEIGHT``. Stable for ties.
    """
    if not tracks:
        return []
    n = len(tracks)
    scored = []
    for i, t in enumerate(tracks):
        # Curated component: 1.0 at the top, 0.0 at the bottom.
        curated = 1.0 - (i / max(1, n - 1)) if n > 1 else 1.0
        try:
            pop = float(t.get("popularity") or 0)
        except (TypeError, ValueError):
            pop = 0.0
        # Popularity is on a [0, 100] scale per Deezer; normalize.
        pop_norm = max(0.0, min(1.0, pop / 100.0))
        score = (1.0 - POPULARITY_WEIGHT) * curated + POPULARITY_WEIGHT * pop_norm
        scored.append((-score, i, t))
    scored.sort(key=lambda triple: (triple[0], triple[1]))
    return [triple[2] for triple in scored]


# ---------------------------------------------------------------------------
# 3. End-to-end pipeline
# ---------------------------------------------------------------------------
def _track_key(t: dict) -> str:
    return str(t.get("external_url") or f"{t.get('name','')}::{t.get('artist','')}")


def interleave(
    current_tracks: Sequence[dict],
    recurring_tracks: Sequence[dict],
    ratio: int = 1,
) -> List[dict]:
    """Interleave one ``recurring`` track per ``ratio`` ``current`` ones.

    Deduplicated by ``external_url`` (or by ``name||artist`` when the
    URL is missing). The current list stays the backbone. Dedup runs
    even when ``recurring_tracks`` is empty -- the function still owes
    callers a clean list of unique current tracks.
    """
    out: List[dict] = []
    seen: set = set()
    rec_iter = iter(recurring_tracks or [])
    counter = 0
    for t in current_tracks:
        k = _track_key(t)
        if k in seen:
            continue
        seen.add(k)
        out.append(t)
        counter += 1
        if ratio > 0 and counter % ratio == 0:
            for cand in rec_iter:
                ck = _track_key(cand)
                if ck in seen:
                    continue
                seen.add(ck)
                out.append(cand)
                break
    return out


def personalized_pipeline(
    *,
    detected_emotion: str,
    current_tracks: Sequence[dict],
    recurring_tracks: Optional[Sequence[dict]] = None,
    mood_history: Optional[Sequence[str]] = None,
    taste_profile: Optional[dict] = None,
    mood_calibration: Optional[Mapping[str, Mapping[str, int]]] = None,
    rng: Optional[random.Random] = None,
) -> dict:
    """Run the full personalized stack for one recommendation request.

    Returns a dict::

        {
            "emotion":        str,     # post-calibration label
            "calibrated_from": str|None,
            "recurring_mood": str|None,
            "blend_ratio":    int,
            "recommendations": list[dict],
        }
    """
    # Step 0 -- per-user mood calibration. Always applied first; downstream
    # quality / bandit steps operate on the calibrated emotion.
    calibrated = calibration.apply_calibration(detected_emotion, mood_calibration)
    calibrated_from = detected_emotion if calibrated != detected_emotion else None

    # Step 1 -- mood-history affinity + recurring mood + blend ratio.
    affinity = score_mood_history(mood_history or [])
    other = recurring_mood(affinity, calibrated)
    ratio = blend_ratio(affinity, calibrated, other)

    # Step 2 -- quality rerank of the supplied current/recurring lists,
    # then interleave.
    base = rank_by_quality(current_tracks)
    rec_base = rank_by_quality(recurring_tracks or [])
    blended = interleave(base, rec_base, ratio=ratio)

    # Step 3 -- bandit re-rank. Identity-when-cold by construction;
    # warm users see a Thompson-sampled order over the candidate set.
    final = bandit.rerank(
        list(blended),
        taste_profile=taste_profile,
        context_emotion=calibrated,
        rng=rng,
    )

    return {
        "emotion": calibrated,
        "calibrated_from": calibrated_from,
        "recurring_mood": other,
        "blend_ratio": ratio,
        "recommendations": final,
    }


__all__ = [
    "RECENCY_DECAY",
    "MARKOV_BOOST",
    "POPULARITY_WEIGHT",
    "score_mood_history",
    "recurring_mood",
    "blend_ratio",
    "rank_by_quality",
    "interleave",
    "personalized_pipeline",
]
