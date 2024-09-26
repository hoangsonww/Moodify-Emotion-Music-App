import pandas as pd
import matplotlib.pyplot as plt
from ai_ml.src.models.text_emotion import infer_text_emotion
from ai_ml.src.models.speech_emotion import infer_speech_emotion
from ai_ml.src.models.facial_emotion import infer_facial_emotion

# Sample test data
test_texts = [
    "I am extremely happy today!",
    "This is a terrible experience.",
    "I feel so loved and appreciated.",
    "I am very scared about the future.",
    "I am feeling sad.",
    "I am feeling angry."
]

# Analyze predictions for text data
predicted_emotions = [infer_text_emotion(text) for text in test_texts]
emotion_counts = pd.Series(predicted_emotions).value_counts()

plt.figure(figsize=(10, 6))
emotion_counts.plot(kind='bar', color='lightcoral', edgecolor='black')
plt.title("Distribution of Predicted Emotions (Text Data)")
plt.xlabel("Emotion")
plt.ylabel("Frequency")
plt.xticks(rotation=45)
plt.tight_layout()

plt.savefig("visualizations/text_emotion_predictions.png")
plt.show()
