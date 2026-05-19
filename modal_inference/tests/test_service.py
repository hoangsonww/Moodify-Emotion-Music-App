"""End-to-end tests for the inference FastAPI app (service.build_app).

The three model objects are faked, so these tests exercise routing, auth,
validation, upload handling and error paths without torch/transformers/fer
or the model weights.
"""

import time

import jwt
import pytest
from fastapi.testclient import TestClient

import config
import service

_KEY = "shared-test-signing-key"
_SERVICE_TOKEN = "service-secret"
AUTH = {"Authorization": f"Bearer {_SERVICE_TOKEN}"}


class FakeTextModel:
    def __init__(self, loaded=True):
        self.loaded = loaded

    def predict(self, text):
        return "joy"


class _Result:
    def __init__(self, emotion, degraded=False):
        self.emotion = emotion
        self.degraded = degraded


class FakeMediaModel:
    def __init__(self, loaded=True, emotion="sadness", degraded=False):
        self.loaded = loaded
        self._result = _Result(emotion, degraded)

    def predict(self, path):
        return self._result


@pytest.fixture(autouse=True)
def _configure(monkeypatch):
    monkeypatch.setattr(config, "MODAL_SERVICE_TOKEN", _SERVICE_TOKEN)
    monkeypatch.setattr(config, "JWT_SIGNING_KEY", _KEY)
    # Never hit real Spotify.
    monkeypatch.setattr(service, "get_music_recommendation", lambda *a, **k: [])


def _client(text=None, speech=None, facial=None):
    return TestClient(
        build_or_default(text, speech, facial),
        raise_server_exceptions=True,
    )


def build_or_default(text, speech, facial):
    return service.build_app(
        text or FakeTextModel(),
        speech or FakeMediaModel(),
        facial or FakeMediaModel(emotion="anger"),
    )


class TestHealth:
    def test_health_reports_loaded_models(self):
        resp = _client().get("/health")
        assert resp.status_code == 200
        assert resp.json()["models_loaded"] == {"text": True, "speech": True, "facial": True}

    def test_health_reflects_unloaded_model(self):
        resp = _client(text=FakeTextModel(loaded=False)).get("/health")
        assert resp.json()["models_loaded"]["text"] is False


class TestAuth:
    def test_text_requires_auth(self):
        resp = _client().post("/text_emotion", json={"text": "hi"})
        assert resp.status_code == 401

    def test_bad_token_rejected(self):
        resp = _client().post(
            "/text_emotion", json={"text": "hi"}, headers={"Authorization": "Bearer wrong"}
        )
        assert resp.status_code == 401

    def test_user_jwt_accepted(self):
        token = jwt.encode(
            {"sub": "u1", "type": "access", "exp": int(time.time()) + 60}, _KEY, algorithm="HS256"
        )
        resp = _client().post(
            "/text_emotion", json={"text": "hi"}, headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200


class TestTextEmotion:
    def test_success(self):
        resp = _client().post("/text_emotion", json={"text": "I am happy"}, headers=AUTH)
        assert resp.status_code == 200
        assert resp.json()["emotion"] == "joy"

    def test_empty_text_rejected(self):
        resp = _client().post("/text_emotion", json={"text": ""}, headers=AUTH)
        assert resp.status_code == 422

    def test_missing_body_rejected(self):
        resp = _client().post("/text_emotion", json={}, headers=AUTH)
        assert resp.status_code == 422

    def test_unloaded_model_degrades_gracefully(self):
        resp = _client(text=FakeTextModel(loaded=False)).post(
            "/text_emotion", json={"text": "hi"}, headers=AUTH
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["degraded"] is True
        assert body["emotion"]


class TestMusicRecommendation:
    def test_success(self):
        resp = _client().post("/music_recommendation", json={"emotion": "joy"}, headers=AUTH)
        assert resp.status_code == 200
        assert resp.json()["emotion"] == "joy"

    def test_with_market(self):
        resp = _client().post(
            "/music_recommendation", json={"emotion": "joy", "market": "US"}, headers=AUTH
        )
        assert resp.status_code == 200
        assert resp.json()["market"] == "US"


class TestMediaEndpoints:
    def test_speech_success(self):
        resp = _client().post(
            "/speech_emotion", files={"file": ("a.wav", b"audio-bytes", "audio/wav")}, headers=AUTH
        )
        assert resp.status_code == 200
        assert resp.json()["emotion"] == "sadness"

    def test_facial_success(self):
        resp = _client().post(
            "/facial_emotion", files={"file": ("a.jpg", b"image-bytes", "image/jpeg")}, headers=AUTH
        )
        assert resp.status_code == 200
        assert resp.json()["emotion"] == "anger"

    def test_speech_requires_file(self):
        resp = _client().post("/speech_emotion", headers=AUTH)
        assert resp.status_code == 422

    def test_empty_upload_degrades_gracefully(self):
        resp = _client().post(
            "/speech_emotion", files={"file": ("a.wav", b"", "audio/wav")}, headers=AUTH
        )
        assert resp.status_code == 200
        assert resp.json()["degraded"] is True

    def test_oversized_upload_degrades_gracefully(self, monkeypatch):
        monkeypatch.setattr(service, "MAX_UPLOAD_BYTES", 10)
        resp = _client().post(
            "/speech_emotion",
            files={"file": ("a.wav", b"x" * 50, "audio/wav")},
            headers=AUTH,
        )
        assert resp.status_code == 200
        assert resp.json()["degraded"] is True

    def test_degraded_flag_propagates(self):
        resp = _client(speech=FakeMediaModel(emotion="neutral", degraded=True)).post(
            "/speech_emotion", files={"file": ("a.wav", b"bytes", "audio/wav")}, headers=AUTH
        )
        assert resp.json()["degraded"] is True

    def test_media_requires_auth(self):
        resp = _client().post(
            "/speech_emotion", files={"file": ("a.wav", b"bytes", "audio/wav")}
        )
        assert resp.status_code == 401

    def test_unloaded_media_model_degrades_gracefully(self):
        resp = _client(facial=FakeMediaModel(loaded=False)).post(
            "/facial_emotion", files={"file": ("a.jpg", b"bytes", "image/jpeg")}, headers=AUTH
        )
        assert resp.status_code == 200
        assert resp.json()["degraded"] is True
