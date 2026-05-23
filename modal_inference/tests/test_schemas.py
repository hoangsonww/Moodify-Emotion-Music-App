"""Tests for the Pydantic request/response models (schemas.py)."""

import pytest
from pydantic import ValidationError

from schemas import (
    EmotionResponse,
    HealthResponse,
    MusicRecommendationRequest,
    TextEmotionRequest,
    Track,
)


def test_text_request_accepts_valid_text():
    assert TextEmotionRequest(text="hello").text == "hello"


def test_text_request_rejects_empty_text():
    with pytest.raises(ValidationError):
        TextEmotionRequest(text="")


def test_text_request_rejects_overlong_text():
    with pytest.raises(ValidationError):
        TextEmotionRequest(text="x" * 5001)


def test_music_request_defaults_history_to_empty():
    assert MusicRecommendationRequest(emotion="joy").history == []


def test_music_request_accepts_history():
    req = MusicRecommendationRequest(emotion="joy", history=["sad", "calm"])
    assert req.history == ["sad", "calm"]


def test_music_request_rejects_overlong_history():
    with pytest.raises(ValidationError):
        MusicRecommendationRequest(emotion="joy", history=["x"] * 51)


def test_emotion_response_defaults():
    resp = EmotionResponse(emotion="joy")
    assert resp.recommendations == []
    assert resp.degraded is False
    assert resp.market is None


def test_emotion_response_coerces_track_dicts():
    resp = EmotionResponse(
        emotion="joy",
        recommendations=[{"name": "Song", "artist": "Artist"}],
    )
    assert isinstance(resp.recommendations[0], Track)


def test_track_allows_missing_optional_fields():
    track = Track(name="Song", artist="Artist")
    assert track.preview_url is None
    assert track.external_url is None


def test_health_response_shape():
    resp = HealthResponse(status="ok", models_loaded={"text": True})
    assert resp.status == "ok"
    assert resp.models_loaded["text"] is True
