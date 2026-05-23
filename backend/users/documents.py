"""MongoDB-backed user document.

Part of the SQLite -> MongoDB consolidation (plan §6). Replaces
``django.contrib.auth.models.User`` so the API can run on Vercel without a
SQL database.

Password hashing reuses ``django.contrib.auth.hashers`` -- those functions
are pure and need neither a database nor the ``auth`` app installed. They
also verify the existing PBKDF2 hashes migrated out of SQLite unchanged.
"""

from datetime import datetime

from django.contrib.auth.hashers import check_password, make_password
from mongoengine import BooleanField, DateTimeField, Document, EmailField, StringField


class User(Document):
    """A Moodify user account, stored in the ``users`` MongoDB collection."""

    # auto_create_index=False stops mongoengine from re-creating indexes
    # on every cold start (the right pattern for serverless: indexes are
    # managed once in Atlas, not by each request). Without it, any spec
    # mismatch between the field declarations here and what Atlas already
    # has would crash the first request with IndexKeySpecsConflict.
    meta = {
        "collection": "users",
        "auto_create_index": False,
    }

    username = StringField(required=True, unique=True)
    email = EmailField(unique=True)
    password = StringField(required=True)  # hashed -- never store plaintext
    is_active = BooleanField(default=True)
    created_at = DateTimeField(default=datetime.utcnow)

    def set_password(self, raw_password: str) -> None:
        """Hash and store a new password."""
        self.password = make_password(raw_password)

    def check_password(self, raw_password: str) -> bool:
        """Verify a candidate password against the stored hash."""
        return check_password(raw_password, self.password)

    # --- Minimal duck-typing so DRF can treat this as request.user --------
    @property
    def is_authenticated(self) -> bool:
        return True

    @property
    def is_anonymous(self) -> bool:
        return False

    def __str__(self) -> str:
        return self.username
