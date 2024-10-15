import os
import pickle
from fer import FER
import torch

# Define the directory where the model will be saved
MODEL_SAVE_PATH = "/Users/davidnguyen/PycharmProjects/Moodify-Emotion-Music-App/ai_ml/models/facial_emotion_model"

# Create the save directory if it doesn't exist
os.makedirs(MODEL_SAVE_PATH, exist_ok=True)


def save_facial_emotion_model():
    """
    Load the pre-trained facial emotion model from the FER library and save it.
    """
    # Load the pre-trained FER model
    detector = FER(mtcnn=True)  # Using MTCNN for more accurate face detection

    # Save the model using PyTorch's torch.save
    model_file_path = os.path.join(MODEL_SAVE_PATH, "trained_facial_emotion_model.pt")
    torch.save(detector, model_file_path)

    print(f"Facial emotion model saved successfully at {model_file_path}")


if __name__ == "__main__":
    # Save the pre-trained model
    save_facial_emotion_model()
