import numpy as np
import torch
import cv2
import os
import random

# Dynamically define the base directory (two levels up from the current file)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Define the correct relative model path (from BASE_DIR)
MODEL_PATH = os.path.join(BASE_DIR, 'models', 'facial_emotion_model', 'trained_facial_emotion_model.pt')

# Emotion to genre mapping
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

# Load the model globally
_model = None


def load_facial_emotion_model():
    """
    Load the pre-trained facial emotion model.

    :return: The loaded model.
    """
    global _model
    if _model is None:
        print("Loading facial emotion model for the first time...")
        _model = torch.load(MODEL_PATH)
    return _model


def infer_facial_emotion(image_file):
    """
    Infer the facial emotion from the given image file.

    :param image_file: The path to the image file.
    :return: The detected emotion.
    """
    try:
        # Load the pre-trained facial emotion model
        model = load_facial_emotion_model()

        # Read and process the image using OpenCV
        image = cv2.imread(image_file)

        if image is None:
            print(f"Error: Failed to read image from {image_file}. The image might be corrupted or invalid.")
            return None

        print(f"Processing image with shape: {image.shape}, dtype: {image.dtype}")

        # Check the range of pixel values to ensure they're within [0, 255]
        print(f"Image pixel value range: min={image.min()}, max={image.max()}")

        # Analyze the emotion from the image using the model
        emotion, score = model.top_emotion(image)  # Adjust this method call as needed
        print(f"Emotion detected: {emotion}, score: {score}")

        # Check if emotion is None or score is None
        if emotion is None or score is None:
            print("Warning: Model failed to detect emotion or score is invalid.")
            # Select a random emotion if the model fails to detect one
            emotion = random.choice(list(emotion_to_genre.keys()))
            print(f"No emotion detected. Randomly selected emotion: {emotion}")

        return emotion

    except AttributeError as attr_error:
        print(f"AttributeError during facial emotion inference: {attr_error}")
        # Select a random emotion in case of an AttributeError
        return random.choice(list(emotion_to_genre.keys()))
    except Exception as general_error:
        print(f"General error during facial emotion inference: {general_error}")
        # Select a random emotion in case of any other error
        return random.choice(list(emotion_to_genre.keys()))


def preprocess_image(image_file, target_size=(48, 48)):
    """
    Preprocess the image before feeding it to the model.
    Resize, normalize, and adjust channels as needed.

    :param image_file: The path to the image file.
    :param target_size: The target size for the image.
    :return: The preprocessed image.
    """
    # Read the image using OpenCV
    image = cv2.imread(image_file, cv2.IMREAD_COLOR)

    if image is None:
        raise ValueError("Failed to read the image file")

    # Resize the image to the target size (model's expected input size)
    image = cv2.resize(image, target_size)

    # Normalize pixel values to range [0, 1]
    image = image.astype('float32') / 255.0

    if len(image.shape) == 3 and image.shape[2] == 3:  # If it's an RGB image
        image = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # If the model expects a 3D tensor, expand dimensions: (height, width) -> (1, height, width)
    image = np.expand_dims(image, axis=0)

    # Add a channel dimension if required by the model (e.g., if the model expects shape (1, 48, 48, 1))
    if len(image.shape) == 2:
        image = np.expand_dims(image, axis=-1)

    # Add the batch dimension: (1, height, width, channels)
    image = np.expand_dims(image, axis=0)

    return image
