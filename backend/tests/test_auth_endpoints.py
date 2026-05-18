"""End-to-end tests for the authentication endpoints (users app)."""

from api.models import UserProfile
from users.documents import User


class TestRegister:
    def test_success_creates_user_and_profile(self, api_client):
        resp = api_client.post(
            "/users/register/",
            {"username": "newbie", "password": "password123", "email": "n@example.com"},
            format="json",
        )
        assert resp.status_code == 201
        assert User.objects(username="newbie").first() is not None
        assert UserProfile.objects(username="newbie").first() is not None

    def test_missing_fields_rejected(self, api_client):
        resp = api_client.post("/users/register/", {"username": "x"}, format="json")
        assert resp.status_code == 400

    def test_short_password_rejected(self, api_client):
        resp = api_client.post(
            "/users/register/",
            {"username": "x", "password": "short", "email": "x@example.com"},
            format="json",
        )
        assert resp.status_code == 400

    def test_duplicate_username_conflict(self, api_client, make_user):
        make_user(username="taken")
        resp = api_client.post(
            "/users/register/",
            {"username": "taken", "password": "password123", "email": "t@example.com"},
            format="json",
        )
        assert resp.status_code == 409


class TestLogin:
    def test_success_returns_tokens(self, api_client, make_user):
        make_user(username="bob", password="password123")
        resp = api_client.post(
            "/users/login/", {"username": "bob", "password": "password123"}, format="json"
        )
        assert resp.status_code == 200
        assert "access" in resp.data and "refresh" in resp.data

    def test_wrong_password_rejected(self, api_client, make_user):
        make_user(username="bob", password="password123")
        resp = api_client.post(
            "/users/login/", {"username": "bob", "password": "nope"}, format="json"
        )
        assert resp.status_code == 401

    def test_unknown_user_rejected(self, api_client):
        resp = api_client.post(
            "/users/login/", {"username": "ghost", "password": "password123"}, format="json"
        )
        assert resp.status_code == 401


class TestTokenRefresh:
    def test_success(self, api_client, make_user):
        from users.tokens import issue_tokens

        tokens = issue_tokens(make_user())
        resp = api_client.post(
            "/users/token/refresh/", {"refresh": tokens["refresh"]}, format="json"
        )
        assert resp.status_code == 200
        assert "access" in resp.data

    def test_access_token_not_accepted_as_refresh(self, api_client, make_user):
        from users.tokens import issue_tokens

        tokens = issue_tokens(make_user())
        resp = api_client.post(
            "/users/token/refresh/", {"refresh": tokens["access"]}, format="json"
        )
        assert resp.status_code == 401

    def test_garbage_rejected(self, api_client):
        resp = api_client.post("/users/token/refresh/", {"refresh": "junk"}, format="json")
        assert resp.status_code == 401


class TestValidateToken:
    def test_authenticated_ok(self, auth_client):
        resp = auth_client.get("/users/validate_token/")
        assert resp.status_code == 200

    def test_unauthenticated_rejected(self, api_client):
        resp = api_client.get("/users/validate_token/")
        assert resp.status_code in (401, 403)


class TestVerifyAndReset:
    def test_verify_match(self, api_client, make_user):
        make_user(username="carol", email="carol@example.com")
        resp = api_client.post(
            "/users/verify-username-email/",
            {"username": "carol", "email": "carol@example.com"},
            format="json",
        )
        assert resp.status_code == 200

    def test_verify_no_match(self, api_client, make_user):
        make_user(username="carol", email="carol@example.com")
        resp = api_client.post(
            "/users/verify-username-email/",
            {"username": "carol", "email": "wrong@example.com"},
            format="json",
        )
        assert resp.status_code == 404

    def test_reset_password_then_login(self, api_client, make_user):
        make_user(username="dave", password="oldpassword1")
        reset = api_client.post(
            "/users/reset-password/",
            {"username": "dave", "new_password": "brandnewpass1"},
            format="json",
        )
        assert reset.status_code == 200

        login = api_client.post(
            "/users/login/", {"username": "dave", "password": "brandnewpass1"}, format="json"
        )
        assert login.status_code == 200

    def test_reset_unknown_user(self, api_client):
        resp = api_client.post(
            "/users/reset-password/",
            {"username": "ghost", "new_password": "brandnewpass1"},
            format="json",
        )
        assert resp.status_code == 404

    def test_reset_short_password(self, api_client, make_user):
        make_user(username="dave")
        resp = api_client.post(
            "/users/reset-password/",
            {"username": "dave", "new_password": "short"},
            format="json",
        )
        assert resp.status_code == 400
