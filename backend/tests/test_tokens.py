"""Tests for JWT issuing/decoding (users/tokens.py)."""

import time

import jwt
import pytest

from users.tokens import decode_token, issue_tokens


class _FakeUser:
    id = "507f1f77bcf86cd799439011"
    username = "alice"


def test_issue_tokens_returns_access_and_refresh():
    tokens = issue_tokens(_FakeUser())
    assert set(tokens) == {"access", "refresh"}


def test_access_token_claims():
    claims = decode_token(issue_tokens(_FakeUser())["access"])
    assert claims["type"] == "access"
    assert claims["sub"] == _FakeUser.id
    assert claims["username"] == "alice"
    assert "exp" in claims and "iat" in claims


def test_refresh_token_type():
    claims = decode_token(issue_tokens(_FakeUser())["refresh"])
    assert claims["type"] == "refresh"


def test_decode_rejects_garbage():
    with pytest.raises(jwt.InvalidTokenError):
        decode_token("not.a.jwt")


def test_decode_rejects_wrong_signature():
    forged = jwt.encode({"sub": "x", "type": "access"}, "the-wrong-key", algorithm="HS256")
    with pytest.raises(jwt.InvalidTokenError):
        decode_token(forged)


def test_decode_rejects_expired():
    from django.conf import settings

    token = jwt.encode(
        {"sub": "x", "type": "access", "exp": int(time.time()) - 10},
        settings.JWT_SIGNING_KEY,
        algorithm="HS256",
    )
    with pytest.raises(jwt.ExpiredSignatureError):
        decode_token(token)
