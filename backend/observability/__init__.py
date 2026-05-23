"""SRE telemetry for the Django backend.

Mirrors ``modal_inference/metrics*.py`` -- one Mongo time-series doc per
request, with a thin in-process counter for the live ``/api/metrics/``
view. See ``observability/middleware.py`` for the request-timing hook
and ``observability/store.py`` for the persistence + read path.
"""
