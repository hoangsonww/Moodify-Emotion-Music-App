# music_recommendation.py
import requests
from ai_ml.src.utils import get_spotify_access_token
from ai_ml.src.config import CONFIG

def get_music_recommendation(emotion):
    try:
        access_token = get_spotify_access_token()
    except Exception as e:
        print(f"Error retrieving access token: {e}")
        return []

    # Mapping emotion to genre
    emotion_to_genre = {
        "joy": "happy",
        "sadness": "sad",
        "anger": "metal",
        "love": "romance",
        "fear": "sad",
        "neutral": "pop",
        "calm": "chill",
        "disgust": "blues",
        "surprised": "party"
    }

    # Determine the genre for the given emotion
    genre = emotion_to_genre.get(emotion.lower(), "pop")  # Default to "pop" if emotion isn't recognized

    headers = {
        "Authorization": f"Bearer {access_token}"
    }

    params = {
        "seed_genres": genre,
        "limit": 10,
        "market": "US",  # Adjust as needed, ensures songs are available in your region
    }

    # Optionally, customize the energy/valence based on emotion (Spotify-specific attributes)
    if emotion in ["joy", "love"]:
        params["target_valence"] = 0.8  # Happiness
        params["target_energy"] = 0.7  # Energetic
    elif emotion == "sadness":
        params["target_valence"] = 0.2  # Sadness
        params["target_energy"] = 0.3  # Calm
    elif emotion == "anger":
        params["target_energy"] = 0.9  # High energy
        params["target_valence"] = 0.4  # Not necessarily positive

    # Making a request to the Spotify Recommendations API
    response = requests.get("https://api.spotify.com/v1/recommendations", headers=headers, params=params)

    # Handling various response statuses
    if response.status_code == 401:
        print("Access token expired. Please refresh the token.")
        return []
    elif response.status_code != 200:
        print(f"Failed to fetch music recommendations. Status code: {response.status_code}")
        return []

    tracks = response.json().get("tracks", [])

    # Extracting track details
    recommended_tracks = [
        {
            "name": track["name"],
            "artist": ", ".join([artist["name"] for artist in track["artists"]]),
            "preview_url": track["preview_url"],
            "external_url": track["external_urls"]["spotify"]  # Spotify link
        }
        for track in tracks
    ]

    if not recommended_tracks:
        print(f"No tracks found for genre: {genre}")

    return recommended_tracks
