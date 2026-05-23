"""MongoDB documents for the Moodify API.

This module is the single source of truth for ``UserProfile``;
``users/models.py`` re-exports it so both apps share one definition.
"""

from datetime import datetime

from mongoengine import DateTimeField, DictField, Document, ListField, StringField


class UserProfile(Document):
    """A user's mood/listening history and saved recommendations."""

    # auto_create_index=False stops mongoengine from re-creating indexes
    # on every cold start (the right pattern for serverless: indexes are
    # managed once in Atlas, not by each request). It also avoids cold-
    # start failures when the existing data violates a unique constraint
    # the app would otherwise try to enforce.
    meta = {
        "collection": "user_profile",
        "auto_create_index": False,
        "indexes": ["username"],
    }

    # username is the join key with the User document, which already
    # enforces uniqueness at insert time -- so the per-document unique
    # constraint here is redundant and would block any cold start when
    # legacy duplicates linger in the user_profile collection.
    username = StringField(required=True)
    mood_history = ListField(StringField())
    listening_history = ListField(StringField())
    recommendations = ListField(DictField())
    created_at = DateTimeField(default=datetime.utcnow)
