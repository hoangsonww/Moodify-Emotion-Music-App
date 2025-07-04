# import pytest
# from rest_framework import status
# from django.core.files.uploadedfile import SimpleUploadedFile
#
# pytestmark = pytest.mark.django_db
#
# def test_speech_emotion_requires_file(api_client):
#     resp = api_client.post("/speech_emotion/")
#     assert resp.status_code == status.HTTP_400_BAD_REQUEST
#
# def test_speech_emotion_happy_path(api_client, tmp_path):
#     # minimal “wav” file stub
#     wav = tmp_path / "t.wav"
#     wav.write_bytes(b"RIFF....WAVEfmt ")
#     f = SimpleUploadedFile("t.wav", wav.read_bytes(), content_type="audio/wav")
#     resp = api_client.post("/speech_emotion/", {"file": f}, format="multipart")
#     assert resp.status_code == status.HTTP_200_OK
#     data = resp.json()
#     assert "emotion" in data
#     assert isinstance(data["recommendations"], list)
