from django.conf import settings
from django.urls import include, path
from django.views.generic import RedirectView

from .swagger import urlpatterns as swagger_urls

urlpatterns = [
    path("users/", include("users.urls")),
    path("api/", include("api.urls")),
    path("", RedirectView.as_view(url="/swagger/", permanent=False)),
    *swagger_urls,
]

# Mount the classic Django admin only when explicitly enabled (local dev).
# Vercel production runs with ENABLE_ADMIN=False -- the admin app is not in
# INSTALLED_APPS there, so importing `django.contrib.admin` would fail
# anyway. Keep the import inside the guard.
if getattr(settings, "ENABLE_ADMIN", False):
    from django.contrib import admin  # noqa: PLC0415 -- guarded import

    urlpatterns.insert(0, path("admin/", admin.site.urls))
