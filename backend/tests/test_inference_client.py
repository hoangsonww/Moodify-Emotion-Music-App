"""Tests for the Modal inference HTTP client (api/services/inference_client.py)."""

import pytest
import requests

from api.services import inference_client
from api.services.inference_client import InferenceServiceError


class _FakeResponse:
    def __init__(self, payload, status=200):
        self._payload = payload
        self.status_code = status

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f"status {self.status_code}")

    def json(self):
        return self._payload


@pytest.fixture(autouse=True)
def _fast_retries(monkeypatch):
    """Skip the retry backoff sleep so tests stay fast."""
    monkeypatch.setattr(inference_client.time, "sleep", lambda _s: None)


def test_post_raises_when_url_not_configured(settings):
    settings.MODAL_INFERENCE_URL = ""
    with pytest.raises(InferenceServiceError):
        inference_client.text_emotion("hello")


def test_text_emotion_returns_payload(settings, monkeypatch):
    settings.MODAL_INFERENCE_URL = "https://modal.example"
    captured = {}

    def fake_post(url, json=None, headers=None, timeout=None):
        captured["url"] = url
        captured["json"] = json
        captured["headers"] = headers
        return _FakeResponse({"emotion": "joy", "recommendations": []})

    monkeypatch.setattr(inference_client.requests, "post", fake_post)

    result = inference_client.text_emotion("I am happy")
    assert result == {"emotion": "joy", "recommendations": []}
    assert captured["url"] == "https://modal.example/text_emotion"
    assert captured["json"] == {"text": "I am happy"}
    assert captured["headers"]["Authorization"].startswith("Bearer ")


def test_music_recommendation_returns_payload(settings, monkeypatch):
    settings.MODAL_INFERENCE_URL = "https://modal.example"
    monkeypatch.setattr(
        inference_client.requests,
        "post",
        lambda *a, **k: _FakeResponse({"emotion": "sad", "recommendations": []}),
    )
    result = inference_client.music_recommendation("sad", market="US")
    assert result["emotion"] == "sad"


def test_post_retries_then_raises(settings, monkeypatch):
    settings.MODAL_INFERENCE_URL = "https://modal.example"
    calls = {"n": 0}

    def always_fails(*a, **k):
        calls["n"] += 1
        raise requests.ConnectionError("boom")

    monkeypatch.setattr(inference_client.requests, "post", always_fails)

    with pytest.raises(InferenceServiceError):
        inference_client.text_emotion("hello")
    # initial attempt + retries
    assert calls["n"] >= 2


def test_post_raises_on_http_error(settings, monkeypatch):
    settings.MODAL_INFERENCE_URL = "https://modal.example"
    monkeypatch.setattr(
        inference_client.requests,
        "post",
        lambda *a, **k: _FakeResponse({}, status=500),
    )
    with pytest.raises(InferenceServiceError):
        inference_client.text_emotion("hello")
