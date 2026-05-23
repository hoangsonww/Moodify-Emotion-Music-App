"""Tests for the MongoDB-backed DRF authenticator (users/authentication.py)."""

import time

import jwt
import pytest
from rest_framework import exceptions
from rest_framework.test import APIRequestFactory

from users.authentication import MongoJWTAuthentication
from users.tokens import issue_tokens

factory = APIRequestFactory()
auth = MongoJWTAuthentication()


def _request(header=None):
    extra = {"HTTP_AUTHORIZATION": header} if header else {}
    return factory.get("/", **extra)


def test_no_header_returns_none():
    assert auth.authenticate(_request()) is None


def test_non_bearer_header_returns_none():
    assert auth.authenticate(_request("Basic abc")) is None


def test_malformed_bearer_header_raises():
    with pytest.raises(exceptions.AuthenticationFailed):
        auth.authenticate(_request("Bearer"))


def test_valid_access_token_authenticates(make_user):
    user = make_user(username="bob")
    token = issue_tokens(user)["access"]
    result = auth.authenticate(_request(f"Bearer {token}"))
    assert result is not None
    authed_user, _ = result
    assert authed_user.username == "bob"


def test_garbage_token_raises(make_user):
    with pytest.raises(exceptions.AuthenticationFailed):
        auth.authenticate(_request("Bearer not.a.jwt"))


def test_refresh_token_rejected(make_user):
    user = make_user()
    refresh = issue_tokens(user)["refresh"]
    with pytest.raises(exceptions.AuthenticationFailed):
        auth.authenticate(_request(f"Bearer {refresh}"))


def test_expired_token_rejected(make_user):
    from django.conf import settings

    user = make_user()
    token = jwt.encode(
        {"sub": str(user.id), "type": "access", "exp": int(time.time()) - 5},
        settings.JWT_SIGNING_KEY,
        algorithm="HS256",
    )
    with pytest.raises(exceptions.AuthenticationFailed):
        auth.authenticate(_request(f"Bearer {token}"))


def test_unknown_user_rejected():
    from django.conf import settings

    token = jwt.encode(
        {"sub": "507f1f77bcf86cd799439011", "type": "access", "exp": int(time.time()) + 60},
        settings.JWT_SIGNING_KEY,
        algorithm="HS256",
    )
    with pytest.raises(exceptions.AuthenticationFailed):
        auth.authenticate(_request(f"Bearer {token}"))


def test_malformed_subject_id_rejected():
    from django.conf import settings

    token = jwt.encode(
        {"sub": "not-an-objectid", "type": "access", "exp": int(time.time()) + 60},
        settings.JWT_SIGNING_KEY,
        algorithm="HS256",
    )
    with pytest.raises(exceptions.AuthenticationFailed):
        auth.authenticate(_request(f"Bearer {token}"))
