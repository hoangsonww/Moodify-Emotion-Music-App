import torch
import cv2
import os

# Define the path where the facial emotion model is saved
MODEL_PATH = "C:/Users/hoang/PycharmProjects/Emotion-Based-Music-App/Emotion-Based-Music-App/ai_ml/models/facial_emotion_model/trained_facial_emotion_model.pt"


def load_facial_emotion_model():
    """
    Load the pre-trained facial emotion model from the saved path.
    """
    model = torch.load(MODEL_PATH)
    return model


def infer_facial_emotion(image_file):
    # Load the pre-trained facial emotion model
    model = load_facial_emotion_model()

    # Read and process the image using OpenCV
    image = cv2.imread(image_file)

    # Analyze the emotion from the image using the model
    emotion, score = model.top_emotion(image)

    return emotion
