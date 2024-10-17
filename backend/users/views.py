from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from .models import UserProfile
from django.http import JsonResponse
from mongoengine.errors import DoesNotExist
import json
from django.views.decorators.csrf import csrf_exempt
from .serializers import UserSerializer, UserProfileSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi


@swagger_auto_schema(
    method='post',
    request_body=openapi.Schema(
        type=openapi.TYPE_OBJECT,
        properties={
            'username': openapi.Schema(type=openapi.TYPE_STRING, description='Username for registration'),
            'password': openapi.Schema(type=openapi.TYPE_STRING, description='Password for registration'),
            'email': openapi.Schema(type=openapi.TYPE_STRING, description='Email address for registration'),
        },
        required=['username', 'password', 'email'],
    ),
    responses={
        201: openapi.Response('User created successfully.'),
        400: openapi.Response('All fields are required.'),
        401: openapi.Response('Unauthorized.'),
        404: openapi.Response('URL not found.'),
        500: openapi.Response('Internal server error.'),
    },
)
@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    if request.method == 'POST':
        username = request.data.get('username')
        password = request.data.get('password')
        email = request.data.get('email')

        if not username or not password or not email:
            return Response({"error": "All fields are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.create_user(username=username, password=password, email=email)
            UserProfile(username=username).save()
            user.save()
            return Response({"message": "User created successfully."}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@swagger_auto_schema(
    method='post',
    request_body=openapi.Schema(
        type=openapi.TYPE_OBJECT,
        properties={
            'username': openapi.Schema(type=openapi.TYPE_STRING, description='Username for login'),
            'password': openapi.Schema(type=openapi.TYPE_STRING, description='Password for login'),
        },
        required=['username', 'password'],
    ),
    responses={
        200: openapi.Response('Tokens generated successfully.'),
        401: openapi.Response('Unauthorized.'),
        404: openapi.Response('URL not found.'),
        500: openapi.Response('Internal server error.'),
    },
)
@api_view(['POST'])
@permission_classes([AllowAny])  # Allow any user to access this view
def login(request):
    username = request.data.get('username')
    password = request.data.get('password')

    user = authenticate(request, username=username, password=password)
    if user is not None:
        refresh = RefreshToken.for_user(user)
        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        })
    return Response({"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)


@swagger_auto_schema(
    method='get',
    responses={
        200: openapi.Response('User profile retrieved successfully.'),
        401: openapi.Response('Unauthorized.'),
        404: openapi.Response('User profile not found.'),
        500: openapi.Response('Internal server error.'),
    },
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_profile(request):
    try:
        # Retrieve the UserProfile associated with the authenticated user
        user_profile = UserProfile.objects.get(username=request.user.username)

        return Response({
            "id": str(user_profile.id),
            "username": user_profile.username,
            "email": request.user.email,
            "listening_history": user_profile.listening_history,
            "mood_history": user_profile.mood_history,
            "recommendations": user_profile.recommendations,
        }, status=status.HTTP_200_OK)

    except DoesNotExist:
        return Response({"error": "User profile not found."}, status=status.HTTP_404_NOT_FOUND)


@swagger_auto_schema(
    method='put',
    request_body=openapi.Schema(
        type=openapi.TYPE_OBJECT,
        properties={},
    ),
    responses={
        200: openapi.Response('Profile updated successfully.'),
        401: openapi.Response('Unauthorized.'),
        404: openapi.Response('URL not found.'),
        500: openapi.Response('Internal server error.'),
    },
)
@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def user_profile_update(request):
    user = request.user
    profile = UserProfile.objects.get(username=user.username)

    # Update profile fields based on request data
    profile.save()
    return Response({"message": "Profile updated successfully."})


@swagger_auto_schema(
    method='delete',
    responses={
        200: openapi.Response('Profile deleted successfully.'),
        401: openapi.Response('Unauthorized.'),
        404: openapi.Response('URL not found.'),
        500: openapi.Response('Internal server error.'),
    },
)
@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def user_profile_delete(request):
    user = request.user
    profile = UserProfile.objects.get(username=user.username)
    profile.delete()
    return Response({"message": "Profile deleted successfully."})


@swagger_auto_schema(
    method='post',
    request_body=openapi.Schema(
        type=openapi.TYPE_OBJECT,
        properties={
            'recommendations': openapi.Schema(
                type=openapi.TYPE_ARRAY,
                items=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        'name': openapi.Schema(type=openapi.TYPE_STRING, description='Name of the song'),
                        'artist': openapi.Schema(type=openapi.TYPE_STRING, description='Name of the artist'),
                        'preview_url': openapi.Schema(type=openapi.TYPE_STRING, nullable=True, description='Preview URL of the song'),
                        'external_url': openapi.Schema(type=openapi.TYPE_STRING, description='External URL of the song'),
                    },
                ),
                description='List of music recommendations'
            ),
        },
        required=['recommendations'],
    ),
    responses={
        201: openapi.Response('Recommendations saved successfully.'),
        400: openapi.Response('Recommendations are required.'),
        404: openapi.Response('User not found.'),
        500: openapi.Response('Internal server error.'),
    },
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def save_recommendations(request, user_id):
    try:
        recommendations = request.data.get("recommendations")

        if not recommendations:
            return Response({"error": "Recommendations are required"}, status=status.HTTP_400_BAD_REQUEST)

        user_profile = UserProfile.objects(id=user_id).first()
        if not user_profile:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        user_profile.recommendations.extend(recommendations)
        user_profile.save()

        return Response({"message": "Recommendations saved successfully"}, status=status.HTTP_201_CREATED)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@swagger_auto_schema(
    method='get',
    responses={
        200: openapi.Response('Recommendations retrieved successfully.'),
        404: openapi.Response('User not found.'),
        500: openapi.Response('Internal server error.'),
    },
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_recommendations(request, user_id):
    try:
        # Retrieve user profile using MongoDB ObjectId
        user_profile = UserProfile.objects(id=user_id).first()

        if not user_profile:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        return Response({"recommendations": user_profile.recommendations}, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@swagger_auto_schema(
    method='delete',
    manual_parameters=[
        openapi.Parameter('user_id', openapi.IN_PATH, description='User ID to delete recommendations for', type=openapi.TYPE_STRING),
    ],
    responses={
        200: openapi.Response('All recommendations deleted successfully.'),
        401: openapi.Response('Unauthorized.'),
        404: openapi.Response('User not found.'),
        500: openapi.Response('Internal server error.'),
    },
)
@api_view(['DELETE'])
def delete_all_recommendations(request, user_id):
    try:
        # Retrieve user profile by MongoDB ObjectId
        user_profile = UserProfile.objects(id=user_id).first()

        if not user_profile:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        # Explicitly set recommendations to an empty list
        user_profile.recommendations = []
        user_profile.save()

        return Response({"message": "All recommendations deleted"}, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@csrf_exempt
@swagger_auto_schema(
    method='post',
    request_body=openapi.Schema(
        type=openapi.TYPE_OBJECT,
        properties={
            'recommendations': openapi.Schema(
                type=openapi.TYPE_ARRAY,
                items=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        'name': openapi.Schema(type=openapi.TYPE_STRING),
                        'artist': openapi.Schema(type=openapi.TYPE_STRING),
                        'preview_url': openapi.Schema(type=openapi.TYPE_STRING, nullable=True),
                        'external_url': openapi.Schema(type=openapi.TYPE_STRING),
                    },
                ),
            ),
        },
        required=['recommendations'],
    ),
    responses={
        201: openapi.Response('Recommendations saved successfully.'),
        400: openapi.Response('Recommendations are required.'),
        401: openapi.Response('Unauthorized.'),
        404: openapi.Response('User not found.'),
        500: openapi.Response('Internal server error.'),
    },
)
@api_view(['POST', 'GET', 'DELETE'])
def user_recommendations(request, user_id):
    if request.method == 'POST':
        data = json.loads(request.body)
        try:
            user_profile = UserProfile.objects.get(id=user_id)
            user_profile.recommendations.extend(data.get('recommendations', []))
            user_profile.save()
            return Response({"message": "Recommendations saved successfully."}, status=status.HTTP_201_CREATED)
        except DoesNotExist:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)

    elif request.method == 'GET':
        try:
            user_profile = UserProfile.objects.get(id=user_id)
            return Response({"recommendations": user_profile.recommendations}, status=status.HTTP_200_OK)
        except DoesNotExist:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)

    elif request.method == 'DELETE':
        try:
            user_profile = UserProfile.objects.get(id=user_id)
            user_profile.recommendations.clear()  # Clear all recommendations
            user_profile.save()
            return Response({"message": "All recommendations deleted."}, status=status.HTTP_204_NO_CONTENT)
        except DoesNotExist:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)


@csrf_exempt
@swagger_auto_schema(
    method='post',
    request_body=openapi.Schema(
        type=openapi.TYPE_OBJECT,
        properties={
            'mood': openapi.Schema(type=openapi.TYPE_STRING, description='Detected mood'),
        },
        required=['mood'],
    ),
    responses={
        201: openapi.Response('Mood history updated successfully.'),
        400: openapi.Response('Mood is required.'),
        401: openapi.Response('Unauthorized.'),
        404: openapi.Response('User not found.'),
        500: openapi.Response('Internal server error.'),
    },
)
@api_view(['GET', 'POST', 'DELETE'])
def user_mood_history(request, user_id):
    if request.method == 'GET':
        try:
            user = UserProfile.objects.get(id=user_id)
            return JsonResponse({"mood_history": user.mood_history}, status=200)
        except DoesNotExist:
            return JsonResponse({"error": "User not found."}, status=404)

    elif request.method == 'POST':
        data = json.loads(request.body)
        try:
            user = UserProfile.objects.get(id=user_id)
            mood = data.get('mood')
            if mood:
                user.mood_history.append(mood)
                user.save()
                return JsonResponse({"message": "Mood history updated."}, status=201)
            else:
                return JsonResponse({"error": "Mood is required."}, status=400)
        except DoesNotExist:
            return JsonResponse({"error": "User not found."}, status=404)

    elif request.method == 'DELETE':
        data = json.loads(request.body)
        try:
            user = UserProfile.objects.get(id=user_id)
            mood_to_delete = data.get('mood')
            if mood_to_delete in user.mood_history:
                user.mood_history.remove(mood_to_delete)
                user.save()
                return JsonResponse({"message": "Mood deleted."}, status=204)
            else:
                return JsonResponse({"error": "Mood not found in history."}, status=404)
        except DoesNotExist:
            return JsonResponse({"error": "User not found."}, status=404)


@csrf_exempt
@swagger_auto_schema(
    method='get',
    responses={
        200: openapi.Response('Listening history retrieved successfully.'),
        404: openapi.Response('User not found.'),
    },
)
@api_view(['GET', 'POST', 'DELETE'])
def user_listening_history(request, user_id):
    if request.method == 'GET':
        try:
            user = UserProfile.objects.get(id=user_id)
            return JsonResponse({"listening_history": user.listening_history}, status=200)
        except DoesNotExist:
            return JsonResponse({"error": "User not found."}, status=404)

    elif request.method == 'POST':
        data = json.loads(request.body)
        try:
            user = UserProfile.objects.get(id=user_id)
            track = data.get('track')
            if track:
                user.listening_history.append(track)
                user.save()
                return JsonResponse({"message": "Listening history updated."}, status=201)
            else:
                return JsonResponse({"error": "Track is required."}, status=400)
        except DoesNotExist:
            return JsonResponse({"error": "User not found."}, status=404)

    elif request.method == 'DELETE':
        data = json.loads(request.body)
        try:
            user = UserProfile.objects.get(id=user_id)
            track_to_delete = data.get('track')
            if track_to_delete in user.listening_history:
                user.listening_history.remove(track_to_delete)
                user.save()
                return JsonResponse({"message": "Track deleted."}, status=204)
            else:
                return JsonResponse({"error": "Track not found in history."}, status=404)
        except DoesNotExist:
            return JsonResponse({"error": "User not found."}, status=404)
