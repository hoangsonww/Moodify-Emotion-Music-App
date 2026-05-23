"""JWT issuing/decoding for MongoDB-backed users.

Tokens are HS256, signed with ``settings.JWT_SIGNING_KEY``. That key is
shared with the Modal inference service so it can verify end-user tokens on
direct browser uploads (plan §4.4 / §6).
"""

from datetime import datetime, timedelta, timezone

import jwt
from django.conf import settings

_ALGORITHM = "HS256"


def _access_ttl() -> timedelta:
    return timedelta(days=getattr(settings, "JWT_ACCESS_TOKEN_DAYS", 7))


def _refresh_ttl() -> timedelta:
    return timedelta(days=getattr(settings, "JWT_REFRESH_TOKEN_DAYS", 14))


def issue_tokens(user) -> dict:
    """Return an access/refresh JWT pair for the given mongoengine ``User``."""
    now = datetime.now(timezone.utc)
    base = {"sub": str(user.id), "username": user.username, "iat": now}
    access = jwt.encode(
        {**base, "type": "access", "exp": now + _access_ttl()},
        settings.JWT_SIGNING_KEY,
        algorithm=_ALGORITHM,
    )
    refresh = jwt.encode(
        {**base, "type": "refresh", "exp": now + _refresh_ttl()},
        settings.JWT_SIGNING_KEY,
        algorithm=_ALGORITHM,
    )
    return {"access": access, "refresh": refresh}


def decode_token(token: str) -> dict:
    """Decode and validate a JWT. Raises ``jwt.InvalidTokenError`` on failure."""
    return jwt.decode(token, settings.JWT_SIGNING_KEY, algorithms=[_ALGORITHM])
