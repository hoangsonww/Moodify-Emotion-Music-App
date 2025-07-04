# import pytest
# from rest_framework import status
#
# pytestmark = pytest.mark.django_db
#
# def test_text_emotion_requires_text(api_client):
#     resp = api_client.post("/text_emotion/", data={})
#     assert resp.status_code == status.HTTP_400_BAD_REQUEST
#
# def test_text_emotion_happy_path(api_client):
#     resp = api_client.post("/text_emotion/", data={"text": "anything"})
#     assert resp.status_code == status.HTTP_200_OK
#     data = resp.json()
#     assert "emotion" in data
#     assert "recommendations" in data
#     assert isinstance(data["recommendations"], list)
