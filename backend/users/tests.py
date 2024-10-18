from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase, APIClient
from django.contrib.auth.models import User
from unittest.mock import patch
from rest_framework_simplejwt.tokens import RefreshToken


class UserAPITestCase(APITestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='testuser', password='testpassword', email='test@example.com')

    def get_access_token(self):
        refresh = RefreshToken.for_user(self.user)
        return str(refresh.access_token)

    # Test for validate_token view
    def test_validate_token_success(self):
        access_token = self.get_access_token()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        url = reverse('validate-token')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['message'], "Token is valid.")

    def test_validate_token_unauthorized(self):
        url = reverse('validate-token')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # Test for register view
    def test_register_user_success(self):
        url = reverse('register')
        data = {'username': 'newuser', 'password': 'newpassword', 'email': 'newuser@example.com'}
        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['message'], "User created successfully.")

    def test_register_user_missing_fields(self):
        url = reverse('register')
        data = {'username': 'newuser'}
        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error'], "All fields are required.")

    # Test for login view
    def test_login_success(self):
        url = reverse('login')
        data = {'username': 'testuser', 'password': 'testpassword'}
        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_login_invalid_credentials(self):
        url = reverse('login')
        data = {'username': 'testuser', 'password': 'wrongpassword'}
        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data['error'], "Invalid credentials")

    # Test for verify_username_email view
    def test_verify_username_email_success(self):
        url = reverse('verify-username-email')
        data = {'username': 'testuser', 'email': 'test@example.com'}
        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['message'], "Username and email combination verified.")

    def test_verify_username_email_not_found(self):
        url = reverse('verify-username-email')
        data = {'username': 'wronguser', 'email': 'wrong@example.com'}
        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.data['error'], "User not found.")

    # Test for reset_password view
    def test_reset_password_success(self):
        url = reverse('reset-password')
        data = {'username': 'testuser', 'new_password': 'newpassword'}
        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['message'], "Password reset successfully.")

    def test_reset_password_user_not_found(self):
        url = reverse('reset-password')
        data = {'username': 'wronguser', 'new_password': 'newpassword'}
        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.data['error'], "User not found.")

    # Test for user_profile view
    @patch('your_module.UserProfile.objects.get')
    def test_user_profile_success(self, mock_get_profile):
        mock_get_profile.return_value = {
            "username": "testuser",
            "email": "test@example.com",
            "listening_history": [],
            "mood_history": [],
            "recommendations": []
        }
        access_token = self.get_access_token()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        url = reverse('user-profile')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], "testuser")

    def test_user_profile_unauthorized(self):
        url = reverse('user-profile')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # Test for user_profile_update view
    @patch('your_module.UserProfile.objects.get')
    def test_user_profile_update_success(self, mock_get_profile):
        mock_get_profile.return_value = self.user
        access_token = self.get_access_token()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        url = reverse('user-profile-update')
        response = self.client.put(url, {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['message'], "Profile updated successfully.")

    # Test for user_profile_delete view
    @patch('your_module.UserProfile.objects.get')
    def test_user_profile_delete_success(self, mock_get_profile):
        mock_get_profile.return_value = self.user
        access_token = self.get_access_token()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        url = reverse('user-profile-delete')
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['message'], "Profile deleted successfully.")
