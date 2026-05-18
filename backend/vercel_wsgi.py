"""Vercel serverless entrypoint for the Moodify Django API.

The Vercel project's Root Directory must be set to ``backend/``. The
``@vercel/python`` runtime detects the module-level ``app`` (a WSGI
callable) and serves it.

This file is named ``vercel_wsgi.py`` (not ``api/index.py``) on purpose:
the Django project already has an app package named ``api/``, and Vercel's
default ``api/`` function directory would collide with it.

Deploy notes (see docs/PRODUCTION_REFACTOR_PLAN.md §5.2):
  * Vercel's ``@vercel/python`` installs from the slim ``backend/
    requirements.txt`` adjacent to this file (NOT the ML-heavy root
    requirements.txt).
  * Static assets for drf-yasg need ``collectstatic`` at build time;
    WhiteNoise then serves them.
"""

import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")

from backend.wsgi import application as app  # noqa: E402  (Vercel entrypoint)
