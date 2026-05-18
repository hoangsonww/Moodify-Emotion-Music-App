"""Tests for modal_inference/config.py."""

import pytest

import config


def test_require_returns_value(monkeypatch):
    monkeypatch.setenv("SOME_VAR", "value")
    assert config.require("SOME_VAR") == "value"


def test_require_raises_when_missing(monkeypatch):
    monkeypatch.delenv("DEFINITELY_MISSING_VAR", raising=False)
    with pytest.raises(RuntimeError):
        config.require("DEFINITELY_MISSING_VAR")


def test_text_emotion_labels_are_five():
    assert config.TEXT_EMOTION_LABELS == ["sadness", "joy", "love", "anger", "fear"]


def test_default_emotion_is_neutral():
    assert config.DEFAULT_EMOTION == "neutral"


def test_keep_warm_configuration():
    assert config.MIN_CONTAINERS >= 1
    assert config.SCALEDOWN_WINDOW > 0
