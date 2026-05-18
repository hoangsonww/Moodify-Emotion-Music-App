"""User account and profile endpoints.

Authentication is JWT-only, backed by the mongoengine ``User`` document
(users/documents.py). There is no SQL database and no Django session/auth.
"""

import logging

import jwt
from mongoengine.errors import DoesNotExist, NotUniqueError
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from api.models import UserProfile

from .documents import User
from .tokens import decode_token, issue_tokens

logger = logging.getLogger(__name__)

MIN_PASSWORD_LENGTH = 8


def _profile_for(request_user, user_id: str):
    """Return the UserProfile for ``user_id`` if it belongs to the caller.

    Returns (profile, error_response). Exactly one is non-None.
    """
    profile = UserProfile.objects(id=user_id).first()
    if profile is None:
        return None, Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)
    if profile.username != getattr(request_user, "username", None):
        return None, Response({"error": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
    return profile, None


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def validate_token(request):
    """Return 200 if the supplied access token is valid."""
    return Response({"message": "Token is valid.", "username": request.user.username})


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


@api_view(["POST"])
@permission_classes([AllowAny])
def login(request):
    """Authenticate a user and return an access/refresh token pair."""
    username = (request.data.get("username") or "").strip()
    password = request.data.get("password") or ""

    user = User.objects(username=username).first()
    if user is None or not user.is_active or not user.check_password(password):
        return Response({"error": "Invalid credentials."}, status=status.HTTP_401_UNAUTHORIZED)

    return Response(issue_tokens(user), status=status.HTTP_200_OK)


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

    user = User.objects(id=claims.get("sub")).first()
    if user is None or not user.is_active:
        return Response({"error": "User not found or inactive."}, status=status.HTTP_401_UNAUTHORIZED)

    return Response(issue_tokens(user), status=status.HTTP_200_OK)


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

    profile.save()
    return Response({"message": "Profile updated successfully."})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def user_profile_delete(request):
    """Delete the authenticated user's account and profile."""
    profile = UserProfile.objects(username=request.user.username).first()
    if profile is not None:
        profile.delete()
    request.user.delete()
    return Response({"message": "Profile deleted successfully."})


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


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_recommendations(request, user_id):
    """Return a user's saved recommendations."""
    profile, error = _profile_for(request.user, user_id)
    if error:
        return error
    return Response({"recommendations": profile.recommendations})


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
