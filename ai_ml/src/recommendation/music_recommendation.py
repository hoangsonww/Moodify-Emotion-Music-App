# music_recommendation.py
import requests
import random
from ai_ml.src.utils import get_spotify_access_token
from ai_ml.src.config import CONFIG

def get_music_recommendation(emotion):
    try:
        access_token = get_spotify_access_token()
    except Exception as e:
        print(f"Error retrieving access token: {e}")
        return []

    available_genre = ["acoustic", "afrobeat", "alt-rock", "alternative", "ambient", "anime", "black-metal", "bluegrass", "blues", "bossanova", "brazil", "breakbeat", "british", "cantopop", "chicago-house", "children", "chill", "classical", "club", "comedy", "country", "dance", "dancehall", "death-metal", "deep-house", "detroit-techno", "disco", "disney", "drum-and-bass", "dub", "dubstep", "edm", "electro", "electronic", "emo", "folk", "forro", "french", "funk", "garage", "german", "gospel", "goth", "grindcore", "groove", "grunge", "guitar", "happy", "hard-rock", "hardcore", "hardstyle", "heavy-metal", "hip-hop", "holidays", "honky-tonk", "house", "idm", "indian", "indie", "indie-pop", "industrial", "iranian", "j-dance", "j-idol", "j-pop", "j-rock", "jazz", "k-pop", "kids", "latin", "latino", "malay", "mandopop", "metal", "metal-misc", "metalcore", "minimal-techno", "movies", "mpb", "new-age", "new-release", "opera", "pagode", "party", "philippines-opm", "piano", "pop", "pop-film", "post-dubstep", "power-pop", "progressive-house", "psych-rock", "punk", "punk-rock", "r-n-b", "rainy-day", "reggae", "reggaeton", "road-trip", "rock", "rock-n-roll", "rockabilly", "romance", "sad", "salsa", "samba", "sertanejo", "show-tunes", "singer-songwriter", "ska", "sleep", "songwriter", "soul", "soundtracks", "spanish", "study", "summer", "swedish", "synth-pop", "tango", "techno", "trance", "trip-hop", "turkish", "work-out", "world-music"]

    # Mapping emotion to genre
    emotion_to_genre = {
        "joy": "hip-hop",
        "happy": "happy",
        "sadness": "sad",
        "anger": "metal",
        "love": "romance",
        "fear": "sad",
        "neutral": "pop",
        "calm": "chill",
        "disgust": "blues",
        "surprised": "party",
        "surprise": "party",
        "excited": "party",
        "bored": "pop",
        "tired": "chill",
        "relaxed": "chill",
        "stressed": "chill",
        "anxious": "chill",
        "depressed": "sad",
        "lonely": "sad",
        "energetic": "hip-hop",
        "nostalgic": "pop",
        "confused": "pop",
        "frustrated": "metal",
        "hopeful": "romance",
        "proud": "hip-hop",
        "guilty": "blues",
        "jealous": "pop",
        "ashamed": "blues",
        "disappointed": "pop",
        "content": "chill",
        "insecure": "pop",
        "embarassed": "blues",
        "overwhelmed": "chill",
        "amused": "party"
    }

    # Determine the genre for the given emotion
    genre = emotion_to_genre.get(emotion.lower(), "pop")  # Default to "pop" if emotion isn't recognized

    headers = {
        "Authorization": f"Bearer {access_token}"
    }

    # List of markets based on the full list from Spotify
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

    # Randomly select one market
    selected_market = random.choice(available_markets)

    params = {
        "seed_genres": genre,
        "limit": 10,
        "market": selected_market,  # Use a single market
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

    # Extracting track details including image
    recommended_tracks = [
        {
            "name": track["name"],
            "artist": ", ".join([artist["name"] for artist in track["artists"]]),
            "preview_url": track["preview_url"],
            "external_url": track["external_urls"]["spotify"],  # Spotify link
            "image_url": track["album"]["images"][0]["url"] if track["album"]["images"] else None  # Album image
        }
        for track in tracks
    ]

    if not recommended_tracks:
        print(f"No tracks found for genre: {genre}")

    return recommended_tracks
