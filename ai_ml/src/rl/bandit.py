"""Thompson Sampling contextual bandit for music re-ranking.

Pure-Python mirror of ``backend/api/bandit.py`` so the ai_ml side can
backtest the same algorithm offline (replay a `track_feedback` event
log against the posterior, evaluate ranking metrics, etc.).

Storage shape -- compatible with ``UserProfile.taste_profile``:

    {
        "alpha": [float, ...],   # length = FEATURE_DIM
        "beta":  [float, ...],   # length = FEATURE_DIM
        "events": int,           # total signals seen
    }
"""

from __future__ import annotations

import logging
import random
from typing import Optional, Sequence

from . import track_features as tf


logger = logging.getLogger(__name__)


COLD_START_MIN_EVENTS = 20

WEIGHTS = {
    "like": 1.0,
    "unlike": 1.0,
    "open_deezer": 0.5,
}

PRIOR_ALPHA = 1.0
PRIOR_BETA = 1.0


def _empty_arrays():
    return [PRIOR_ALPHA] * tf.FEATURE_DIM, [PRIOR_BETA] * tf.FEATURE_DIM


def _read_posterior(taste_profile: Optional[dict]):
    if not taste_profile:
        a, b = _empty_arrays()
        return a, b, 0

    raw_alpha = taste_profile.get("alpha") or []
    raw_beta = taste_profile.get("beta") or []
    events = int(taste_profile.get("events", 0) or 0)

    alpha = [float(x) for x in raw_alpha[: tf.FEATURE_DIM]]
    beta = [float(x) for x in raw_beta[: tf.FEATURE_DIM]]
    while len(alpha) < tf.FEATURE_DIM:
        alpha.append(PRIOR_ALPHA)
    while len(beta) < tf.FEATURE_DIM:
        beta.append(PRIOR_BETA)
    return alpha, beta, events


def _write_posterior(alpha, beta, events: int) -> dict:
    return {
        "alpha": [float(x) for x in alpha],
        "beta": [float(x) for x in beta],
        "events": int(events),
    }


def update_posterior(
    taste_profile: Optional[dict],
    features: Sequence[float],
    signal: str,
) -> dict:
    """Return a fresh taste_profile dict with the signal applied.

    Pure function -- does not mutate the input. Unknown signals are a
    no-op so a malformed feedback stream doesn't poison the posterior.
    """
    if signal not in WEIGHTS:
        return taste_profile or _write_posterior(*_empty_arrays(), events=0)

    if len(features) != tf.FEATURE_DIM:
        logger.warning(
            "update_posterior: feature dim mismatch (got %d expected %d)",
            len(features), tf.FEATURE_DIM,
        )
        return taste_profile or _write_posterior(*_empty_arrays(), events=0)

    alpha, beta, events = _read_posterior(taste_profile)
    w = WEIGHTS[signal]

    for i, f in enumerate(features):
        if f == 0:
            continue
        if signal == "unlike":
            beta[i] += w * f
        else:
            alpha[i] += w * f

    return _write_posterior(alpha, beta, events + 1)


def _beta_sample(alpha: float, beta: float, rng: random.Random) -> float:
    return rng.betavariate(max(alpha, 1e-6), max(beta, 1e-6))


def rerank(
    tracks: list,
    *,
    taste_profile: Optional[dict],
    context_emotion: Optional[str],
    rng: Optional[random.Random] = None,
) -> list:
    """Return ``tracks`` re-ordered by Thompson-sampled posterior score.

    Identity-when-cold guarantee: empty / shallow posterior returns the
    input list unchanged. The bandit can only reorder; it never
    injects, drops, or invents tracks.
    """
    if not tracks or len(tracks) < 2:
        return list(tracks)

    alpha, beta, events = _read_posterior(taste_profile)
    if events < COLD_START_MIN_EVENTS:
        return list(tracks)

    rng = rng or random.Random()

    # One Thompson sample per axis per decision (the standard
    # contextual-bandit trick): every candidate is ranked against the
    # same draw, so a single decision boundary applies consistently.
    sampled_p = [_beta_sample(a, b, rng) for a, b in zip(alpha, beta)]

    feature_vectors = tf.featurize_batch(tracks, context_emotion=context_emotion)

    scored = []
    for idx, (track, fv) in enumerate(zip(tracks, feature_vectors)):
        score = sum(p * f for p, f in zip(sampled_p, fv))
        scored.append((-score, idx, track))

    scored.sort(key=lambda triple: (triple[0], triple[1]))
    return [triple[2] for triple in scored]


def replay(
    events: list,
    *,
    initial_profile: Optional[dict] = None,
) -> dict:
    """Replay an offline track_feedback log into a posterior.

    Each event is a dict ``{track, signal, context_emotion}``. Useful
    for backtests / notebook experiments: feed in a CSV-loaded list of
    rows and get back the final ``taste_profile`` that production would
    have arrived at.
    """
    profile = initial_profile
    for ev in events:
        track = ev.get("track") or {}
        signal = ev.get("signal")
        if signal not in WEIGHTS:
            continue
        ctx = ev.get("context_emotion")
        features = tf.featurize(track, context_emotion=ctx)
        profile = update_posterior(profile, features, signal)
    return profile or _write_posterior(*_empty_arrays(), events=0)


__all__ = [
    "COLD_START_MIN_EVENTS",
    "WEIGHTS",
    "PRIOR_ALPHA",
    "PRIOR_BETA",
    "update_posterior",
    "rerank",
    "replay",
]
