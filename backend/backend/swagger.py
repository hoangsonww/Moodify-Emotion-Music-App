from drf_yasg.views import get_schema_view
from drf_yasg import openapi
from django.urls import path

schema_view = get_schema_view(
    openapi.Info(
        title="Emotion-Based Music App API",
        default_version='v1',
        description="Comprehensive API documentation for the Emotion-Based Music App",
        terms_of_service="https://moodify-emotion-music-app.vercel.app/terms-of-service",
        contact=openapi.Contact(email="hoangson091104@gmail.com", name="Moodify", url="https://moodify-emotion-music-app.vercel.app/"),
        license=openapi.License(name="MIT License"),
    ),
    public=True,
)

urlpatterns = [
    path('swagger/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
    path('redoc/', schema_view.with_ui('redoc', cache_timeout=0), name='schema-redoc'),
]
