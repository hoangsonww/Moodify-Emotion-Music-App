"""Thompson Sampling contextual bandit for music re-ranking.

Beta-Bernoulli posterior over the fixed-order feature axes defined in
``track_features.py``. Each axis carries ``(alpha, beta)`` where alpha
counts positive (like + open) attribution and beta counts negative
(unlike). The per-track score is the dot product between the
feature vector and a Thompson-sampled per-axis Bernoulli probability.

Cold-start guarantee
--------------------
* Empty posterior -> returns input order unchanged.
* Total event count below ``COLD_START_MIN_EVENTS`` -> returns input
  order unchanged.

That's the "identity-when-cold" property: a new user (or a user with
too little signal) sees exactly what the EWMA+Markov base scorer
produced. The bandit can never inject, drop, or invent tracks -- it
can only reorder.

Reward weights match the plan:

  +1.0  like
  +0.5  open_deezer
  -1.0  unlike

A negative signal credits the *beta* column for every active feature;
a positive signal credits *alpha*. Per-user posterior caps the gain at
one Beta unit per active feature per event -- no cross-user influence,
no compounding.
"""

from __future__ import annotations

import logging
import random
from typing import Sequence

from . import track_features as tf

logger = logging.getLogger(__name__)

# Below this many events, the user is "cold" and the bandit no-ops. 20
# is the plan's threshold; lowered/raised at the per-deploy level via a
# Django setting if needed (kept hard-coded for now -- one knob is one
# knob).
COLD_START_MIN_EVENTS = 20

# Reward weights per signal. Matches the plan exactly.
WEIGHTS = {
    "like": 1.0,
    "unlike": 1.0,
    "open_deezer": 0.5,
}

# Beta(1, 1) is the uniform prior on a Bernoulli; both pseudo-counts
# start at 1 so an unseen axis samples ~U(0,1) (high variance,
# encourages exploration).
PRIOR_ALPHA = 1.0
PRIOR_BETA = 1.0


# ---------------------------------------------------------------------------
# Posterior storage helpers
# ---------------------------------------------------------------------------
def _empty_arrays() -> tuple[list[float], list[float]]:
    """Fresh alpha/beta arrays sized to the current feature layout."""
    return [PRIOR_ALPHA] * tf.FEATURE_DIM, [PRIOR_BETA] * tf.FEATURE_DIM


def _read_posterior(taste_profile: dict | None) -> tuple[list[float], list[float], int]:
    """Decode the stored dict into (alpha, beta, events)."""
    if not taste_profile:
        a, b = _empty_arrays()
        return a, b, 0

    raw_alpha = taste_profile.get("alpha") or []
    raw_beta = taste_profile.get("beta") or []
    events = int(taste_profile.get("events", 0) or 0)

    # If the stored vector is shorter than the current layout, pad with
    # the prior (forward-compatible if we ever extend the feature
    # vector). If it's longer, truncate -- safer than silently using a
    # too-long vector against the wrong axes.
    alpha = [float(x) for x in raw_alpha[: tf.FEATURE_DIM]]
    beta = [float(x) for x in raw_beta[: tf.FEATURE_DIM]]
    while len(alpha) < tf.FEATURE_DIM:
        alpha.append(PRIOR_ALPHA)
    while len(beta) < tf.FEATURE_DIM:
        beta.append(PRIOR_BETA)
    return alpha, beta, events


def _write_posterior(alpha: Sequence[float], beta: Sequence[float], events: int) -> dict:
    """Encode (alpha, beta, events) for Mongo storage."""
    return {
        "alpha": [float(x) for x in alpha],
        "beta": [float(x) for x in beta],
        "events": int(events),
    }


# ---------------------------------------------------------------------------
# Posterior update -- called by /api/feedback/ on every track signal
# ---------------------------------------------------------------------------
def update_posterior(
    taste_profile: dict | None,
    features: Sequence[float],
    signal: str,
) -> dict:
    """Return a fresh taste_profile dict with the signal applied.

    Does not mutate the input. Unknown signals are a no-op (defence in
    depth -- the endpoint validator already rejects them).
    """
    if signal not in WEIGHTS:
        return taste_profile or _write_posterior(*_empty_arrays(), events=0)

    if len(features) != tf.FEATURE_DIM:
        logger.warning(
            "update_posterior: feature dim mismatch (got %d expected %d) -- skipping",
            len(features), tf.FEATURE_DIM,
        )
        return taste_profile or _write_posterior(*_empty_arrays(), events=0)

    alpha, beta, events = _read_posterior(taste_profile)
    w = WEIGHTS[signal]

    for i, f in enumerate(features):
        if f == 0:
            continue
        # ``f`` is 0/1 here, but multiplying by it keeps the math
        # honest if we ever swap in real-valued features.
        if signal == "unlike":
            beta[i] += w * f
        else:
            alpha[i] += w * f

    return _write_posterior(alpha, beta, events + 1)


# ---------------------------------------------------------------------------
# Re-ranker -- called by /api/music_recommendation/ on every fetch
# ---------------------------------------------------------------------------
def _beta_sample(alpha: float, beta: float, rng: random.Random) -> float:
    """Draw one sample from Beta(alpha, beta) using the gamma trick.

    ``random.betavariate`` would work too; using a tiny wrapper makes
    the call site easier to monkeypatch from tests for deterministic
    re-rank verification.
    """
    return rng.betavariate(max(alpha, 1e-6), max(beta, 1e-6))


def rerank(
    tracks: list[dict],
    *,
    taste_profile: dict | None,
    context_emotion: str | None,
    rng: random.Random | None = None,
) -> list[dict]:
    """Return ``tracks`` re-ordered by Thompson-sampled posterior score.

    Identity-when-cold: if the user has fewer than
    ``COLD_START_MIN_EVENTS`` recorded signals, or the input list is
    too short to bother, return the input unchanged.
    """
    if not tracks or len(tracks) < 2:
        return list(tracks)

    alpha, beta, events = _read_posterior(taste_profile)
    if events < COLD_START_MIN_EVENTS:
        return list(tracks)

    rng = rng or random.Random()

    # Sample once per axis per call -- not per (track, axis). Thompson
    # Sampling correctness needs one fresh sample per *decision* and
    # the decision here is "order this batch", so one sample per axis
    # ranks every candidate against the same draw. This is the
    # standard contextual-bandit Thompson trick.
    sampled_p = [_beta_sample(a, b, rng) for a, b in zip(alpha, beta)]

    feature_vectors = tf.featurize_batch(tracks, context_emotion=context_emotion)

    scored: list[tuple[float, int, dict]] = []
    for idx, (track, fv) in enumerate(zip(tracks, feature_vectors)):
        # Linear score: sum of sampled_p[i] over active features. With
        # 4 active features per track (one per axis) this is at most
        # 4.0, at least 0.0.
        score = sum(p * f for p, f in zip(sampled_p, fv))
        # Negate for descending sort; idx as the tie-breaker preserves
        # the original order whenever scores tie (bandit can't reorder
        # what it can't distinguish).
        scored.append((-score, idx, track))

    scored.sort(key=lambda triple: (triple[0], triple[1]))
    return [triple[2] for triple in scored]


# Convenience export for testing / future inspection.
__all__ = [
    "COLD_START_MIN_EVENTS",
    "WEIGHTS",
    "update_posterior",
    "rerank",
]
