import base64
import requests
from ai_ml.src.config import CONFIG

def get_spotify_access_token():
    client_id = CONFIG["spotify_client_id"]
    client_secret = CONFIG["spotify_client_secret"]
    token_url = "https://accounts.spotify.com/api/token"

    # Create the authorization header
    auth_header = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()

    headers = {
        "Authorization": f"Basic {auth_header}"
    }

    data = {
        "grant_type": "client_credentials"
    }

    response = requests.post(token_url, headers=headers, data=data)

    if response.status_code != 200:
        raise Exception("Failed to retrieve Spotify access token")

    return response.json().get("access_token")
