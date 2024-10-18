from mongoengine import Document, StringField, ListField, DateTimeField
from datetime import datetime


class UserProfile(Document):
    """
    This class defines the structure of the user profile document in the MongoDB database.
    """
    username = StringField(required=True)
    mood_history = ListField(StringField())
    listening_history = ListField(StringField())
    created_at = DateTimeField(default=datetime.utcnow)
