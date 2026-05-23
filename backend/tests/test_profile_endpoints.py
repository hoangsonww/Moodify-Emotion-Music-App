"""Tests for the user profile endpoints (users app)."""

from api.models import UserProfile
from users.documents import User


class TestUserProfile:
    def test_get_profile_authenticated(self, auth_client):
        resp = auth_client.get("/users/user/profile/")
        assert resp.status_code == 200
        assert resp.data["username"] == "alice"
        assert resp.data["email"] == "alice@example.com"
        assert resp.data["mood_history"] == []
        assert resp.data["recommendations"] == []

    def test_get_profile_unauthenticated(self, api_client):
        resp = api_client.get("/users/user/profile/")
        assert resp.status_code in (401, 403)

    def test_update_profile_changes_email(self, auth_client):
        resp = auth_client.put(
            "/users/user/profile/update/", {"email": "updated@example.com"}, format="json"
        )
        assert resp.status_code == 200
        assert User.objects(username="alice").first().email == "updated@example.com"

    def test_delete_profile_removes_user_and_profile(self, auth_client):
        resp = auth_client.delete("/users/user/profile/delete/")
        assert resp.status_code == 200
        assert User.objects(username="alice").first() is None
        assert UserProfile.objects(username="alice").first() is None
