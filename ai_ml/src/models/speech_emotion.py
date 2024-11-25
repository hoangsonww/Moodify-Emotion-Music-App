import numpy as np
import librosa
import pickle
import os
import soundfile as sf

from moviepy.editor import AudioFileClip
from sklearn.preprocessing import StandardScaler

import random

# Define the base directory two levels up from the current file
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Define the correct relative paths for the model and scaler
MODEL_PATH = os.path.join(BASE_DIR, 'models', 'speech_emotion_model', 'trained_speech_emotion_model.pkl')
SCALER_PATH = os.path.join(BASE_DIR, 'models', 'speech_emotion_model', 'scaler.pkl')

# Define emotion-to-genre mapping
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
    "embarrassed": "blues",
    "overwhelmed": "chill",
    "amused": "party"
}


def load_speech_emotion_model():
    """
    Load the pre-trained speech emotion recognition model and scaler.

    :return: The loaded model and scaler
    """
    with open(MODEL_PATH, 'rb') as file:
        model = pickle.load(file)
    with open(SCALER_PATH, 'rb') as file:
        scaler = pickle.load(file)
    return model, scaler


def convert_mp4_to_wav(mp4_file):
    """
    Convert an mp4 file to a wav file using moviepy.

    :param mp4_file: The path to the mp4 file
    :return: The path to the converted wav file
    """
    try:
        # Create a temporary wav file path
        wav_file = "temp_audio.wav"

        # Load the mp4 file and extract audio
        audio_clip = AudioFileClip(mp4_file)
        audio_clip.write_audiofile(wav_file, codec='pcm_s16le', fps=44100)
        audio_clip.close()

        return wav_file
    except Exception as e:
        print(f"Error converting mp4 to wav: {e}")
        return None


def extract_features(audio_file):
    """
    Extract MFCC features from an audio file using librosa.

    :param audio_file: The path to the audio file
    :return: The extracted MFCC features
    """
    try:
        speech, sample_rate = librosa.load(audio_file, sr=None)
        mfccs = np.mean(librosa.feature.mfcc(y=speech, sr=sample_rate, n_mfcc=40).T, axis=0)
        return mfccs
    except Exception as e:
        print(f"Error extracting features from {audio_file}: {e}")
        return None


def infer_speech_emotion(audio_file):
    """
    Infer the emotion from an audio file using a pre-trained speech emotion recognition model.

    :param audio_file:
    :return: The predicted emotion
    """
    emotion = None  # Initialize emotion to None
    temp_wav_file = None

    # Convert mp4 to wav if the input file is in mp4 format
    if audio_file.endswith('.mp4'):
        temp_wav_file = convert_mp4_to_wav(audio_file)
        if temp_wav_file is None:
            print("Error in converting mp4 to wav, falling back to a random emotion.")
        else:
            audio_file = temp_wav_file

    model, scaler = load_speech_emotion_model()

    # Extract features from the audio file
    features = extract_features(audio_file)
    if features is not None:
        # Scale features
        features_scaled = scaler.transform(features.reshape(1, -1))

        try:
            # Predict emotion
            emotion_prediction = model.predict(features_scaled)
            if emotion_prediction and emotion_prediction[0]:
                emotion = emotion_prediction[0]
        except Exception as e:
            print(f"Error during model prediction: {e}")

    # Clean up temporary wav file
    if temp_wav_file and os.path.exists(temp_wav_file):
        os.remove(temp_wav_file)

    # Check if emotion is still None and pick a random one if needed
    if emotion is None:
        emotion = random.choice(list(emotion_to_genre.keys()))
        print(f"No valid emotion detected, randomly selected emotion: {emotion}")

    return emotion
