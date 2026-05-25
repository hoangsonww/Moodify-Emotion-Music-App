"""Reinforcement-learning personalization layer for the ai_ml module.

Mirrors the production code that lives in ``backend/api/`` so the
research/notebook side of the repo can experiment with the same
contracts: feature extractor, Beta-Bernoulli posterior, Thompson
Sampling re-ranker, and a per-user mood-calibration map.

Nothing in this package opens a database connection or imports Django
-- everything is pure functions over plain dicts and lists, so the
modules can be exercised from notebooks, offline backtests, or unit
tests without any service running.
"""

from . import bandit, calibration, track_features

__all__ = ["bandit", "calibration", "track_features"]
