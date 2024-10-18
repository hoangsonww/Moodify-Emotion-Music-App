from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase, APIClient
from unittest.mock import patch
import tempfile
import os


class EmotionAPITestCase(APITestCase):
    def setUp(self):
        self.client = APIClient()

    # Test for text_emotion view
    @patch('your_module.infer_text_emotion')
    @patch('your_module.get_music_recommendation')
    def test_text_emotion_success(self, mock_infer_emotion, mock_get_recommendation):
        mock_infer_emotion.return_value = 'happy'
        mock_get_recommendation.return_value = ['Song 1', 'Song 2']

        url = reverse('text-emotion')
        data = {'text': 'I am feeling great'}
        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {'emotion': 'happy', 'recommendations': ['Song 1', 'Song 2']})

    def test_text_emotion_no_text_provided(self):
        url = reverse('text-emotion')
        data = {}
        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error'], 'No text provided')

    # Test for speech_emotion view
    @patch('your_module.infer_speech_emotion')
    @patch('your_module.get_music_recommendation')
    @patch('subprocess.run')
    def test_speech_emotion_success(self, mock_ffmpeg, mock_infer_emotion, mock_get_recommendation):
        mock_infer_emotion.return_value = 'sad'
        mock_get_recommendation.return_value = ['Song 1', 'Song 2']
        mock_ffmpeg.return_value.returncode = 0

        with tempfile.NamedTemporaryFile(suffix='.wav') as temp_audio:
            temp_audio.write(b"dummy audio content")
            temp_audio.seek(0)

            with open(temp_audio.name, 'rb') as audio_file:
                response = self.client.post(reverse('speech-emotion'), {'file': audio_file}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['emotion'], 'sad')
        self.assertEqual(response.data['recommendations'], ['Song 1', 'Song 2'])

    def test_speech_emotion_no_file_provided(self):
        url = reverse('speech-emotion')
        response = self.client.post(url, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error'], 'No audio file provided')

    # Test for facial_emotion view
    @patch('your_module.infer_facial_emotion')
    @patch('your_module.get_music_recommendation')
    def test_facial_emotion_success(self, mock_infer_emotion, mock_get_recommendation):
        mock_infer_emotion.return_value = 'neutral'
        mock_get_recommendation.return_value = ['Song A', 'Song B']

        with tempfile.NamedTemporaryFile(suffix='.jpg') as temp_image:
            temp_image.write(b"dummy image content")
            temp_image.seek(0)

            with open(temp_image.name, 'rb') as image_file:
                response = self.client.post(reverse('facial-emotion'), {'file': image_file}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['emotion'], 'neutral')
        self.assertEqual(response.data['recommendations'], ['Song A', 'Song B'])

    def test_facial_emotion_no_file_provided(self):
        url = reverse('facial-emotion')
        response = self.client.post(url, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error'], 'No image file provided')

    # Test for music_recommendation view
    @patch('your_module.get_music_recommendation')
    def test_music_recommendation_success(self, mock_get_recommendation):
        mock_get_recommendation.return_value = ['Song X', 'Song Y']

        url = reverse('music-recommendation')
        data = {'emotion': 'happy'}
        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['emotion'], 'happy')
        self.assertEqual(response.data['recommendations'], ['Song X', 'Song Y'])

    def test_music_recommendation_no_emotion_provided(self):
        url = reverse('music-recommendation')
        data = {}
        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error'], 'No emotion provided')
