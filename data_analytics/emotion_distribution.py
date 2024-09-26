import os
import pandas as pd
import matplotlib.pyplot as plt

# Check if the visualizations folder exists, if not, create it
visualizations_folder = "visualizations"
os.makedirs(visualizations_folder, exist_ok=True)

# Load the training data
train_data_path = "C:/Users/hoang/PycharmProjects/Emotion-Based-Music-App/Emotion-Based-Music-App/ai_ml/data/training.csv"
df = pd.read_csv(train_data_path)

# Map labels to emotion names (based on your data mapping)
emotion_mapping = {0: "sadness", 1: "joy", 2: "love", 3: "anger", 4: "fear"}
df['emotion'] = df['label'].map(emotion_mapping)

# Visualize the emotion distribution
plt.figure(figsize=(10, 6))
df['emotion'].value_counts().plot(kind='bar', color='skyblue', edgecolor='black')
plt.title("Emotion Distribution in Training Dataset")
plt.xlabel("Emotions")
plt.ylabel("Frequency")
plt.xticks(rotation=45)
plt.tight_layout()

# Save and display the plot
plt.savefig(os.path.join(visualizations_folder, "emotion_distribution.png"))
plt.show()
