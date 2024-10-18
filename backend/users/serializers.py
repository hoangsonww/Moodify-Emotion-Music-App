from rest_framework import serializers
from .models import UserProfile
from django.contrib.auth.models import User


class UserSerializer(serializers.ModelSerializer):
    """
    This class is the serializer for the User model.
    """
    class Meta:
        """
        This class defines the metadata for the UserSerializer class.
        """
        model = User
        fields = ['id', 'username', 'email']


class UserProfileSerializer(serializers.ModelSerializer):
    """
    This class is the serializer for the UserProfile model.
    """
    class Meta:
        """
        This class defines the metadata for the UserProfileSerializer class.
        """
        model = UserProfile
        fields = ['username', 'mood_history', 'listening_history', 'created_at']
