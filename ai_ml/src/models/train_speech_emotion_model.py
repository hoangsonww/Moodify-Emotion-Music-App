import os
import numpy as np
import librosa
import pickle

from moviepy.editor import AudioFileClip
from sklearn.svm import SVC
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, classification_report

# Define the path to your dataset
DATASET_PATH = "/Users/davidnguyen/PycharmProjects/Moodify-Emotion-Music-App/ai_ml/data"  # Update this path as needed

# Define the directory where the model will be saved
MODEL_SAVE_PATH = "/Users/davidnguyen/PycharmProjects/Moodify-Emotion-Music-App/ai_ml/models/speech_emotion_model"

# Create the save directory if it doesn't exist
os.makedirs(MODEL_SAVE_PATH, exist_ok=True)

# Define the list of emotions we're interested in
emotion_labels = {
    '01': 'neutral', '02': 'calm', '03': 'happy', '04': 'sad',
    '05': 'angry', '06': 'fearful', '07': 'disgust', '08': 'surprise'
}


def extract_features(file_name):
    """
    Extract MFCC features from an audio file using librosa.
    Handles both .wav and .mp4 files.

    :param file_name: The path to the audio file.
    :return: The extracted MFCC features
    """
    try:
        # If the file is an mp4, convert it to wav using moviepy
        if file_name.endswith('.mp4'):
            audio_clip = AudioFileClip(file_name)
            audio_clip.audio.write_audiofile("temp_audio.wav")
            file_name = "temp_audio.wav"

        # Load the audio file
        audio_data, sample_rate = librosa.load(file_name, res_type='kaiser_fast')

        # Extract MFCC features
        mfccs = np.mean(librosa.feature.mfcc(y=audio_data, sr=sample_rate, n_mfcc=40).T, axis=0)

        # If we used a temp file, remove it
        if file_name == "temp_audio.wav":
            os.remove("temp_audio.wav")

        return mfccs

    except Exception as e:
        print(f"Error encountered while parsing file: {file_name}, error: {str(e)}")
        return None


def load_data(dataset_path):
    """
    Load the dataset and extract features and labels.

    :param dataset_path: The path to the dataset directory.
    :return: The extracted features and labels.
    """
    X = []
    y = []

    # Traverse through all files in the dataset directory
    for subdir, dirs, files in os.walk(dataset_path):
        for file in files:
            if file.endswith(".wav") or file.endswith(".mp4"):
                print(f"Processing file: {file}")
                # Extract the emotion label from the filename (based on RAVDESS format)
                emotion_code = file.split("-")[2]
                emotion = emotion_labels.get(emotion_code)

                if emotion is not None:
                    # Extract features
                    feature = extract_features(os.path.join(subdir, file))
                    if feature is not None:
                        X.append(feature)
                        y.append(emotion)
                else:
                    print(f"Skipping file with unrecognized emotion code: {file}")

    print(f"Total samples loaded: {len(X)}")
    return np.array(X), np.array(y)


def train_speech_emotion_model(X, y):
    """
    Train a speech emotion recognition model using SVM.

    :param X: The features.
    :param y: The labels.
    :return: None
    """
    # Split the dataset into training and testing sets
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # Standardize the features
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # Train an SVM model
    model = SVC(kernel='linear', probability=True)
    model.fit(X_train_scaled, y_train)

    # Evaluate the model
    y_pred = model.predict(X_test_scaled)
    print("Training Accuracy:", accuracy_score(y_train, model.predict(X_train_scaled)))
    print("Test Accuracy:", accuracy_score(y_test, y_pred))
    print("\nClassification Report:\n", classification_report(y_test, y_pred))

    # Save the trained model and scaler to the specified directory
    model_file_path = os.path.join(MODEL_SAVE_PATH, 'trained_speech_emotion_model.pkl')
    scaler_file_path = os.path.join(MODEL_SAVE_PATH, 'scaler.pkl')

    with open(model_file_path, 'wb') as file:
        pickle.dump(model, file)
    with open(scaler_file_path, 'wb') as file:
        pickle.dump(scaler, file)

    print(f"Model and scaler saved successfully in {MODEL_SAVE_PATH}.")


if __name__ == "__main__":
    # Load data
    print("Loading data...")
    X, y = load_data(DATASET_PATH)
    print(f"Loaded {len(X)} samples.")

    # Train the model
    print("Training the model...")
    train_speech_emotion_model(X, y)
    print("Training completed.")
