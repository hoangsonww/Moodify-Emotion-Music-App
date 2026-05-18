"""Tests for the refactored emotion/recommendation API views.

These views proxy to the Modal inference service; the proxy calls are
mocked by the autouse ``mock_inference`` fixture in conftest.py.
"""

import pytest
from rest_framework import status
from rest_framework.test import APIRequestFactory

from api import views
from api.services.inference_client import InferenceServiceError

factory = APIRequestFactory()


class TestHealth:
    def test_health_ok(self):
        resp = views.health(factory.get("/api/health/"))
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["status"] == "ok"

    def test_health_routed(self, api_client):
        resp = api_client.get("/api/health/")
        assert resp.status_code == status.HTTP_200_OK


class TestTextEmotion:
    def test_400_if_no_text(self):
        resp = views.text_emotion(factory.post("/api/text_emotion/", data={}))
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert "error" in resp.data

    def test_200_and_payload(self):
        resp = views.text_emotion(
            factory.post("/api/text_emotion/", {"text": "I feel great"}, format="json")
        )
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["emotion"] == "neutral"
        assert isinstance(resp.data["recommendations"], list)

    @pytest.mark.parametrize("txt", ["hello", "こんにちは", "12345", "MiXeD!!!"])
    def test_various_inputs(self, txt):
        resp = views.text_emotion(factory.post("/api/text_emotion/", {"text": txt}, format="json"))
        assert resp.status_code == status.HTTP_200_OK

    def test_502_when_inference_unavailable(self, monkeypatch):
        def boom(_text):
            raise InferenceServiceError("modal down")

        monkeypatch.setattr(views, "modal_text", boom)
        resp = views.text_emotion(factory.post("/api/text_emotion/", {"text": "hi"}, format="json"))
        assert resp.status_code == status.HTTP_502_BAD_GATEWAY


class TestMusicRecommendation:
    def test_400_if_no_emotion(self):
        resp = views.music_recommendation(factory.post("/api/music_recommendation/", data={}))
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert "error" in resp.data

    def test_200_and_payload(self):
        resp = views.music_recommendation(
            factory.post("/api/music_recommendation/", {"emotion": "joy"}, format="json")
        )
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["emotion"] == "joy"
        assert isinstance(resp.data["recommendations"], list)

    @pytest.mark.parametrize("emo", ["happy", "sad", "CONFUSED", "🙂"])
    def test_various_emotions(self, emo):
        resp = views.music_recommendation(
            factory.post("/api/music_recommendation/", {"emotion": emo}, format="json")
        )
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["emotion"] == emo

    def test_502_when_inference_unavailable(self, monkeypatch):
        def boom(_emotion, _market=None):
            raise InferenceServiceError("modal down")

        monkeypatch.setattr(views, "modal_music", boom)
        resp = views.music_recommendation(
            factory.post("/api/music_recommendation/", {"emotion": "joy"}, format="json")
        )
        assert resp.status_code == status.HTTP_502_BAD_GATEWAY
