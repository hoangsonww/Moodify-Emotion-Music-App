"""Tests for the MongoDB User document (users/documents.py)."""

from users.documents import User


def test_set_and_check_password_roundtrip():
    user = User(username="alice", email="a@example.com")
    user.set_password("supersecret123")
    assert user.check_password("supersecret123") is True


def test_check_password_rejects_wrong_password():
    user = User(username="alice")
    user.set_password("supersecret123")
    assert user.check_password("wrong") is False


def test_password_is_hashed_not_plaintext():
    user = User(username="alice")
    user.set_password("supersecret123")
    assert user.password != "supersecret123"
    assert len(user.password) > 20


def test_user_is_authenticated_flags():
    user = User(username="alice")
    assert user.is_authenticated is True
    assert user.is_anonymous is False


def test_username_field_declared_unique():
    # Enforced at the DB layer by MongoDB's unique index; the register
    # endpoint additionally pre-checks (see test_auth_endpoints).
    assert User.username.unique is True
    assert User.username.required is True


def test_str_returns_username():
    assert str(User(username="alice")) == "alice"
