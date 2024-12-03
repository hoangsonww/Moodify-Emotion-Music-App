import base64
import requests
from ai_ml.src.config import CONFIG


def get_spotify_access_token():
    """
    Retrieve the Spotify access token using the client ID and client secret.

    :return: The Spotify access token.
    """
    client_id = CONFIG["spotify_client_id"]
    client_secret = CONFIG["spotify_client_secret"]
    token_url = "https://accounts.spotify.com/api/token"

    # Compute the Base64-encoded string
    try:
        encoded_credentials = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
    except Exception as e:
        raise Exception(f"Error encoding client credentials: {e}")

    headers = {
        "Authorization": f"Basic {encoded_credentials}",
        "Content-Type": "application/x-www-form-urlencoded"
    }

    data = {
        "grant_type": "client_credentials"
    }

    try:
        response = requests.post(token_url, headers=headers, data=data)
        response.raise_for_status()  # Raise an HTTPError for bad responses (4xx and 5xx)
    except requests.exceptions.RequestException as e:
        raise Exception(f"Failed to retrieve Spotify access token: {e}")

    # Extract and return the access token
    token = response.json().get("access_token")
    if not token:
        raise Exception("Access token not found in response")
    return token
