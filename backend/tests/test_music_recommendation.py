# import pytest
# from rest_framework import status
#
# pytestmark = pytest.mark.django_db
#
# def test_music_recommendation_requires_emotion(api_client):
#     resp = api_client.post("/music_recommendation/", data={})
#     assert resp.status_code == status.HTTP_400_BAD_REQUEST
#
# def test_music_recommendation_happy_path(api_client):
#     resp = api_client.post("/music_recommendation/", data={"emotion": "anything"})
#     assert resp.status_code == status.HTTP_200_OK
#     data = resp.json()
#     assert data.get("emotion") == "anything"
#     assert "recommendations" in data
#     assert isinstance(data["recommendations"], list)
