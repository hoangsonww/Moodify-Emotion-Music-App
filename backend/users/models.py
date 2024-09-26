from mongoengine import Document, StringField, ListField, DateTimeField, DictField
from datetime import datetime


class UserProfile(Document):
    username = StringField(required=True)
    mood_history = ListField(StringField())
    listening_history = ListField(StringField())
    recommendations = ListField(DictField())
    created_at = DateTimeField(default=datetime.utcnow)
