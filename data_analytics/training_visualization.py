import pandas as pd
import matplotlib.pyplot as plt
import os

# Check if the visualizations folder exists, if not, create it
visualizations_folder = "visualizations"
os.makedirs(visualizations_folder, exist_ok=True)

# Load the training log data
training_log_path = "C:/Users/hoang/PycharmProjects/Emotion-Based-Music-App/Emotion-Based-Music-App/ai_ml/models/text_emotion_model/training_log.csv"

if not os.path.exists(training_log_path):
    print(f"Training log file not found at: {training_log_path}")
    exit()

df = pd.read_csv(training_log_path)

# Plot Loss Curve
plt.figure(figsize=(10, 6))
plt.plot(df['epoch'], df['loss'], label='Training Loss', color='blue')

# Use 'eval_loss' instead of 'val_loss'
if 'eval_loss' in df.columns:
    plt.plot(df['epoch'], df['eval_loss'], label='Validation Loss', color='orange')

plt.title("Training and Validation Loss")
plt.xlabel("Epoch")
plt.ylabel("Loss")
plt.legend()
plt.grid(True)
plt.tight_layout()
plt.savefig(os.path.join(visualizations_folder, "loss_curve.png"))
plt.show()

# Plot Accuracy Curve
plt.figure(figsize=(10, 6))

# Check if columns exist before plotting
if 'eval_accuracy' in df.columns and 'accuracy' in df.columns:
    plt.plot(df['epoch'], df['accuracy'], label='Train Accuracy', color='green')
    plt.plot(df['epoch'], df['eval_accuracy'], label='Validation Accuracy', color='red')

plt.title("Training and Validation Accuracy")
plt.xlabel("Epoch")
plt.ylabel("Accuracy")
plt.legend()
plt.grid(True)
plt.tight_layout()
plt.savefig(os.path.join(visualizations_folder, "accuracy_curve.png"))
plt.show()
