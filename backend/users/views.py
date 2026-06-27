"""User account and profile endpoints.

Authentication is JWT-only, backed by the mongoengine ``User`` document
(users/documents.py). There is no SQL database and no Django session/auth.
"""

import logging
import re
import time

import jwt
from drf_yasg import openapi
from drf_yasg.utils import swagger_auto_schema
from mongoengine.errors import NotUniqueError, ValidationError
from pymongo.errors import PyMongoError
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from api.models import UserProfile
from backend.api_docs import (
    ARRAY_OF_TRACKS,
    RESP_401,
    RESP_403,
    RESP_404_USER,
    Tags,
    error_response,
    ok_message,
    user_id_param,
    _obj,
)

from .documents import User
from .tokens import decode_token, issue_tokens

logger = logging.getLogger(__name__)

MIN_PASSWORD_LENGTH = 8

# How many times to (re)run a Mongo read that hit a transient connection
# error, and the base back-off between tries. The backend is deployed on a
# tier that spins down when idle; the *first* query after a wake-up (or
# after a paused Atlas cluster resumes) can blow the driver's
# server-selection budget and raise a PyMongoError. A couple of quick
# retries usually warm the connection within the same request, so the
# user's first sign-in click succeeds instead of bouncing with a
# misleading "Invalid credentials" / 500. See `_read_with_retry`.
_DB_READ_ATTEMPTS = 3
_DB_READ_BACKOFF_SECONDS = 0.4


def _read_with_retry(query_fn, *, attempts=_DB_READ_ATTEMPTS,
                     backoff=_DB_READ_BACKOFF_SECONDS):
    """Run a Mongo read callable, retrying only transient connection errors.

    ``query_fn`` is invoked with no arguments and its result returned. A
    ``PyMongoError`` (server-selection timeout, auto-reconnect, network
    blip -- all symptoms of a cold connection) triggers a short back-off
    and another attempt. The final failure is re-raised so the caller can
    map it to a 503 rather than letting it surface as a 500 or, worse, be
    misread as bad credentials. A query that simply matches nothing is NOT
    an error and returns normally on the first try.
    """
    last_exc = None
    for attempt in range(attempts):
        try:
            return query_fn()
        except PyMongoError as exc:  # noqa: PERF203 -- retry loop is the point
            last_exc = exc
            logger.warning(
                "Transient Mongo read failure (attempt %d/%d): %s",
                attempt + 1, attempts, exc,
            )
            if attempt < attempts - 1:
                time.sleep(backoff * (attempt + 1))
    raise last_exc


_DB_WARMING_RESPONSE = {
    "error": "Service is waking up. Please try again in a moment.",
}


# ---------------------------------------------------------------------------
# Request / response schemas used by the @swagger_auto_schema decorators
# below. Defined once here so each route stays a thin wrapper.
# ---------------------------------------------------------------------------
_REGISTER_BODY = _obj(
    properties={
        "username": openapi.Schema(type=openapi.TYPE_STRING, example="moodify_user"),
        "email": openapi.Schema(type=openapi.TYPE_STRING, format="email",
                                example="user@example.com"),
        "password": openapi.Schema(type=openapi.TYPE_STRING, format="password",
                                   minLength=MIN_PASSWORD_LENGTH,
                                   example="hunter2-correct-horse"),
    },
    required=["username", "email", "password"],
    example={"username": "moodify_user", "email": "user@example.com",
             "password": "hunter2-correct-horse"},
)

_LOGIN_BODY = _obj(
    properties={
        "username": openapi.Schema(type=openapi.TYPE_STRING, example="moodify_user"),
        "password": openapi.Schema(type=openapi.TYPE_STRING, format="password",
                                   example="hunter2-correct-horse"),
    },
    required=["username", "password"],
    example={"username": "moodify_user", "password": "hunter2-correct-horse"},
)

_REFRESH_BODY = _obj(
    properties={
        "refresh": openapi.Schema(
            type=openapi.TYPE_STRING,
            example="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NWY...",
        ),
    },
    required=["refresh"],
)

_VERIFY_BODY = _obj(
    properties={
        "username": openapi.Schema(type=openapi.TYPE_STRING, example="moodify_user"),
        "email": openapi.Schema(type=openapi.TYPE_STRING, format="email",
                                example="user@example.com"),
    },
    required=["username", "email"],
)

_RESET_BODY = _obj(
    properties={
        "username": openapi.Schema(type=openapi.TYPE_STRING, example="moodify_user"),
        "new_password": openapi.Schema(type=openapi.TYPE_STRING, format="password",
                                       minLength=MIN_PASSWORD_LENGTH,
                                       example="new-strong-password-123"),
    },
    required=["username", "new_password"],
)

_PROFILE_UPDATE_BODY = _obj(
    properties={
        "email": openapi.Schema(type=openapi.TYPE_STRING, format="email",
                                example="newemail@example.com"),
        "username": openapi.Schema(type=openapi.TYPE_STRING,
                                   minLength=3, maxLength=30,
                                   description="New username. Letters / digits / `_.-` only.",
                                   example="newhandle"),
    },
    required=[],
    example={"username": "newhandle", "email": "newemail@example.com"},
)

# Username constraints kept centralised so register / update agree.
USERNAME_MIN_LENGTH = 3
USERNAME_MAX_LENGTH = 30
USERNAME_PATTERN = r"^[A-Za-z0-9_.\-]+$"

_TOKEN_PAIR_SCHEMA = _obj(
    properties={
        "access": openapi.Schema(type=openapi.TYPE_STRING,
                                 description="Short-lived JWT (default 7 days)."),
        "refresh": openapi.Schema(type=openapi.TYPE_STRING,
                                  description="Refresh JWT (default 14 days)."),
    },
    required=["access", "refresh"],
)

_PROFILE_SCHEMA = _obj(
    properties={
        "id": openapi.Schema(type=openapi.TYPE_STRING,
                             example="65f3a1b2c4d5e6f7a8b9c0d1"),
        "username": openapi.Schema(type=openapi.TYPE_STRING, example="moodify_user"),
        "email": openapi.Schema(type=openapi.TYPE_STRING, format="email",
                                example="user@example.com"),
        "listening_history": openapi.Schema(
            type=openapi.TYPE_ARRAY,
            items=openapi.Items(type=openapi.TYPE_OBJECT),
            description="Most recently opened tracks (track dicts).",
        ),
        "mood_history": openapi.Schema(
            type=openapi.TYPE_ARRAY,
            items=openapi.Items(type=openapi.TYPE_STRING),
            example=["joy", "sadness", "calm"],
        ),
        "recommendations": openapi.Schema(
            type=openapi.TYPE_ARRAY,
            items=openapi.Items(type=openapi.TYPE_OBJECT),
            description="Pinned recommendations (track dicts).",
        ),
    },
)

_MOOD_HISTORY_RESPONSE = _obj(
    properties={
        "mood_history": openapi.Schema(
            type=openapi.TYPE_ARRAY,
            items=openapi.Items(type=openapi.TYPE_STRING),
            example=["joy", "sadness", "calm", "anger"],
        ),
    },
)

_LISTENING_HISTORY_RESPONSE = _obj(
    properties={
        "listening_history": openapi.Schema(
            type=openapi.TYPE_ARRAY,
            items=openapi.Items(type=openapi.TYPE_OBJECT),
            description="Track dicts in click-order.",
        ),
    },
)

_RECS_RESPONSE = _obj(
    properties={"recommendations": ARRAY_OF_TRACKS},
)

_MOOD_ENTRY_BODY = _obj(
    properties={"mood": openapi.Schema(type=openapi.TYPE_STRING,
                                       example="joy",
                                       description="One of the model's emotion labels.")},
    required=["mood"],
)

_TRACK_ENTRY_BODY = _obj(
    properties={
        "track": openapi.Schema(
            type=openapi.TYPE_OBJECT,
            description="A track dict matching the recommendation shape.",
        ),
    },
    required=["track"],
)

_RECS_BODY = _obj(
    properties={"recommendations": ARRAY_OF_TRACKS},
    required=["recommendations"],
)


def _profile_for(request_user, user_id: str):
    """Return the UserProfile for ``user_id`` if it belongs to the caller.

    Returns (profile, error_response). Exactly one is non-None.
    """
    try:
        profile = UserProfile.objects(id=user_id).first()
    except ValidationError:
        # user_id was not a valid ObjectId.
        profile = None
    if profile is None:
        return None, Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)
    if profile.username != getattr(request_user, "username", None):
        return None, Response({"error": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
    return profile, None


@swagger_auto_schema(
    method="get",
    tags=[Tags.AUTH],
    operation_summary="Validate an access token",
    operation_description=(
        "Cheap probe used by clients to decide whether a stored access "
        "token is still good before bothering with a real API call. "
        "Returns 200 only if the `Authorization` header decodes to a "
        "real, active user."
    ),
    responses={
        200: openapi.Response(
            description="Token is valid.",
            schema=_obj(
                properties={
                    "message": openapi.Schema(type=openapi.TYPE_STRING, example="Token is valid."),
                    "username": openapi.Schema(type=openapi.TYPE_STRING, example="moodify_user"),
                },
            ),
            examples={"application/json": {"message": "Token is valid.", "username": "moodify_user"}},
        ),
        401: RESP_401,
    },
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def validate_token(request):
    """Return 200 if the supplied access token is valid."""
    return Response({"message": "Token is valid.", "username": request.user.username})


@swagger_auto_schema(
    method="post",
    tags=[Tags.AUTH],
    operation_summary="Register a new account",
    operation_description=(
        "Creates a `User` document and an empty `UserProfile` for the "
        "given credentials. Username and email are unique; password is "
        "stored as a PBKDF2 hash, never plain-text. Returns **201** on "
        "success; **409** if the username is already taken."
    ),
    request_body=_REGISTER_BODY,
    responses={
        201: ok_message("Account created.", "User created successfully."),
        400: error_response("Validation failure (missing field or short password).",
                            "Password must be at least 8 characters."),
        409: error_response("Username already taken.", "Username already taken."),
    },
)
@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    """Register a new user and create their profile."""
    username = (request.data.get("username") or "").strip()
    password = request.data.get("password") or ""
    email = (request.data.get("email") or "").strip()

    if not username or not password or not email:
        return Response({"error": "All fields are required."}, status=status.HTTP_400_BAD_REQUEST)
    if len(password) < MIN_PASSWORD_LENGTH:
        return Response(
            {"error": f"Password must be at least {MIN_PASSWORD_LENGTH} characters."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if User.objects(username=username).first() is not None:
        return Response({"error": "Username already taken."}, status=status.HTTP_409_CONFLICT)

    user = User(username=username, email=email)
    user.set_password(password)
    try:
        user.save()
    except NotUniqueError:
        return Response({"error": "Username already taken."}, status=status.HTTP_409_CONFLICT)

    # Create the profile; roll back the user if that fails.
    if UserProfile.objects(username=username).first() is None:
        try:
            UserProfile(username=username).save()
        except Exception:  # noqa: BLE001
            logger.exception("Profile creation failed for %s; rolling back user", username)
            user.delete()
            return Response(
                {"error": "Could not create user profile."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    return Response({"message": "User created successfully."}, status=status.HTTP_201_CREATED)


@swagger_auto_schema(
    method="post",
    tags=[Tags.AUTH],
    operation_summary="Sign in (issue access + refresh tokens)",
    operation_description=(
        "Verifies the password against the PBKDF2 hash and returns a "
        "fresh `(access, refresh)` JWT pair. The access token (default "
        "7 days) goes on the `Authorization: Bearer` header for every "
        "subsequent call; the refresh token (default 14 days) is used "
        "to mint new access tokens via `/users/token/refresh/`. The "
        "same signing key is shared with the Modal inference service, "
        "so the access token also authenticates direct browser/mobile "
        "uploads to Modal."
    ),
    request_body=_LOGIN_BODY,
    responses={
        200: openapi.Response(
            description="Authenticated successfully.",
            schema=_TOKEN_PAIR_SCHEMA,
            examples={"application/json": {
                "access": "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI2NWY...access",
                "refresh": "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI2NWY...refresh",
            }},
        ),
        401: error_response("Bad credentials or inactive user.", "Invalid credentials."),
    },
)
@api_view(["POST"])
@permission_classes([AllowAny])
def login(request):
    """Authenticate a user and return an access/refresh token pair.

    The credential field accepts **either** the username or the email
    address. Users routinely type their email into a field labelled
    "Username", so matching only on username turned a valid login into a
    misleading 401. We look up by username first (the primary handle) and
    fall back to a case-insensitive email match.
    """
    identifier = (request.data.get("username") or "").strip()
    password = request.data.get("password") or ""

    def _find_user():
        user = User.objects(username=identifier).first()
        # Only attempt the email branch when the input looks like an email,
        # so a plain username never triggers a needless second query.
        if user is None and "@" in identifier:
            user = User.objects(email__iexact=identifier).first()
        return user

    # A cold connection raises here rather than returning a (spurious) None,
    # so retry the lookup before concluding anything about the credentials.
    # Only a genuine connection failure reaches the except branch -- map it
    # to 503 so the client can retry and the user never sees a cold start
    # disguised as a wrong password.
    try:
        user = _read_with_retry(_find_user)
    except PyMongoError:
        logger.error("login: Mongo unavailable after retries", exc_info=True)
        return Response(_DB_WARMING_RESPONSE, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    if user is None or not user.is_active or not user.check_password(password):
        return Response({"error": "Invalid credentials."}, status=status.HTTP_401_UNAUTHORIZED)

    return Response(issue_tokens(user), status=status.HTTP_200_OK)


@swagger_auto_schema(
    method="post",
    tags=[Tags.AUTH],
    operation_summary="Refresh an expired access token",
    operation_description=(
        "Trade a valid refresh token in for a brand-new `(access, "
        "refresh)` pair. Clients should call this when an access token "
        "expires (or eagerly, a minute before) and silently retry the "
        "failed call with the new access token. **Rotation** is "
        "intentional -- the previous refresh token is no longer the "
        "newest, so clients should overwrite both stored tokens with "
        "the new pair."
    ),
    request_body=_REFRESH_BODY,
    responses={
        200: openapi.Response(description="Refreshed successfully.", schema=_TOKEN_PAIR_SCHEMA),
        401: error_response("Refresh token is missing / invalid / expired, or user is inactive.",
                            "Invalid or expired refresh token."),
    },
)
@api_view(["POST"])
@permission_classes([AllowAny])
def token_refresh(request):
    """Exchange a valid refresh token for a fresh access/refresh pair."""
    token = request.data.get("refresh") or ""
    try:
        claims = decode_token(token)
    except jwt.InvalidTokenError:
        return Response({"error": "Invalid or expired refresh token."}, status=status.HTTP_401_UNAUTHORIZED)

    if claims.get("type") != "refresh":
        return Response({"error": "Not a refresh token."}, status=status.HTTP_401_UNAUTHORIZED)

    # A malformed subject id is a real 401; a cold-connection error is not --
    # retry then surface 503 so a transient blip doesn't log the user out
    # (the client's auth interceptor treats a failed refresh as logout).
    try:
        user = _read_with_retry(lambda: User.objects(id=claims.get("sub")).first())
    except ValidationError:
        user = None
    except PyMongoError:
        logger.error("token_refresh: Mongo unavailable after retries", exc_info=True)
        return Response(_DB_WARMING_RESPONSE, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    if user is None or not user.is_active:
        return Response({"error": "User not found or inactive."}, status=status.HTTP_401_UNAUTHORIZED)

    return Response(issue_tokens(user), status=status.HTTP_200_OK)


@swagger_auto_schema(
    method="post",
    tags=[Tags.PASSWORD_RESET],
    operation_summary="Step 1 — verify a username/email pair",
    operation_description=(
        "First step of the forgot-password flow. Confirms the supplied "
        "`(username, email)` pair belongs to a real account. Returns "
        "**200** on a match so the client can advance to the second "
        "step; **404** otherwise (deliberately the same status whether "
        "the username or the email is wrong, so we don't disclose which)."
    ),
    request_body=_VERIFY_BODY,
    responses={
        200: ok_message("Pair matches an existing account.",
                        "Username and email combination verified."),
        400: error_response("Both fields are required.", "Username and email are required."),
        404: error_response("No such pair.", "User not found."),
    },
)
@api_view(["POST"])
@permission_classes([AllowAny])
def verify_username_email(request):
    """Verify that a username/email combination exists."""
    username = (request.data.get("username") or "").strip()
    email = (request.data.get("email") or "").strip()

    if not username or not email:
        return Response({"error": "Username and email are required."}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects(username=username, email=email).first() is not None:
        return Response({"message": "Username and email combination verified."})
    return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)


@swagger_auto_schema(
    method="post",
    tags=[Tags.PASSWORD_RESET],
    operation_summary="Step 2 — set a new password",
    operation_description=(
        "Second step of the forgot-password flow. Sets the account's "
        "password to `new_password` (after the client has confirmed "
        "identity via step 1). Stored as a PBKDF2 hash, never "
        "plain-text. The user is logged out of every existing session "
        "implicitly because old JWTs become unverifiable against the "
        "new password hash — clients must re-login."
    ),
    request_body=_RESET_BODY,
    responses={
        200: ok_message("Password reset.", "Password reset successfully."),
        400: error_response("Validation failure.", "Password must be at least 8 characters."),
        404: error_response("No such user.", "User not found."),
    },
)
@api_view(["POST"])
@permission_classes([AllowAny])
def reset_password(request):
    """Reset a user's password (used by the forgot-password flow)."""
    username = (request.data.get("username") or "").strip()
    new_password = request.data.get("new_password") or ""

    if not username or not new_password:
        return Response(
            {"error": "Username and new password are required."}, status=status.HTTP_400_BAD_REQUEST
        )
    if len(new_password) < MIN_PASSWORD_LENGTH:
        return Response(
            {"error": f"Password must be at least {MIN_PASSWORD_LENGTH} characters."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = User.objects(username=username).first()
    if user is None:
        return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)

    user.set_password(new_password)
    user.save()
    return Response({"message": "Password reset successfully."})


@swagger_auto_schema(
    method="get",
    tags=[Tags.PROFILE],
    operation_summary="Get the signed-in user's profile",
    operation_description=(
        "Returns the full profile for the authenticated user, including "
        "mood history, listening history, and saved recommendations. "
        "This is the canonical \"who am I\" call clients make on app "
        "boot to hydrate UI state."
    ),
    responses={
        200: openapi.Response(
            description="Authenticated user's profile.",
            schema=_PROFILE_SCHEMA,
            examples={"application/json": {
                "id": "65f3a1b2c4d5e6f7a8b9c0d1",
                "username": "moodify_user",
                "email": "user@example.com",
                "listening_history": [],
                "mood_history": ["joy", "sadness", "calm"],
                "recommendations": [],
            }},
        ),
        401: RESP_401,
        404: error_response("Profile missing.", "User profile not found."),
    },
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_profile(request):
    """Return the authenticated user's profile."""
    profile = UserProfile.objects(username=request.user.username).first()
    if profile is None:
        return Response({"error": "User profile not found."}, status=status.HTTP_404_NOT_FOUND)

    return Response(
        {
            "id": str(profile.id),
            "username": profile.username,
            "email": request.user.email,
            "listening_history": profile.listening_history,
            "mood_history": profile.mood_history,
            "recommendations": profile.recommendations,
        }
    )


@swagger_auto_schema(
    method="put",
    tags=[Tags.PROFILE],
    operation_summary="Update mutable profile fields",
    operation_description=(
        "Patches the signed-in user's mutable fields. Currently supports "
        "`email` and `username`. Username changes rename both the `User` "
        "document and the cached `UserProfile.username` join key in a "
        "single round-trip; the response includes a fresh access/refresh "
        "JWT pair when the username actually changes so the client can "
        "swap tokens without forcing a re-login. Missing fields are left "
        "untouched, so this is effectively a PATCH."
    ),
    request_body=_PROFILE_UPDATE_BODY,
    responses={
        200: ok_message("Profile updated.", "Profile updated successfully."),
        400: error_response("Invalid username.", "Username must be 3-30 chars."),
        401: RESP_401,
        404: error_response("Profile missing.", "User profile not found."),
        409: error_response("Username taken.", "That username is already taken."),
    },
)
@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def user_profile_update(request):
    """Update mutable fields on the authenticated user's profile."""
    profile = UserProfile.objects(username=request.user.username).first()
    if profile is None:
        return Response({"error": "User profile not found."}, status=status.HTTP_404_NOT_FOUND)

    email = request.data.get("email")
    if email:
        request.user.email = email.strip()
        request.user.save()

    raw_username = request.data.get("username")
    new_tokens = None
    if raw_username is not None:
        new_username = raw_username.strip()
        current_username = request.user.username
        if not new_username:
            return Response(
                {"error": "Username cannot be empty."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(new_username) < USERNAME_MIN_LENGTH or len(new_username) > USERNAME_MAX_LENGTH:
            return Response(
                {"error": f"Username must be {USERNAME_MIN_LENGTH}-{USERNAME_MAX_LENGTH} characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not re.match(USERNAME_PATTERN, new_username):
            return Response(
                {"error": "Username may only contain letters, digits, and the characters _ . -"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if new_username != current_username:
            if User.objects(username=new_username).first():
                return Response(
                    {"error": "That username is already taken."},
                    status=status.HTTP_409_CONFLICT,
                )
            request.user.username = new_username
            request.user.save()
            # The profile is keyed by username -- keep it in sync.
            profile.username = new_username
            # Issue fresh tokens so the JWT's `username` claim reflects
            # the rename. Auth itself still resolves via `sub` (user id),
            # so the old token would keep working -- but UI code reads
            # the username from the claims for display, so refresh it.
            new_tokens = issue_tokens(request.user)

    profile.save()
    body = {"message": "Profile updated successfully.", "username": request.user.username}
    if new_tokens:
        body["access"] = new_tokens["access"]
        body["refresh"] = new_tokens["refresh"]
    return Response(body)


@swagger_auto_schema(
    method="delete",
    tags=[Tags.PROFILE],
    operation_summary="Permanently delete the signed-in account",
    operation_description=(
        "Hard-deletes the authenticated user's `User` document **and** "
        "their `UserProfile` (mood / listening / saved-recommendation "
        "history all cascade). This is irreversible — there is no "
        "soft-delete, recycle bin, or grace period. Clients should "
        "show an explicit confirmation modal before calling this."
    ),
    responses={
        200: ok_message("Account deleted.", "Profile deleted successfully."),
        401: RESP_401,
    },
)
@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def user_profile_delete(request):
    """Delete the authenticated user's account and profile."""
    profile = UserProfile.objects(username=request.user.username).first()
    if profile is not None:
        profile.delete()
    request.user.delete()
    return Response({"message": "Profile deleted successfully."})


@swagger_auto_schema(
    method="post",
    tags=[Tags.SAVED_RECOMMENDATIONS],
    operation_summary="Append tracks to saved recommendations",
    operation_description=(
        "Appends one or more track dicts to the user's persistent "
        "saved-recommendations list. The `user_id` in the path must "
        "match the authenticated caller — clients use this when the "
        "user explicitly \"pins\" tracks from the live recommender."
    ),
    manual_parameters=[user_id_param()],
    request_body=_RECS_BODY,
    responses={
        201: ok_message("Saved.", "Recommendations saved successfully."),
        400: error_response("No tracks provided.", "Recommendations are required."),
        401: RESP_401,
        403: RESP_403,
        404: RESP_404_USER,
    },
)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def save_recommendations(request, user_id):
    """Append recommendations to a user's profile."""
    profile, error = _profile_for(request.user, user_id)
    if error:
        return error

    recommendations = request.data.get("recommendations")
    if not recommendations:
        return Response({"error": "Recommendations are required."}, status=status.HTTP_400_BAD_REQUEST)

    profile.recommendations.extend(recommendations)
    profile.save()
    return Response({"message": "Recommendations saved successfully."}, status=status.HTTP_201_CREATED)


@swagger_auto_schema(
    method="get",
    tags=[Tags.SAVED_RECOMMENDATIONS],
    operation_summary="List saved recommendations",
    operation_description=(
        "Returns every track the user has pinned via "
        "`/users/recommendations/save/{user_id}/`. Order is insertion "
        "order (oldest first). The `user_id` in the path must match the "
        "authenticated caller."
    ),
    manual_parameters=[user_id_param()],
    responses={
        200: openapi.Response("Saved tracks (possibly empty).", schema=_RECS_RESPONSE),
        401: RESP_401,
        403: RESP_403,
        404: RESP_404_USER,
    },
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_recommendations(request, user_id):
    """Return a user's saved recommendations."""
    profile, error = _profile_for(request.user, user_id)
    if error:
        return error
    return Response({"recommendations": profile.recommendations})


@swagger_auto_schema(
    method="delete",
    tags=[Tags.SAVED_RECOMMENDATIONS],
    operation_summary="Clear all saved recommendations",
    operation_description=(
        "Empties the user's saved-recommendations list entirely. "
        "Irreversible. There is no per-track delete because the "
        "frontend's \"Clear all\" UX is the only one that hits this "
        "today; pin order is recreated by re-saving."
    ),
    manual_parameters=[user_id_param()],
    responses={
        200: ok_message("Cleared.", "All recommendations deleted."),
        401: RESP_401,
        403: RESP_403,
        404: RESP_404_USER,
    },
)
@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_all_recommendations(request, user_id):
    """Clear all of a user's saved recommendations."""
    profile, error = _profile_for(request.user, user_id)
    if error:
        return error
    profile.recommendations = []
    profile.save()
    return Response({"message": "All recommendations deleted."})


@swagger_auto_schema(
    method="get",
    tags=[Tags.SAVED_RECOMMENDATIONS],
    operation_summary="List saved recommendations (combined endpoint)",
    operation_description=(
        "Equivalent to `GET /users/recommendations/get/{user_id}/`. "
        "Returned for clients that prefer a single REST-style URL per "
        "resource."
    ),
    manual_parameters=[user_id_param()],
    responses={200: openapi.Response("Saved tracks.", schema=_RECS_RESPONSE),
               401: RESP_401, 403: RESP_403, 404: RESP_404_USER},
)
@swagger_auto_schema(
    method="post",
    tags=[Tags.SAVED_RECOMMENDATIONS],
    operation_summary="Append tracks (combined endpoint)",
    operation_description=(
        "Equivalent to `POST /users/recommendations/save/{user_id}/`. "
        "Body is `{recommendations: [track, ...]}`."
    ),
    manual_parameters=[user_id_param()],
    request_body=_RECS_BODY,
    responses={201: ok_message("Saved.", "Recommendations saved successfully."),
               401: RESP_401, 403: RESP_403, 404: RESP_404_USER},
)
@swagger_auto_schema(
    method="delete",
    tags=[Tags.SAVED_RECOMMENDATIONS],
    operation_summary="Clear all saved recommendations (combined endpoint)",
    operation_description=(
        "Equivalent to `DELETE /users/recommendations/delete/{user_id}/`."
    ),
    manual_parameters=[user_id_param()],
    responses={200: ok_message("Cleared.", "All recommendations deleted."),
               401: RESP_401, 403: RESP_403, 404: RESP_404_USER},
)
@api_view(["GET", "POST", "DELETE"])
@permission_classes([IsAuthenticated])
def user_recommendations(request, user_id):
    """Get, append to, or clear a user's saved recommendations."""
    profile, error = _profile_for(request.user, user_id)
    if error:
        return error

    if request.method == "GET":
        return Response({"recommendations": profile.recommendations})

    if request.method == "POST":
        profile.recommendations.extend(request.data.get("recommendations", []))
        profile.save()
        return Response({"message": "Recommendations saved successfully."}, status=status.HTTP_201_CREATED)

    profile.recommendations = []
    profile.save()
    return Response({"message": "All recommendations deleted."})


@swagger_auto_schema(
    method="get",
    tags=[Tags.MOOD_HISTORY],
    operation_summary="List the user's mood history",
    operation_description=(
        "Returns the user's append-only mood log in insertion order. "
        "Each entry is the emotion label produced by one inference "
        "call (e.g. `\"joy\"`, `\"sadness\"`, `\"anger\"`). Used by the "
        "Modal personalisation model to derive a recurring-mood blend."
    ),
    manual_parameters=[user_id_param()],
    responses={200: openapi.Response("Mood history.", schema=_MOOD_HISTORY_RESPONSE),
               401: RESP_401, 403: RESP_403, 404: RESP_404_USER},
)
@swagger_auto_schema(
    method="post",
    tags=[Tags.MOOD_HISTORY],
    operation_summary="Append a mood to history",
    operation_description=(
        "Pushes a new mood onto the end of the user's mood-history log. "
        "Clients call this after every successful inference so the "
        "personalisation model has fresh signal."
    ),
    manual_parameters=[user_id_param()],
    request_body=_MOOD_ENTRY_BODY,
    responses={201: ok_message("Appended.", "Mood history updated."),
               400: error_response("Mood field missing.", "Mood is required."),
               401: RESP_401, 403: RESP_403, 404: RESP_404_USER},
)
@swagger_auto_schema(
    method="delete",
    tags=[Tags.MOOD_HISTORY],
    operation_summary="Remove a single mood from history",
    operation_description=(
        "Removes the **first** occurrence of `mood` from the user's "
        "mood-history log. Returns 404 if that mood isn't present."
    ),
    manual_parameters=[user_id_param()],
    request_body=_MOOD_ENTRY_BODY,
    responses={200: ok_message("Removed.", "Mood deleted."),
               401: RESP_401, 403: RESP_403,
               404: error_response("Mood not in history (or user not found).",
                                   "Mood not found in history.")},
)
@api_view(["GET", "POST", "DELETE"])
@permission_classes([IsAuthenticated])
def user_mood_history(request, user_id):
    """Get, append to, or remove an entry from a user's mood history."""
    profile, error = _profile_for(request.user, user_id)
    if error:
        return error

    if request.method == "GET":
        return Response({"mood_history": profile.mood_history})

    if request.method == "POST":
        mood = request.data.get("mood")
        if not mood:
            return Response({"error": "Mood is required."}, status=status.HTTP_400_BAD_REQUEST)
        profile.mood_history.append(mood)
        profile.save()
        return Response({"message": "Mood history updated."}, status=status.HTTP_201_CREATED)

    mood = request.data.get("mood")
    if mood not in profile.mood_history:
        return Response({"error": "Mood not found in history."}, status=status.HTTP_404_NOT_FOUND)
    profile.mood_history.remove(mood)
    profile.save()
    return Response({"message": "Mood deleted."})


@swagger_auto_schema(
    method="get",
    tags=[Tags.LISTENING_HISTORY],
    operation_summary="List the user's listening history",
    operation_description=(
        "Returns the user's listening log in click-order (oldest first). "
        "Each entry is a track dict matching the recommender's shape. "
        "Clients use this to dim already-heard tracks in the UI."
    ),
    manual_parameters=[user_id_param()],
    responses={200: openapi.Response("Listening history.", schema=_LISTENING_HISTORY_RESPONSE),
               401: RESP_401, 403: RESP_403, 404: RESP_404_USER},
)
@swagger_auto_schema(
    method="post",
    tags=[Tags.LISTENING_HISTORY],
    operation_summary="Append a track to listening history",
    operation_description=(
        "Pushes a track dict onto the end of the user's listening "
        "history. Clients call this when the user opens a track from a "
        "recommendation list."
    ),
    manual_parameters=[user_id_param()],
    request_body=_TRACK_ENTRY_BODY,
    responses={201: ok_message("Appended.", "Listening history updated."),
               400: error_response("Track field missing.", "Track is required."),
               401: RESP_401, 403: RESP_403, 404: RESP_404_USER},
)
@swagger_auto_schema(
    method="delete",
    tags=[Tags.LISTENING_HISTORY],
    operation_summary="Remove a single track from listening history",
    operation_description=(
        "Removes the **first** matching track dict from listening "
        "history. Match is exact-equality on the dict, so the client "
        "must echo the same track it saw."
    ),
    manual_parameters=[user_id_param()],
    request_body=_TRACK_ENTRY_BODY,
    responses={200: ok_message("Removed.", "Track deleted."),
               401: RESP_401, 403: RESP_403,
               404: error_response("Track not in history (or user not found).",
                                   "Track not found in history.")},
)
@api_view(["GET", "POST", "DELETE"])
@permission_classes([IsAuthenticated])
def user_listening_history(request, user_id):
    """Get, append to, or remove an entry from a user's listening history."""
    profile, error = _profile_for(request.user, user_id)
    if error:
        return error

    if request.method == "GET":
        return Response({"listening_history": profile.listening_history})

    if request.method == "POST":
        track = request.data.get("track")
        if not track:
            return Response({"error": "Track is required."}, status=status.HTTP_400_BAD_REQUEST)
        profile.listening_history.append(track)
        profile.save()
        return Response({"message": "Listening history updated."}, status=status.HTTP_201_CREATED)

    track = request.data.get("track")
    if track not in profile.listening_history:
        return Response({"error": "Track not found in history."}, status=status.HTTP_404_NOT_FOUND)
    profile.listening_history.remove(track)
    profile.save()
    return Response({"message": "Track deleted."})
