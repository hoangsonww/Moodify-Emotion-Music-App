# import pytest
# from rest_framework import status
# from django.contrib.auth.models import User
# from django.core.files.uploadedfile import SimpleUploadedFile
#
# pytestmark = pytest.mark.django_db
#
# def test_facial_emotion_unauthenticated(api_client):
#     img = SimpleUploadedFile("i.jpg", b"\xff\xd8\xff", content_type="image/jpeg")
#     resp = api_client.post("/facial_emotion/", {"file": img}, format="multipart")
#     assert resp.status_code == status.HTTP_401_UNAUTHORIZED
#
# def test_facial_emotion_happy_path(api_client):
#     user = User.objects.create_user("u", "u@example.com", "pw")
#     api_client.force_authenticate(user=user)
#     img = SimpleUploadedFile("i.jpg", b"\xff\xd8\xff", content_type="image/jpeg")
#     resp = api_client.post("/facial_emotion/", {"file": img}, format="multipart")
#     assert resp.status_code == status.HTTP_200_OK
#     data = resp.json()
#     assert "emotion" in data
#     assert isinstance(data["recommendations"], list)
