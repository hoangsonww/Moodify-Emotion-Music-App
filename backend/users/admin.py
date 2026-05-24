"""Local-only Django admin customisation.

This module is only meaningful when ``ENABLE_ADMIN`` is on (local dev).
Vercel production runs without ``django.contrib.admin`` in INSTALLED_APPS,
so admin autodiscovery never imports this file there.

Why not register ``User`` / ``UserProfile`` here? Both are mongoengine
Documents, not Django ORM Models, so they don't satisfy the ``ModelAdmin``
contract and registering them would raise. The classic admin exists locally
only for ``createsuperuser`` (Django's own ``auth.User`` table in SQLite)
so an operator can sign in to a real admin page; user-facing data lives in
MongoDB Atlas and is still managed through the REST API.
"""

from django.contrib import admin

admin.site.site_header = "Moodify Admin"
admin.site.site_title = "Moodify Admin"
admin.site.index_title = "Moodify Admin — local only"
