"""Authentication for the Modal inference endpoints.

Because media uploads go *directly* from the browser to Modal, every write
endpoint must authenticate the caller. Two credentials are accepted on the
``Authorization: Bearer <token>`` header:

1. An end-user JWT issued by Django (HS256, signed with the shared
   ``JWT_SIGNING_KEY``) -- used for direct browser -> Modal media calls.
2. The ``MODAL_SERVICE_TOKEN`` shared secret -- used for trusted
   Django -> Modal proxy calls (text / music).

``authenticate`` is wired as the ``require_auth`` FastAPI dependency on
every write endpoint in modal_app.py.
"""

import hmac

import jwt  # PyJWT

import config


class AuthError(Exception):
    """Raised when a request fails authentication. Maps to HTTP 401."""


def _verify_jwt(token: str) -> dict:
    """Decode and validate an end-user JWT. Returns the claims payload."""
    if not config.JWT_SIGNING_KEY:
        raise AuthError("JWT verification is not configured")
    try:
        return jwt.decode(
            token,
            config.JWT_SIGNING_KEY,
            algorithms=[config.JWT_ALGORITHM],
        )
    except jwt.ExpiredSignatureError as exc:
        raise AuthError("Token has expired") from exc
    except jwt.InvalidTokenError as exc:
        raise AuthError("Invalid token") from exc


def _is_service_token(token: str) -> bool:
    """Constant-time comparison against the Django<->Modal service secret."""
    if not config.MODAL_SERVICE_TOKEN:
        return False
    return hmac.compare_digest(token, config.MODAL_SERVICE_TOKEN)


def authenticate(authorization_header: str | None) -> dict:
    """Validate an Authorization header.

    Returns a context dict:
      - service call -> {"kind": "service"}
      - end user     -> {"kind": "user", "claims": {...}}

    Raises AuthError (HTTP 401) on any failure.
    """
    if not authorization_header or not authorization_header.startswith("Bearer "):
        raise AuthError("Missing or malformed Authorization header")

    token = authorization_header.removeprefix("Bearer ").strip()

    if _is_service_token(token):
        return {"kind": "service"}

    # Otherwise it must be a valid end-user access JWT.
    claims = _verify_jwt(token)
    if claims.get("type") not in (None, "access"):
        raise AuthError("An access token is required")
    return {"kind": "user", "claims": claims}


def authenticate_service_only(authorization_header: str | None) -> dict:
    """Like ``authenticate`` but ONLY accepts the service token.

    Used by admin-only routes (``/metrics``) where traffic-pattern
    visibility is restricted to operators, not arbitrary signed-in
    users. End-user JWTs are rejected with 401 even when otherwise
    valid.
    """
    if not authorization_header or not authorization_header.startswith("Bearer "):
        raise AuthError("Missing or malformed Authorization header")
    token = authorization_header.removeprefix("Bearer ").strip()
    if _is_service_token(token):
        return {"kind": "service"}
    raise AuthError("Service-token authentication required for this endpoint")
