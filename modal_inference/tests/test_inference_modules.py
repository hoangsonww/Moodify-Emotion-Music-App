"""Tests for the inference model wrappers (inference/).

These cover construction and the not-loaded guards. Actual model loading
and prediction require the ML libraries + weights and are exercised in the
deployed environment.
"""

import pytest

import config
from inference.facial_emotion import FacialEmotionModel, FacialInferenceResult
from inference.speech_emotion import SpeechEmotionModel, SpeechInferenceResult
from inference.text_emotion import TextEmotionModel


class TestTextEmotionModel:
    def test_starts_unloaded(self):
        assert TextEmotionModel().loaded is False

    def test_default_labels(self):
        assert TextEmotionModel()._labels == config.TEXT_EMOTION_LABELS

    def test_predict_before_load_raises(self):
        with pytest.raises(RuntimeError):
            TextEmotionModel().predict("hello")


class TestSpeechEmotionModel:
    def test_starts_unloaded(self):
        assert SpeechEmotionModel().loaded is False

    def test_predict_before_load_raises(self):
        with pytest.raises(RuntimeError):
            SpeechEmotionModel().predict("/tmp/whatever.wav")


class TestFacialEmotionModel:
    def test_starts_unloaded(self):
        assert FacialEmotionModel().loaded is False

    def test_predict_before_load_raises(self):
        with pytest.raises(RuntimeError):
            FacialEmotionModel().predict("/tmp/whatever.jpg")


class TestResultObjects:
    def test_speech_result_defaults(self):
        result = SpeechInferenceResult("joy")
        assert result.emotion == "joy"
        assert result.degraded is False

    def test_facial_result_degraded_flag(self):
        result = FacialInferenceResult("neutral", degraded=True)
        assert result.emotion == "neutral"
        assert result.degraded is True
