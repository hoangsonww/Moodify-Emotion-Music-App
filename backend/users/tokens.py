"""JWT issuing/decoding for MongoDB-backed users.

Tokens are HS256, signed with ``JWT_SIGNING_KEY``. That key is shared with
the Modal inference service so it can verify end-user tokens on direct
browser uploads (plan §4.4 / §6).
"""

from datetime import datetime, timedelta, timezone

import jwt
from decouple import config

# TODO(impl): source these from Django settings once settings.py defines
# JWT_SIGNING_KEY and SIMPLE_JWT lifetimes (plan §5.3).
_SIGNING_KEY = config("JWT_SIGNING_KEY", default="")
_ALGORITHM = "HS256"
_ACCESS_TTL = timedelta(days=7)
_REFRESH_TTL = timedelta(days=14)


def issue_tokens(user) -> dict:
    """Return an access/refresh JWT pair for the given Mongo ``User``."""
    now = datetime.now(timezone.utc)
    base = {"sub": str(user.id), "username": user.username, "iat": now}
    access = jwt.encode(
        {**base, "type": "access", "exp": now + _ACCESS_TTL}, _SIGNING_KEY, algorithm=_ALGORITHM
    )
    refresh = jwt.encode(
        {**base, "type": "refresh", "exp": now + _REFRESH_TTL}, _SIGNING_KEY, algorithm=_ALGORITHM
    )
    return {"access": access, "refresh": refresh}


def decode_token(token: str) -> dict:
    """Decode and validate a JWT. Raises ``jwt.InvalidTokenError`` on failure."""
    return jwt.decode(token, _SIGNING_KEY, algorithms=[_ALGORITHM])
