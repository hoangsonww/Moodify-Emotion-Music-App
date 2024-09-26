from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.contrib.auth.models import User
from .models import UserProfile
from .serializers import UserSerializer, UserProfileSerializer
from ai_ml.src.models.text_emotion import infer_text_emotion
from ai_ml.src.models.speech_emotion import infer_speech_emotion
from ai_ml.src.models.facial_emotion import infer_facial_emotion
from ai_ml.src.recommendation.music_recommendation import get_music_recommendation
import os
import tempfile
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi


@swagger_auto_schema(
    method='post',
    request_body=openapi.Schema(
        type=openapi.TYPE_OBJECT,
        properties={
            'text': openapi.Schema(type=openapi.TYPE_STRING, description='Text input for emotion inference'),
        },
        required=['text'],
    ),
    responses={
        200: openapi.Response('Emotion and recommendations retrieved successfully.'),
        400: openapi.Response('No text provided.'),
    },
)
@api_view(['POST'])
def text_emotion(request):
    data = request.data
    text = data.get("text", "") if data else ""

    if not text:
        return Response({"error": "No text provided"}, status=status.HTTP_400_BAD_REQUEST)

    emotion = infer_text_emotion(text)
    recommendations = get_music_recommendation(emotion)

    return Response({"emotion": emotion, "recommendations": recommendations})


@swagger_auto_schema(
    method='post',
    request_body=openapi.Schema(
        type=openapi.TYPE_OBJECT,
        properties={
            'file': openapi.Schema(type=openapi.TYPE_FILE, description='Audio file for emotion inference'),
        },
        required=['file'],
    ),
    responses={
        200: openapi.Response('Emotion and recommendations retrieved successfully.'),
        400: openapi.Response('No audio file provided.'),
    },
)
@api_view(['POST'])
def speech_emotion(request):
    if "file" not in request.FILES:
        return Response({"error": "No audio file provided"}, status=status.HTTP_400_BAD_REQUEST)

    audio_file = request.FILES["file"]
    temp_file_path = None

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as temp_file:
            # Read the content of the uploaded file and write it to the temp file
            for chunk in audio_file.chunks():
                temp_file.write(chunk)
            temp_file_path = temp_file.name

        # Now you can use temp_file_path for further processing
        emotion = infer_speech_emotion(temp_file_path)
        recommendations = get_music_recommendation(emotion)
        return Response({"emotion": emotion, "recommendations": recommendations})

    finally:
        # Optional: clean up the temporary file
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)


@swagger_auto_schema(
    method='post',
    request_body=openapi.Schema(
        type=openapi.TYPE_OBJECT,
        properties={
            'file': openapi.Schema(type=openapi.TYPE_FILE, description='Image file for emotion inference'),
        },
        required=['file'],
    ),
    responses={
        200: openapi.Response('Emotion and recommendations retrieved successfully.'),
        400: openapi.Response('No image file provided.'),
    },
)
@api_view(['POST'])
def facial_emotion(request):
    if 'file' not in request.FILES:
        return Response({"error": "No image file provided"}, status=status.HTTP_400_BAD_REQUEST)

    image_file = request.FILES["file"]

    # Create a temporary file to store the uploaded image
    temp_file_path = None
    try:
        # Use NamedTemporaryFile to create a temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as temp_file:
            # Write the contents of the uploaded file to the temporary file
            for chunk in image_file.chunks():
                temp_file.write(chunk)
            temp_file_path = temp_file.name

        # Infer emotion from the facial image file
        emotion = infer_facial_emotion(temp_file_path)

        # Get music recommendations based on the detected emotion
        recommendations = get_music_recommendation(emotion)

        return Response({"emotion": emotion, "recommendations": recommendations})

    finally:
        # Clean up the temporary file if it exists
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)


@swagger_auto_schema(
    method='post',
    request_body=openapi.Schema(
        type=openapi.TYPE_OBJECT,
        properties={
            'emotion': openapi.Schema(type=openapi.TYPE_STRING, description='Emotion for music recommendations'),
        },
        required=['emotion'],
    ),
    responses={
        200: openapi.Response('Recommendations retrieved successfully.'),
        400: openapi.Response('No emotion provided.'),
    },
)
@api_view(['POST'])
def music_recommendation(request):
    data = request.data
    emotion = data.get("emotion", "") if data else ""

    if not emotion:
        return Response({"error": "No emotion provided"}, status=status.HTTP_400_BAD_REQUEST)

    recommendations = get_music_recommendation(emotion)
    return Response({"emotion": emotion, "recommendations": recommendations})
