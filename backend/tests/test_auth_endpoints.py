"""End-to-end tests for the authentication endpoints (users app)."""

from unittest import mock

import pytest
from pymongo.errors import PyMongoError

from api.models import UserProfile
from users.documents import User
from users import views as users_views


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

    def test_cold_db_returns_503_not_401(self, api_client, make_user):
        # A persistent connection failure must NOT be reported as bad
        # credentials -- it gets its own 503 so the client can retry and the
        # user isn't told their (correct) password is wrong.
        make_user(username="bob", password="password123")
        with mock.patch.object(
            User, "objects", side_effect=PyMongoError("cold cluster")
        ):
            resp = api_client.post(
                "/users/login/",
                {"username": "bob", "password": "password123"},
                format="json",
            )
        assert resp.status_code == 503

    def test_cold_db_then_warm_succeeds(self, api_client, make_user):
        # The first lookup raises (cold connection); the retry succeeds once
        # the connection is warm, so the user's single sign-in click works.
        make_user(username="bob", password="password123")
        real_objects = User.objects
        calls = {"n": 0}

        def flaky(*args, **kwargs):
            calls["n"] += 1
            if calls["n"] == 1:
                raise PyMongoError("server selection timed out")
            return real_objects(*args, **kwargs)

        with mock.patch.object(users_views, "_DB_READ_BACKOFF_SECONDS", 0), \
                mock.patch.object(User, "objects", side_effect=flaky):
            resp = api_client.post(
                "/users/login/",
                {"username": "bob", "password": "password123"},
                format="json",
            )
        assert resp.status_code == 200
        assert "access" in resp.data
        assert calls["n"] == 2  # failed once, retried once, succeeded


class TestReadWithRetry:
    def test_returns_first_success_without_retrying(self):
        fn = mock.Mock(return_value="ok")
        assert users_views._read_with_retry(fn, backoff=0) == "ok"
        assert fn.call_count == 1

    def test_retries_transient_then_succeeds(self):
        fn = mock.Mock(side_effect=[PyMongoError("a"), PyMongoError("b"), "ok"])
        assert users_views._read_with_retry(fn, attempts=3, backoff=0) == "ok"
        assert fn.call_count == 3

    def test_reraises_after_exhausting_attempts(self):
        fn = mock.Mock(side_effect=PyMongoError("down"))
        with pytest.raises(PyMongoError):
            users_views._read_with_retry(fn, attempts=2, backoff=0)
        assert fn.call_count == 2

    def test_empty_result_is_not_an_error(self):
        # A query that matches nothing returns None on the first try -- it is
        # NOT retried (no exception), so a genuine wrong username stays fast.
        fn = mock.Mock(return_value=None)
        assert users_views._read_with_retry(fn, backoff=0) is None
        assert fn.call_count == 1


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
