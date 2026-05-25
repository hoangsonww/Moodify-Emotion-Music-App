"""Pytest configuration for ai_ml tests.

Ensures the repo root is importable so `from ai_ml.src.rl import ...`
works whether pytest is invoked from the repo root or from
``ai_ml/`` directly.
"""

from __future__ import annotations

import os
import sys

_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)
