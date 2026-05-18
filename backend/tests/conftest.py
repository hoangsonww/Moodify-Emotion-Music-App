"""Pytest configuration for the Moodify backend.

After the ML-inference refactor the Django tier no longer imports any ML
code -- it proxies to the Modal service. Tests therefore mock the inference
client instead of stubbing torch/transformers/etc.
"""

import os

import django
import pytest

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()


@pytest.fixture(autouse=True)
def mock_inference(monkeypatch):
    """Replace the Modal proxy calls with deterministic stubs."""
    from api import views

    monkeypatch.setattr(
        views,
        "modal_text",
        lambda text: {"emotion": "neutral", "recommendations": []},
    )
    monkeypatch.setattr(
        views,
        "modal_music",
        lambda emotion, market=None: {
            "emotion": emotion,
            "market": market,
            "recommendations": [],
        },
    )
