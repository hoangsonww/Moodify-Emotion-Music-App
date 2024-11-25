import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from ai_ml.src.config import CONFIG


def infer_text_emotion(text):
    """
    Infer the emotion from the given text using the trained text emotion model.

    :param text: The input text.
    :return: The detected emotion.
    """
    tokenizer = AutoTokenizer.from_pretrained(CONFIG["output_dir"])
    model = AutoModelForSequenceClassification.from_pretrained(CONFIG["output_dir"])

    inputs = tokenizer(text, return_tensors="pt", padding=True, truncation=True, max_length=CONFIG["max_length"])

    with torch.no_grad():
        outputs = model(**inputs)

    scores = outputs[0][0].numpy()
    emotion_idx = scores.argmax()

    # Updated emotion labels (excluding 'surprise')
    emotion_labels = ["sadness", "joy", "love", "anger", "fear"]
    return emotion_labels[emotion_idx]
