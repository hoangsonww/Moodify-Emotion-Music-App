import requests
import random
from ai_ml.src.utils import get_spotify_access_token

def get_music_recommendation(emotion, market=None):
    """
    Get music recommendations based on the detected emotion.

    :param emotion: The detected emotion.
    :param market: The market for which the recommendations are to be provided.
    :return: A list of recommended tracks.
    """
    try:
        access_token = get_spotify_access_token()
    except Exception as e:
        print(f"Error retrieving access token: {e}")
        return []

    # Map emotions to keywords for the search query
    emotion_to_keyword = {
        "joy": "joy",
        "happy": "happy",
        "sadness": "sad",
        "anger": "angry",
        "love": "romantic",
        "fear": "calm",
        "neutral": "chill",
        "calm": "peaceful",
        "disgust": "blues",
        "surprised": "party",
        "excited": "energetic",
        "bored": "relaxing",
        "tired": "calm",
        "relaxed": "calm",
        "stressed": "calm",
        "anxious": "calm",
        "depressed": "sad",
        "lonely": "sad",
        "energetic": "upbeat",
        "nostalgic": "retro",
        "confused": "instrumental",
        "frustrated": "aggressive",
        "hopeful": "uplifting",
        "proud": "epic",
        "guilty": "melancholic",
        "jealous": "dark",
        "ashamed": "melancholic",
        "disappointed": "sad",
        "content": "chill",
        "insecure": "soulful",
        "embarassed": "blues",
        "overwhelmed": "ambient",
        "amused": "fun"
    }

    # Full list of available markets
    available_markets = [
        "AD", "AE", "AG", "AL", "AM", "AO", "AR", "AT", "AU", "AZ", "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI",
        "BJ", "BN", "BO", "BR", "BS", "BT", "BW", "BY", "BZ", "CA", "CD", "CG", "CH", "CI", "CL", "CM", "CO", "CR",
        "CV", "CW", "CY", "CZ", "DE", "DJ", "DK", "DM", "DO", "DZ", "EC", "EE", "EG", "ES", "ET", "FI", "FJ", "FM",
        "FR", "GA", "GB", "GD", "GE", "GH", "GM", "GN", "GQ", "GR", "GT", "GW", "GY", "HK", "HN", "HR", "HT", "HU",
        "ID", "IE", "IL", "IN", "IQ", "IS", "IT", "JM", "JO", "JP", "KE", "KG", "KH", "KI", "KM", "KN", "KR", "KW",
        "KZ", "LA", "LB", "LC", "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY", "MA", "MC", "MD", "ME", "MG", "MH",
        "MK", "ML", "MN", "MO", "MR", "MT", "MU", "MV", "MW", "MX", "MY", "MZ", "NA", "NE", "NG", "NI", "NL", "NO",
        "NP", "NR", "NZ", "OM", "PA", "PE", "PG", "PH", "PK", "PL", "PR", "PS", "PT", "PW", "PY", "QA", "RO", "RS",
        "RW", "SA", "SB", "SC", "SE", "SG", "SI", "SK", "SL", "SM", "SN", "SR", "ST", "SV", "SZ", "TD", "TG", "TH",
        "TJ", "TL", "TN", "TO", "TR", "TT", "TV", "TW", "TZ", "UA", "UG", "US", "UY", "UZ", "VC", "VE", "VN", "VU",
        "WS", "XK", "ZA", "ZM", "ZW"
    ]

    # Determine the keyword for the given emotion
    keyword = emotion_to_keyword.get(emotion.lower(), "pop")  # Default to "pop" if emotion isn't recognized

    # Select market randomly if not provided
    selected_market = market if market in available_markets else random.choice(available_markets)

    headers = {
        "Authorization": f"Bearer {access_token}"
    }

    # Prepare query parameters
    params = {
        "q": keyword,
        "type": "track",
        "limit": 10,
        "market": selected_market
    }

    print(f"Parameters sent to Spotify API: {params}")

    # Make the request to Spotify Search API
    response = requests.get("https://api.spotify.com/v1/search", headers=headers, params=params)

    # Handle response statuses
    if response.status_code == 401:
        print("Access token expired. Please refresh the token.")
        return []
    elif response.status_code != 200:
        print(f"Failed to fetch music recommendations. Status code: {response.status_code}")
        return []

    # Parse the response
    response_data = response.json()
    tracks = response_data.get("tracks", {}).get("items", [])

    print(f"Spotify API response: {response_data}")

    # Extract track details
    recommended_tracks = [
        {
            "name": track["name"],
            "artist": ", ".join([artist["name"] for artist in track["artists"]]),
            "preview_url": track.get("preview_url"),
            "external_url": track["external_urls"]["spotify"],  # Spotify link
            "image_url": track["album"]["images"][0]["url"] if track["album"]["images"] else None  # Album image
        }
        for track in tracks
    ]

    if not recommended_tracks:
        print(f"No tracks found for keyword: {keyword}")

    return recommended_tracks
