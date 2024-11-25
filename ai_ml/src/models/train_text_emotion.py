import torch

from transformers import AutoModelForSequenceClassification, Trainer, TrainingArguments, AutoTokenizer
from datasets import Dataset

import pandas as pd
import sys
import os

# Ensure that the script can import CONFIG from your config.py
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../')))
from ai_ml.src.config import CONFIG


def load_data():
    """
    Load the training and test data from the CSV files and preprocess them.

    :return: The preprocessed training and test data.
    """
    # Read the training and test data
    df = pd.read_csv(CONFIG["train_data_path"])
    test_df = pd.read_csv(CONFIG["test_data_path"])

    # Rename columns to ensure consistency
    df = df.rename(columns={'text': 'text', 'label': 'label'})
    test_df = test_df.rename(columns={'text': 'text', 'label': 'label'})

    # Filter out rows with the label '5' (surprise)
    df = df[df['label'] != 5]
    test_df = test_df[test_df['label'] != 5]

    return df, test_df


def preprocess_and_tokenize():
    """
    Preprocess the data and tokenize the text data using the pre-trained tokenizer.

    :return: The preprocessed training and test datasets and the tokenizer.
    """
    df, test_df = load_data()
    tokenizer = AutoTokenizer.from_pretrained(CONFIG["model_name"])

    # Create Hugging Face Datasets
    train_dataset = Dataset.from_pandas(df)
    test_dataset = Dataset.from_pandas(test_df)

    # Tokenize the text data and ensure the label is correctly formatted
    def tokenize_function(examples):
        return tokenizer(examples['text'], padding="max_length", truncation=True, max_length=CONFIG["max_length"])

    train_dataset = train_dataset.map(tokenize_function, batched=True)
    test_dataset = test_dataset.map(tokenize_function, batched=True)

    # Ensure label columns are integers
    train_dataset = train_dataset.map(lambda x: {"label": int(x["label"])})
    test_dataset = test_dataset.map(lambda x: {"label": int(x["label"])})

    # Set the format for PyTorch
    train_dataset.set_format(type='torch', columns=['input_ids', 'attention_mask', 'label'])
    test_dataset.set_format(type='torch', columns=['input_ids', 'attention_mask', 'label'])

    return train_dataset, test_dataset, tokenizer  # Return the tokenizer


class CustomTrainer(Trainer):
    """
    Custom Trainer class to log training and validation metrics after each epoch and display them to the console.

    :param Trainer: The Hugging Face Trainer class.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.log_history = []

    def log(self, logs: dict):
        """
        Log the training and validation metrics after each epoch.

        :param logs: The dictionary containing the training and validation metrics.
        :return: None
        """
        super().log(logs)
        if "epoch" in logs:
            self.log_history.append(logs)
            # Output the training metrics to the console
            epoch = logs["epoch"]
            train_loss = logs.get("loss", "N/A")
            eval_loss = logs.get("eval_loss", None)
            eval_accuracy = logs.get("eval_accuracy", None)

            if eval_loss is not None and eval_accuracy is not None:
                print(
                    f"Epoch {epoch}: Train Loss = {train_loss}, Eval Loss = {eval_loss}, Eval Accuracy = {eval_accuracy}")
            else:
                print(f"Epoch {epoch}: Train Loss = {train_loss}")

    def save_log_history(self, output_dir):
        """
        Save the training log history to a CSV file.

        :param output_dir: The output directory to save the log file.
        :return: None
        """
        df = pd.DataFrame(self.log_history)
        df.to_csv(os.path.join(output_dir, "training_log.csv"), index=False)


def train_text_emotion_model():
    """
    Train the text emotion classification model using the pre-trained BERT model.

    :return: None
    """
    # Load and preprocess the data
    train_dataset, test_dataset, tokenizer = preprocess_and_tokenize()

    # Load the pre-trained BERT model for sequence classification
    model = AutoModelForSequenceClassification.from_pretrained(CONFIG["model_name"],
                                                               num_labels=5)

    # Check if CUDA (GPU) is available and move the model to GPU if it is
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)

    # Define training arguments, enabling GPU-specific settings
    training_args = TrainingArguments(
        output_dir=CONFIG["output_dir"],
        num_train_epochs=CONFIG["num_epochs"],
        per_device_train_batch_size=CONFIG["batch_size"],
        per_device_eval_batch_size=CONFIG["batch_size"],
        eval_strategy="epoch",
        logging_dir='../logs',
        save_strategy="epoch",
        load_best_model_at_end=True,
        fp16=torch.cuda.is_available(),
        report_to="none",
        logging_steps=10,
    )

    # Initialize the Custom Trainer
    trainer = CustomTrainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=test_dataset,
    )

    # Start training the model
    trainer.train()

    # Save the fine-tuned model and tokenizer
    model.save_pretrained(CONFIG["output_dir"])
    tokenizer.save_pretrained(CONFIG["output_dir"])

    # Save the training log
    trainer.save_log_history(CONFIG["output_dir"])

    # Display a summary of the training process
    print("\nTraining completed successfully!")
    print("Final training results:")
    print(pd.DataFrame(trainer.log_history).tail())


if __name__ == "__main__":
    train_text_emotion_model()
