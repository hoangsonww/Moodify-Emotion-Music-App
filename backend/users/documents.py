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
from mongoengine import (
    BooleanField,
    DateTimeField,
    Document,
    EmailField,
    IntField,
    ListField,
    StringField,
)


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


class WebAuthnCredential(Document):
    """A single WebAuthn / FIDO2 passkey bound to a :class:`User`.

    A user may register many passkeys (phone, laptop, hardware key, ...),
    so this is a one-to-many child of ``User`` keyed by ``user_id``. The
    public key + signature counter are all the server needs to verify
    future assertions; the private key never leaves the authenticator.

    Stored fields mirror what ``py_webauthn`` hands back from a verified
    registration, with everything binary base64url-encoded so the whole
    document is JSON/BSON-safe.
    """

    meta = {
        "collection": "webauthn_credentials",
        # Same serverless rationale as User/UserProfile: indexes are managed
        # in Atlas, never auto-created on a cold request (see User.meta).
        "auto_create_index": False,
        "indexes": ["user_id", "credential_id"],
    }

    # str(User.id) -- the owning account. Denormalised ``username`` alongside
    # it so the management UI can render without a second lookup and so a
    # username-scoped login ceremony can find candidate credentials.
    user_id = StringField(required=True)
    username = StringField(required=True)

    # base64url-encoded credential id (the authenticator's handle) and the
    # COSE-encoded public key. credential_id is globally unique.
    credential_id = StringField(required=True, unique=True)
    public_key = StringField(required=True)

    # Signature counter: monotonically increasing per authenticator. A
    # non-increasing counter on a later assertion is a cloned-authenticator
    # signal (see passkey_views for how that is handled).
    sign_count = IntField(default=0, min_value=0)

    # Hints from the authenticator, all optional.
    transports = ListField(StringField())          # ["internal", "hybrid", ...]
    aaguid = StringField()                          # authenticator model id
    device_type = StringField()                     # "single_device" | "multi_device"
    backed_up = BooleanField(default=False)         # synced to a cloud keychain?

    # User-facing label, editable from the management page.
    name = StringField(default="Passkey", max_length=60)

    created_at = DateTimeField(default=datetime.utcnow)
    last_used_at = DateTimeField()

    def __str__(self) -> str:
        return f"{self.name} ({self.username})"


class WebAuthnChallenge(Document):
    """A short-lived, single-use challenge for an in-flight ceremony.

    WebAuthn is a two-step (begin -> complete) handshake, and this is a
    stateless JWT API running on serverless instances -- there is no
    in-process session to stash the server-issued challenge between the
    two requests. So the challenge is persisted here and the document id
    is handed back to the client as an opaque ``flowId``. On ``complete``
    the row is looked up, expiry-checked, and **deleted** (single use)
    before verification, which closes the replay window.
    """

    meta = {
        "collection": "webauthn_challenges",
        "auto_create_index": False,
        "indexes": ["expires_at"],
    }

    challenge = StringField(required=True)          # base64url
    purpose = StringField(required=True, choices=("registration", "authentication"))
    # Set for registration (ties the ceremony to the authed user). For a
    # usernameless login ceremony this is empty until a credential resolves.
    user_id = StringField()
    created_at = DateTimeField(default=datetime.utcnow)
    expires_at = DateTimeField(required=True)

    @property
    def is_expired(self) -> bool:
        return datetime.utcnow() >= self.expires_at
