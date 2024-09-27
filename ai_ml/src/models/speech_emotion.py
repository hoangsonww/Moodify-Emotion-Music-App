import numpy as np
import librosa
import pickle
import os
import soundfile as sf
from moviepy.editor import AudioFileClip
from sklearn.preprocessing import StandardScaler

# Define the path to the saved speech emotion model and scaler - Replace this with your own path
MODEL_PATH = "C:/Users/hoang/PycharmProjects/Emotion-Based-Music-App/Emotion-Based-Music-App/ai_ml/models/speech_emotion_model/trained_speech_emotion_model.pkl"
SCALER_PATH = "C:/Users/hoang/PycharmProjects/Emotion-Based-Music-App/Emotion-Based-Music-App/ai_ml/models/speech_emotion_model/scaler.pkl"


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
        audio_clip.write_audiofile(wav_file)
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
        with sf.SoundFile(audio_file) as f:
            print(f"Audio file sample rate: {f.samplerate}")
            speech, sample_rate = librosa.load(audio_file, sr=None)
            mfccs = np.mean(librosa.feature.mfcc(y=speech, sr=sample_rate, n_mfcc=40).T, axis=0)
            return mfccs
    except sf.SoundFileError as e:
        print(f"SoundFileError occurred: {e}")
        return None
    except Exception as e:
        print(f"Error extracting features from {audio_file}: {e}")
        return None


def infer_speech_emotion(audio_file):
    """
    Infer the emotion from an audio file using a pre-trained speech emotion recognition model.
    :param audio_file:
    :return: The predicted emotion
    """
    if audio_file.endswith('.mp4'):
        audio_file = convert_mp4_to_wav(audio_file)
        if not audio_file:
            return None

    model, scaler = load_speech_emotion_model()

    features = extract_features(audio_file)
    if features is None:
        return None

    features_scaled = scaler.transform(features.reshape(1, -1))

    emotion_prediction = model.predict(features_scaled)

    if audio_file == "temp_audio.wav" and os.path.exists(audio_file):
        os.remove(audio_file)

    return emotion_prediction[0]
