from django.urls import include, path
from django.views.generic import RedirectView

from .swagger import urlpatterns as swagger_urls

urlpatterns = [
    path("users/", include("users.urls")),
    path("api/", include("api.urls")),
    path("", RedirectView.as_view(url="/swagger/", permanent=False)),
    *swagger_urls,
]
