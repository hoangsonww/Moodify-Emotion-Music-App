from django.urls import path

from observability.views import metrics

from .views import health, music_recommendation, text_emotion

# Speech and facial emotion are served directly by the Modal inference
# service (browser -> Modal); they are intentionally not proxied here.
urlpatterns = [
    path("health/", health, name="health"),
    path("text_emotion/", text_emotion, name="text_emotion"),
    path("music_recommendation/", music_recommendation, name="music_recommendation"),
    # SRE telemetry -- admin-only (service token); see observability/views.py.
    path("metrics/", metrics, name="metrics"),
]
