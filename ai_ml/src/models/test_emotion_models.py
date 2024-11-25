import os

# Import the inference functions for each model
from ai_ml.src.models.text_emotion import infer_text_emotion
from ai_ml.src.models.speech_emotion import infer_speech_emotion
from ai_ml.src.models.facial_emotion import infer_facial_emotion
from ai_ml.src.recommendation.music_recommendation import get_music_recommendation


# Function to display music recommendations
def display_music_recommendations(emotion):
    """
    Display music recommendations based on the detected emotion.

    :param emotion: The detected emotion.
    :return: None
    """
    print(f"\n--- Music Recommendations for the Emotion '{emotion}' ---")
    recommended_tracks = get_music_recommendation(emotion)

    if recommended_tracks:
        for idx, track in enumerate(recommended_tracks, 1):
            print(f"{idx}. {track['name']} by {track['artist']}")
            if track['preview_url']:
                print(f"   Preview: {track['preview_url']}")
            print(f"   Listen on Spotify: {track['external_url']}")
    else:
        print(f"No music recommendations available for the emotion: {emotion}")


# Test Text-Based Emotion Model
def test_text_emotion():
    """
    Test the text-based emotion model with sample text inputs.

    :return: None
    """
    print("\n--- Testing Text-Based Emotion Model ---")
    # Example test inputs
    sample_texts = [
        "I am extremely happy today!",
        "This is a terrible experience.",
        "I feel so loved and appreciated.",
        "I am very scared about the future.",
        "I am so angry right now.",
        "This is disgusting!",
        "I am surprised by the news.",
        "I feel so calm and peaceful.",
        "I am feeling neutral.",
        "I am feeling a mix of emotions right now.",
        "I am feeling a bit sad.",
        "I am feeling a bit fearful."
    ]

    for text in sample_texts:
        emotion = infer_text_emotion(text)
        print(f"Text: '{text}' => Predicted Emotion: {emotion}")
        # Display music recommendations based on the detected emotion
        display_music_recommendations(emotion)


# Test Speech-Based Emotion Model
# Current test path: C:/Users/hoang/PycharmProjects/Emotion-Based-Music-App/Emotion-Based-Music-App/ai_ml/src/models/test_data/speech.mp4
def test_speech_emotion(audio_file_path):
    """
    Test the speech-based emotion model with a sample audio file.

    :param audio_file_path: The path to the audio file.
    :return: None
    """
    print("\n--- Testing Speech-Based Emotion Model ---")
    if not os.path.isfile(audio_file_path):
        print(f"Error: The audio file '{audio_file_path}' does not exist.")
        return

    emotion = infer_speech_emotion(audio_file_path)
    print(f"Predicted Emotion for '{audio_file_path}': {emotion}")
    # Display music recommendations based on the detected emotion
    display_music_recommendations(emotion)


# Test Facial Emotion Model
# Current test path: C:/Users/hoang/PycharmProjects/Emotion-Based-Music-App/Emotion-Based-Music-App/ai_ml/src/models/test_data/surprised.jpg
def test_facial_emotion(image_file_path):
    """
    Test the facial emotion model with a sample image file.

    :param image_file_path: The path to the image file.
    :return: None
    """
    print("\n--- Testing Facial Emotion Model ---")
    if not os.path.isfile(image_file_path):
        print(f"Error: The image file '{image_file_path}' does not exist.")
        return

    emotion = infer_facial_emotion(image_file_path)
    print(f"Predicted Emotion for '{image_file_path}': {emotion}")
    # Display music recommendations based on the detected emotion
    display_music_recommendations(emotion)


# Main function to interactively ask the user for input and test the models
if __name__ == "__main__":
    print("Which model would you like to test?")
    model_choice = input(
        "Enter 'text' for Text Model, 'speech' for Speech Model, 'facial' for Facial Model, or 'all' for all models: ").strip().lower()

    if model_choice not in ["text", "speech", "facial", "all"]:
        print("Invalid choice. Please enter 'text', 'speech', 'facial', or 'all'.")
    else:
        # Test the specified models based on the user's choice
        if model_choice == "text" or model_choice == "all":
            test_text_emotion()

        if model_choice == "speech" or model_choice == "all":
            audio_file_path = input("Please enter the path to the audio file: ").strip()
            if audio_file_path:
                test_speech_emotion(audio_file_path)
            else:
                print("Audio file path cannot be empty.")

        if model_choice == "facial" or model_choice == "all":
            image_file_path = input("Please enter the path to the image file: ").strip()
            if image_file_path:
                test_facial_emotion(image_file_path)
            else:
                print("Image file path cannot be empty.")
