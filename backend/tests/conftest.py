"""Pytest configuration and shared fixtures for the Moodify backend.

The whole suite runs against an in-memory mongomock database, so no real
MongoDB is required. The Modal inference proxy is mocked.
"""

import os

import django
import pytest

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

import mongomock  # noqa: E402
import mongoengine  # noqa: E402

# Swap the mongoengine connection (opened by settings.py) for an in-memory
# mongomock instance shared by the whole test session.
mongoengine.disconnect_all()
mongoengine.connect(
    "moodify_test",
    mongo_client_class=mongomock.MongoClient,
    uuidRepresentation="standard",
)


@pytest.fixture(autouse=True)
def _isolation():
    """Reset the database and cache before every test."""
    from django.core.cache import cache

    db = mongoengine.connection.get_db()
    for name in db.list_collection_names():
        db.drop_collection(name)
    cache.clear()
    yield


@pytest.fixture(autouse=True)
def mock_inference(monkeypatch):
    """Replace the Modal proxy calls with deterministic stubs."""
    from api import views

    monkeypatch.setattr(
        views,
        "modal_text",
        lambda text: {"emotion": "neutral", "recommendations": []},
    )
    monkeypatch.setattr(
        views,
        "modal_music",
        lambda emotion, market=None: {
            "emotion": emotion,
            "market": market,
            "recommendations": [],
        },
    )


@pytest.fixture
def make_user():
    """Factory creating a persisted User + UserProfile pair."""
    from api.models import UserProfile
    from users.documents import User

    def _make(username="alice", password="password123", email="alice@example.com"):
        user = User(username=username, email=email)
        user.set_password(password)
        user.save()
        UserProfile(username=username).save()
        return user

    return _make


@pytest.fixture
def api_client():
    from rest_framework.test import APIClient

    return APIClient()


@pytest.fixture
def auth_client(api_client, make_user):
    """An APIClient already authenticated as a freshly created user."""
    from users.tokens import issue_tokens

    user = make_user()
    tokens = issue_tokens(user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    api_client.user = user
    api_client.tokens = tokens
    return api_client
