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
class TestAPIViews:
    def test_text_emotion_400_if_no_text(self):
        req = factory.post("/text_emotion/", data={})
        resp = text_emotion(req)
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert "error" in resp.data

    def test_text_emotion_200_and_payload(self):
        req = factory.post("/text_emotion/", data={"text": "hello"})
        resp = text_emotion(req)
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["emotion"] == "neutral"
        assert isinstance(resp.data["recommendations"], list)

    def test_speech_emotion_400_if_no_file(self):
        req = factory.post("/speech_emotion/", data={})
        resp = speech_emotion(req)
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert "error" in resp.data

    def test_speech_emotion_200_with_wav_file(self, tmp_path):
        # write minimal WAV header
        wav = tmp_path / "t.wav"
        wav.write_bytes(b"RIFF....WAVEfmt ")
        content = wav.read_bytes()
        f = SimpleUploadedFile("t.wav", content, content_type="audio/wav")

        req = factory.post("/speech_emotion/", data={"file": f}, format="multipart")
        resp = speech_emotion(req)
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["emotion"] == "neutral"

    def test_facial_emotion_401_if_not_authenticated(self):
        img = SimpleUploadedFile("i.jpg", b"\xff\xd8\xff", content_type="image/jpeg")
        req = factory.post("/facial_emotion/", data={"file": img}, format="multipart")
        resp = facial_emotion(req)
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_facial_emotion_200_if_authenticated(self):
        user = User.objects.create_user(username="u", password="p")
        img = SimpleUploadedFile("i.jpg", b"\xff\xd8\xff", content_type="image/jpeg")
        req = factory.post("/facial_emotion/", data={"file": img}, format="multipart")
        force_authenticate(req, user=user)
        resp = facial_emotion(req)
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["emotion"] == "neutral"

    def test_music_recommendation_400_if_no_emotion(self):
        req = factory.post("/music_recommendation/", data={})
        resp = music_recommendation(req)
        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert "error" in resp.data

    def test_music_recommendation_200_and_payload(self):
        req = factory.post("/music_recommendation/", data={"emotion": "anything"})
        resp = music_recommendation(req)
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["emotion"] == "anything"
        assert isinstance(resp.data["recommendations"], list)

    @pytest.mark.parametrize("txt", [
        "hello",
        "こんにちは",
        "12345",
        "Mixed CASE and punctuation!!!"
    ])
    def test_text_emotion_various_inputs(self, txt):
        req = factory.post("/text_emotion/", data={"text": txt})
        resp = text_emotion(req)
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["emotion"] == "neutral"

    # text_emotion: repeated error-case loops
    def test_text_emotion_error_repeats(self):
        for _ in range(3):
            req = factory.post("/text_emotion/", data={})
            resp = text_emotion(req)
            assert resp.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.parametrize("hdr", [
        b"RIFF....WAVEfmt ",
        b"RIFF\x00\x00\x00\x00WAVEfmt ",
    ])
    def test_speech_emotion_header_variants(self, tmp_path, hdr):
        wav = tmp_path / "v.wav"
        wav.write_bytes(hdr)
        f = SimpleUploadedFile("v.wav", wav.read_bytes(), content_type="audio/wav")
        req = factory.post("/speech_emotion/", data={"file": f}, format="multipart")
        resp = speech_emotion(req)
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["emotion"] == "neutral"

    def test_speech_emotion_error_repeats(self):
        for _ in range(3):
            req = factory.post("/speech_emotion/", data={})
            resp = speech_emotion(req)
            assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_facial_emotion_two_requests_same_user(self):
        user = User.objects.create_user("repeat", "r@example.com", "pw")
        img = SimpleUploadedFile("i3.jpg", b"\xff\xd8\xff", content_type="image/jpeg")
        for _ in range(2):
            req = factory.post("/facial_emotion/", data={"file": img}, format="multipart")
            force_authenticate(req, user=user)
            resp = facial_emotion(req)
            assert resp.status_code == status.HTTP_200_OK
            assert resp.data["emotion"] == "neutral"

    @pytest.mark.parametrize("emo", ["happy", "sad", "CONFUSED", "🙂"])
    def test_music_recommendation_various_emotions(self, emo):
        req = factory.post("/music_recommendation/", data={"emotion": emo})
        resp = music_recommendation(req)
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["emotion"] == emo

    def test_music_recommendation_error_repeats(self):
        for _ in range(3):
            req = factory.post("/music_recommendation/", data={})
            resp = music_recommendation(req)
            assert resp.status_code == status.HTTP_400_BAD_REQUEST
