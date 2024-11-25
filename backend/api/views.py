import subprocess

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
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

import mimetypes
import moviepy.editor as mp


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
        401: openapi.Response('Unauthorized.'),
        404: openapi.Response('URL not found.'),
        500: openapi.Response('Internal server error.'),
    },
)
@api_view(['POST'])
def text_emotion(request):
    """
    This function retrieves the emotion from the text input and returns music recommendations based on the emotion.

    :param request: The request object containing the text input.
    :return: The response object containing the emotion and music recommendations.
    """
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
        401: openapi.Response('Unauthorized.'),
        404: openapi.Response('URL not found.'),
        500: openapi.Response('Internal server error.'),
    },
)
@api_view(['POST'])
def speech_emotion(request):
    """
    This function retrieves the emotion from the audio input and returns music recommendations based on the emotion.

    :param request: The request object containing the audio input.
    :return: The response object containing the emotion and music recommendations.
    """
    if "file" not in request.FILES:
        return Response({"error": "No audio file provided"}, status=status.HTTP_400_BAD_REQUEST)

    audio_file = request.FILES["file"]
    temp_file_path = None
    converted_file_path = None

    try:
        # Determine the file's mimetype
        mime_type, _ = mimetypes.guess_type(audio_file.name)

        # Save the uploaded audio file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav" if mime_type == "audio/wav" else ".webm") as temp_file:
            for chunk in audio_file.chunks():
                temp_file.write(chunk)
            temp_file_path = temp_file.name

        # If the file is in WebM format, convert it to wav using ffmpeg
        if mime_type == "audio/webm" or mime_type == "video/webm":
            try:
                # Convert webm to wav using ffmpeg
                converted_file_path = temp_file_path.replace(".webm", ".wav")
                ffmpeg_command = [
                    "ffmpeg", "-i", temp_file_path, "-acodec", "pcm_s16le", "-ar", "16000", converted_file_path
                ]
                result = subprocess.run(ffmpeg_command, capture_output=True, text=True)

                if result.returncode != 0:
                    print(f"FFmpeg conversion error: {result.stderr}")
                    return Response({"error": "Failed to convert webm to wav."},
                                    status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            except Exception as e:
                print(f"Error converting webm to wav: {e}")
                return Response({"error": "Failed to convert webm to wav."},
                                status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Use the original file path if it's already a wav file, or the converted path
        file_to_process = converted_file_path if converted_file_path else temp_file_path

        # Process the file
        emotion = infer_speech_emotion(file_to_process)
        recommendations = get_music_recommendation(emotion)

        return Response({"emotion": emotion, "recommendations": recommendations})

    finally:
        # Clean up the temporary files
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        if converted_file_path and os.path.exists(converted_file_path):
            os.remove(converted_file_path)


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
        401: openapi.Response('Unauthorized.'),
        404: openapi.Response('URL not found.'),
        500: openapi.Response('Internal server error.'),
    },
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def facial_emotion(request):
    """
    This function retrieves the emotion from the facial image input and returns music recommendations based on the emotion.

    :param request: The request object containing the image input.
    :return: The response object containing the emotion and music recommendations.
    """
    if 'file' not in request.FILES:
        return Response({"error": "No image file provided"}, status=status.HTTP_400_BAD_REQUEST)

    image_file = request.FILES['file']
    temp_file_path = None

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as temp_file:
            for chunk in image_file.chunks():
                temp_file.write(chunk)
            temp_file_path = temp_file.name

        if not os.path.exists(temp_file_path):
            print("Image file was not saved correctly.")
            return Response({"error": "Failed to save image file."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Debugging: Log the image size
        print(f"Image saved at {temp_file_path}, size: {os.path.getsize(temp_file_path)} bytes")

        # Infer emotion from the facial image file
        emotion = infer_facial_emotion(temp_file_path)

        if emotion is None:
            print("Emotion inference failed.")
            return Response({"error": "Failed to infer emotion from the image."},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Get music recommendations based on the detected emotion
        recommendations = get_music_recommendation(emotion)

        return Response({"emotion": emotion, "recommendations": recommendations})

    except Exception as e:
        print(f"Exception occurred during image processing: {str(e)}")
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    finally:
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
        401: openapi.Response('Unauthorized.'),
        404: openapi.Response('URL not found.'),
        500: openapi.Response('Internal server error.'),
    },
)
@api_view(['POST'])
def music_recommendation(request):
    """
    This function retrieves music recommendations based on the provided emotion.

    :param request: The request object containing the emotion input and optional market.
    :return: The response object containing the music recommendations.
    """
    data = request.data
    emotion = data.get("emotion", "") if data else ""
    market = data.get("market", None) if data else None  # Get the optional market parameter

    if not emotion:
        return Response({"error": "No emotion provided"}, status=status.HTTP_400_BAD_REQUEST)

    recommendations = get_music_recommendation(emotion, market)  # Pass the market to the function
    return Response({"emotion": emotion, "market": market, "recommendations": recommendations})
