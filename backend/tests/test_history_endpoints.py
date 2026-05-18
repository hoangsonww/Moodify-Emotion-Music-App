"""Tests for the mood / listening / recommendation history endpoints.

These cover the CRUD behaviour plus the authentication and ownership
checks (a user must not be able to touch another user's data).
"""

import pytest

from api.models import UserProfile


def _profile_id(username):
    return str(UserProfile.objects(username=username).first().id)


@pytest.fixture
def alice_id(auth_client):
    return _profile_id("alice")


class TestMoodHistory:
    def test_post_then_get(self, auth_client, alice_id):
        post = auth_client.post(
            f"/users/mood_history/{alice_id}/", {"mood": "joy"}, format="json"
        )
        assert post.status_code == 201
        get = auth_client.get(f"/users/mood_history/{alice_id}/")
        assert get.status_code == 200
        assert get.data["mood_history"] == ["joy"]

    def test_post_requires_mood(self, auth_client, alice_id):
        resp = auth_client.post(f"/users/mood_history/{alice_id}/", {}, format="json")
        assert resp.status_code == 400

    def test_delete_entry(self, auth_client, alice_id):
        auth_client.post(f"/users/mood_history/{alice_id}/", {"mood": "joy"}, format="json")
        resp = auth_client.delete(
            f"/users/mood_history/{alice_id}/", {"mood": "joy"}, format="json"
        )
        assert resp.status_code == 200
        assert auth_client.get(f"/users/mood_history/{alice_id}/").data["mood_history"] == []

    def test_unauthenticated_rejected(self, api_client, auth_client, alice_id):
        api_client.credentials()  # clear auth
        resp = api_client.get(f"/users/mood_history/{alice_id}/")
        assert resp.status_code in (401, 403)


class TestListeningHistory:
    def test_post_then_get(self, auth_client, alice_id):
        post = auth_client.post(
            f"/users/listening_history/{alice_id}/", {"track": "Song A"}, format="json"
        )
        assert post.status_code == 201
        get = auth_client.get(f"/users/listening_history/{alice_id}/")
        assert get.data["listening_history"] == ["Song A"]

    def test_delete_entry(self, auth_client, alice_id):
        auth_client.post(
            f"/users/listening_history/{alice_id}/", {"track": "Song A"}, format="json"
        )
        resp = auth_client.delete(
            f"/users/listening_history/{alice_id}/", {"track": "Song A"}, format="json"
        )
        assert resp.status_code == 200


class TestRecommendations:
    def test_post_get_delete(self, auth_client, alice_id):
        track = {"name": "Song", "artist": "Artist", "external_url": "https://x"}
        post = auth_client.post(
            f"/users/recommendations/{alice_id}/",
            {"recommendations": [track]},
            format="json",
        )
        assert post.status_code == 201

        get = auth_client.get(f"/users/recommendations/{alice_id}/")
        assert len(get.data["recommendations"]) == 1

        delete = auth_client.delete(f"/users/recommendations/{alice_id}/")
        assert delete.status_code == 200
        assert auth_client.get(f"/users/recommendations/{alice_id}/").data["recommendations"] == []

    def test_save_endpoint(self, auth_client, alice_id):
        track = {"name": "Song", "artist": "Artist", "external_url": "https://x"}
        resp = auth_client.post(
            f"/users/recommendations/save/{alice_id}/",
            {"recommendations": [track]},
            format="json",
        )
        assert resp.status_code == 201

    def test_get_endpoint(self, auth_client, alice_id):
        resp = auth_client.get(f"/users/recommendations/get/{alice_id}/")
        assert resp.status_code == 200

    def test_delete_all_endpoint(self, auth_client, alice_id):
        resp = auth_client.delete(f"/users/recommendations/delete/{alice_id}/")
        assert resp.status_code == 200


class TestOwnershipAndValidation:
    def test_cannot_access_another_users_history(self, auth_client, make_user):
        make_user(username="mallory", email="mallory@example.com")
        mallory_id = _profile_id("mallory")
        resp = auth_client.get(f"/users/mood_history/{mallory_id}/")
        assert resp.status_code == 403

    def test_unknown_profile_id_returns_404(self, auth_client):
        resp = auth_client.get("/users/mood_history/507f1f77bcf86cd799439011/")
        assert resp.status_code == 404

    def test_invalid_profile_id_returns_404(self, auth_client):
        resp = auth_client.get("/users/mood_history/not-an-objectid/")
        assert resp.status_code == 404
