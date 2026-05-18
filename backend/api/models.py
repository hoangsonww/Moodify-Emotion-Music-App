"""MongoDB documents for the Moodify API.

This module is the single source of truth for ``UserProfile``;
``users/models.py`` re-exports it so both apps share one definition.
"""

from datetime import datetime

from mongoengine import DateTimeField, DictField, Document, ListField, StringField


class UserProfile(Document):
    """A user's mood/listening history and saved recommendations."""

    meta = {"collection": "user_profile", "indexes": ["username"]}

    username = StringField(required=True, unique=True)
    mood_history = ListField(StringField())
    listening_history = ListField(StringField())
    recommendations = ListField(DictField())
    created_at = DateTimeField(default=datetime.utcnow)
