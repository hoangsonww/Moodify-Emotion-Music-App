"""DRF authentication backed by the MongoDB user document.

Replaces ``rest_framework_simplejwt`` + Django's SQL-backed auth. Wire it up
in ``settings.py`` (plan §5.3):

    REST_FRAMEWORK = {
        "DEFAULT_AUTHENTICATION_CLASSES": [
            "users.authentication.MongoJWTAuthentication",
        ],
        ...
    }
"""

import jwt
from rest_framework import authentication, exceptions

from .documents import User
from .tokens import decode_token


class MongoJWTAuthentication(authentication.BaseAuthentication):
    """Authenticate a request from a ``Bearer`` JWT against the Mongo users."""

    keyword = b"bearer"

    def authenticate(self, request):
        parts = authentication.get_authorization_header(request).split()
        if not parts or parts[0].lower() != self.keyword:
            return None  # no credentials -> let other authenticators try
        if len(parts) != 2:
            raise exceptions.AuthenticationFailed("Malformed Authorization header")

        try:
            claims = decode_token(parts[1].decode())
        except jwt.ExpiredSignatureError:
            raise exceptions.AuthenticationFailed("Token has expired")
        except jwt.InvalidTokenError:
            raise exceptions.AuthenticationFailed("Invalid token")

        if claims.get("type") != "access":
            raise exceptions.AuthenticationFailed("Not an access token")

        user = User.objects(id=claims.get("sub")).first()
        if user is None or not user.is_active:
            raise exceptions.AuthenticationFailed("User not found or inactive")

        return (user, parts[1].decode())

    def authenticate_header(self, request):
        return "Bearer"
