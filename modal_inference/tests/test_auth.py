"""Tests for the Modal endpoint authentication (auth.py)."""

import time

import jwt
import pytest

import auth
import config

_KEY = "shared-test-signing-key"


@pytest.fixture(autouse=True)
def _configure(monkeypatch):
    monkeypatch.setattr(config, "MODAL_SERVICE_TOKEN", "service-secret")
    monkeypatch.setattr(config, "JWT_SIGNING_KEY", _KEY)


def _jwt(claims):
    return jwt.encode(claims, _KEY, algorithm="HS256")


def test_missing_header_rejected():
    with pytest.raises(auth.AuthError):
        auth.authenticate(None)


def test_non_bearer_header_rejected():
    with pytest.raises(auth.AuthError):
        auth.authenticate("Token abc")


def test_service_token_accepted():
    ctx = auth.authenticate("Bearer service-secret")
    assert ctx["kind"] == "service"


def test_valid_access_jwt_accepted():
    token = _jwt({"sub": "u1", "type": "access", "exp": int(time.time()) + 60})
    ctx = auth.authenticate(f"Bearer {token}")
    assert ctx["kind"] == "user"
    assert ctx["claims"]["sub"] == "u1"


def test_expired_jwt_rejected():
    token = _jwt({"sub": "u1", "type": "access", "exp": int(time.time()) - 5})
    with pytest.raises(auth.AuthError):
        auth.authenticate(f"Bearer {token}")


def test_bad_signature_rejected():
    token = jwt.encode({"sub": "u1", "type": "access"}, "wrong-key", algorithm="HS256")
    with pytest.raises(auth.AuthError):
        auth.authenticate(f"Bearer {token}")


def test_refresh_token_rejected():
    token = _jwt({"sub": "u1", "type": "refresh", "exp": int(time.time()) + 60})
    with pytest.raises(auth.AuthError):
        auth.authenticate(f"Bearer {token}")


def test_jwt_rejected_when_signing_key_unset(monkeypatch):
    monkeypatch.setattr(config, "JWT_SIGNING_KEY", None)
    token = _jwt({"sub": "u1", "type": "access", "exp": int(time.time()) + 60})
    with pytest.raises(auth.AuthError):
        auth.authenticate(f"Bearer {token}")
