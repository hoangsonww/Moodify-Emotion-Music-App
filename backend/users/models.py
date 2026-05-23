"""User-app models.

``UserProfile`` is defined once in ``api.models``; it is re-exported here so
existing ``from .models import UserProfile`` imports keep working.
The MongoDB-backed account model lives in ``users.documents.User``.
"""

from api.models import UserProfile

__all__ = ["UserProfile"]
