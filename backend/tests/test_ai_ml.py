import io
import tempfile
import mimetypes

import pytest
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APIRequestFactory, force_authenticate
from django.core.files.uploadedfile import SimpleUploadedFile

from api.views import (
    text_emotion,
    speech_emotion,
    facial_emotion,
    music_recommendation,
)

factory = APIRequestFactory()

@pytest.mark.django_db
class TestAPIEndpoints:

    def test_text_emotion_rejects_empty_payload(self):
        req = factory.post("/text_emotion/", data={})
        resp = text_emotion(req)
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert "error" in resp.data

    def test_text_emotion_handles_valid_text(self):
        req = factory.post("/text_emotion/", data={"text": "hello world"})
        resp = text_emotion(req)
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["emotion"] == "neutral"
        assert isinstance(resp.data["recommendations"], list)

    @pytest.mark.parametrize("input_text", [
        "foo",
        "¡Hola!",
        "123abc",
        "Mixed-CASE?"
    ])
    def test_text_emotion_variety(self, input_text):
        req = factory.post("/text_emotion/", data={"text": input_text})
        resp = text_emotion(req)
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["emotion"] == "neutral"

    def test_text_emotion_multiple_failures(self):
        for _ in range(2):
            req = factory.post("/text_emotion/", data={"text": ""})
            resp = text_emotion(req)
            assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_speech_emotion_no_file_error(self):
        req = factory.post("/speech_emotion/", data={})
        resp = speech_emotion(req)
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert "error" in resp.data

    @pytest.mark.parametrize("header", [
        b"RIFF....WAVEfmt ",
        b"RIFF\x00\x00\x00\x00WAVEfmt "
    ])
    def test_speech_emotion_accepts_wav_headers(self, tmp_path, header):
        fpath = tmp_path / "sound.wav"
        fpath.write_bytes(header)
        content = fpath.read_bytes()
        f = SimpleUploadedFile("sound.wav", content, content_type="audio/wav")
        req = factory.post("/speech_emotion/", data={"file": f}, format="multipart")
        resp = speech_emotion(req)
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["emotion"] == "neutral"

    def test_speech_emotion_repeated_failures(self):
        for _ in range(2):
            req = factory.post("/speech_emotion/", data={})
            resp = speech_emotion(req)
            assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_facial_emotion_requires_authentication(self):
        img = SimpleUploadedFile("face.jpg", b"\xff\xd8\xff", content_type="image/jpeg")
        req = factory.post("/facial_emotion/", data={"file": img}, format="multipart")
        resp = facial_emotion(req)
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_facial_emotion_success_for_user(self):
        user = User.objects.create_user("tester", "t@test.com", "pw")
        img = SimpleUploadedFile("face.jpg", b"\xff\xd8\xff", content_type="image/jpeg")
        req = factory.post("/facial_emotion/", data={"file": img}, format="multipart")
        force_authenticate(req, user=user)
        resp = facial_emotion(req)
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["emotion"] == "neutral"

    def test_facial_emotion_double_request(self):
        user = User.objects.create_user("dupe", "d@ex.com", "pw")
        img = SimpleUploadedFile("i.jpg", b"\xff\xd8\xff", content_type="image/jpeg")
        for _ in range(2):
            req = factory.post("/facial_emotion/", data={"file": img}, format="multipart")
            force_authenticate(req, user=user)
            resp = facial_emotion(req)
            assert resp.status_code == status.HTTP_200_OK

    def test_music_recommendation_missing_emotion(self):
        req = factory.post("/music_recommendation/", data={})
        resp = music_recommendation(req)
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert "error" in resp.data

    @pytest.mark.parametrize("emotion_value", ["sad", "HAPPY", "🤖"])
    def test_music_recommendation_various(self, emotion_value):
        req = factory.post("/music_recommendation/", data={"emotion": emotion_value})
        resp = music_recommendation(req)
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["emotion"] == emotion_value

    def test_music_recommendation_error_repeat(self):
        for _ in range(2):
            req = factory.post("/music_recommendation/", data={})
            resp = music_recommendation(req)
            assert resp.status_code == status.HTTP_400_BAD_REQUEST


# Minimal AI-ML stubs tests

def test_text_emotion_integration_stub():
    resp = text_emotion(factory.post("/text_emotion/", data={"text": "anything"}))
    assert resp.data["recommendations"] == []

def test_speech_emotion_integration_stub(tmp_path):
    fpath = tmp_path / "a.wav"
    fpath.write_bytes(b"RIFF....WAVEfmt ")
    f = SimpleUploadedFile("a.wav", fpath.read_bytes(), content_type="audio/wav")
    resp = speech_emotion(factory.post("/speech_emotion/", data={"file": f}, format="multipart"))
    assert resp.data["emotion"] == "neutral"

@pytest.mark.django_db
def test_facial_emotion_integration_stub_auth(tmp_path):
    user = User.objects.create_user("ai", "ai@test.com", "pw")
    img = SimpleUploadedFile("ai.jpg", b"\xff\xd8\xff", content_type="image/jpeg")
    req = factory.post("/facial_emotion/", data={"file": img}, format="multipart")
    force_authenticate(req, user=user)
    resp = facial_emotion(req)
    assert "emotion" in resp.data

def test_music_recommendation_integration_stub():
    resp = music_recommendation(factory.post("/music_recommendation/", data={"emotion": "x"}))
    assert isinstance(resp.data["recommendations"], list)
