from django.urls import path
from .views import text_emotion, speech_emotion, facial_emotion, music_recommendation

urlpatterns = [
    path('text_emotion/', text_emotion, name='text_emotion'),
    path('speech_emotion/', speech_emotion, name='speech_emotion'),
    path('facial_emotion/', facial_emotion, name='facial_emotion'),
    path('music_recommendation/', music_recommendation, name='music_recommendation'),
]
