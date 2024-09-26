# Configuration with direct string paths

CONFIG = {
    "model_name": "bert-base-uncased",
    "num_labels": 6,
    "batch_size": 16,
    "num_epochs": 4,
    "learning_rate": 2e-5,
    "train_data_path": "C:/Users/hoang/PycharmProjects/Emotion-Based-Music-App/Emotion-Based-Music-App/ai_ml/data/training.csv",
    "test_data_path": "C:/Users/hoang/PycharmProjects/Emotion-Based-Music-App/Emotion-Based-Music-App/ai_ml/data/test.csv",
    "spotify_client_id": "15bbb2d04cc8434cb478688897605501",  # Replace with your own client ID
    "spotify_client_secret": "8655b91da2414a4c8f42b12c7cc0a191",  # Replace with your own client secret
    "output_dir": "C:/Users/hoang/PycharmProjects/Emotion-Based-Music-App/Emotion-Based-Music-App/ai_ml/models/text_emotion_model",
    "speech_emotion_model_path": "C:/Users/hoang/PycharmProjects/Emotion-Based-Music-App/Emotion-Based-Music-App/ai_ml/models/pre_trained_models/speech_emotion_model",
    "facial_emotion_model_path": "C:/Users/hoang/PycharmProjects/Emotion-Based-Music-App/Emotion-Based-Music-App/ai_ml/models/pre_trained_models/facial_emotion_model",
    "api_port": 5000,
    "max_length": 128
}
