# **Emotion-Based Music Recommendation - AI/ML Directory**

The `ai_ml` directory contains all the necessary components for building, training, and testing the emotion detection models and integrating them with the emotion-based music recommendation system. This directory handles three main types of emotion detection: text-based, speech-based, and facial-based, with each component designed to work seamlessly with the backend recommendation tool.

## Table of Contents

- [Directory Structure](#directory-structure)
- [Getting Started](#getting-started)
- [Install Dependencies](#1-install-dependencies)
- [Install PyTorch (GPU Support)](#2-install-pytorch-gpu-support)
- [Setting Up Configuration](#3-setting-up-configuration)
- [Training the Text Emotion Model](#4-training-the-text-emotion-model)
- [Testing the Emotion Detection Models](#5-testing-the-emotion-detection-models)
- [Running the Flask APIs](#6-running-the-flask-apis)
- [Testing the APIs on Windows and macOS](#testing-the-apis-on-windows-and-macos)
  - [Testing `/text_emotion` Endpoint](#1-testing-text_emotion-endpoint)
  - [Testing `/speech_emotion` Endpoint](#2-testing-speech_emotion-endpoint)
  - [Testing `/facial_emotion` Endpoint](#3-testing-facial_emotion-endpoint)
  - [Testing `/music_recommendation` Endpoint](#4-testing-music_recommendation-endpoint)
- [Notes and Tips](#notes-and-tips)

## **AI/ML System Architecture**

```mermaid
graph TB
    subgraph "Input Layer"
        A[Text Input]
        B[Speech Audio Input]
        C[Facial Image Input]
    end

    subgraph "Preprocessing Layer"
        D[Text Tokenization<br/>BERT Tokenizer]
        E[Audio Feature Extraction<br/>MFCC, Chroma, Spectral]
        F[Face Detection<br/>& Normalization]
    end

    subgraph "Model Layer"
        G[Text Emotion Model<br/>BERT Fine-tuned<br/>5 Emotions]
        H[Speech Emotion Model<br/>CNN + LSTM<br/>7 Emotions]
        I[Facial Emotion Model<br/>ResNet50<br/>7 Emotions]
    end

    subgraph "Post-Processing"
        J[Emotion Classification]
        K[Confidence Scoring]
        L[Result Aggregation]
    end

    subgraph "Recommendation Engine"
        M[Emotion-to-Genre Mapping]
        N[Spotify API Integration]
        O[Track Filtering & Ranking]
    end

    subgraph "Output"
        P[Recommended Tracks]
    end

    A --> D
    B --> E
    C --> F
    D --> G
    E --> H
    F --> I
    G --> J
    H --> J
    I --> J
    J --> K
    K --> L
    L --> M
    M --> N
    N --> O
    O --> P

    style A fill:#4CAF50
    style B fill:#2196F3
    style C fill:#FF9800
    style G fill:#FF6F00
    style H fill:#FF6F00
    style I fill:#FF6F00
    style M fill:#9C27B0
    style N fill:#1DB954
    style P fill:#34A853
```

## **Directory Structure**

Here's a detailed breakdown of the directory and its contents:

```
ai_ml/
├── data/
│   ├── training.csv                # Training dataset for the text emotion model
│   └── test.csv                    # Test dataset for evaluating the text emotion model
│
├── models/
│   ├── text_emotion_model/         # Directory containing the trained text emotion model
│   ├── speech_emotion_model/       # Directory containing the trained speech emotion model and scaler
│   │   ├── trained_speech_emotion_model.pkl  # Trained speech emotion model saved as a pickle file
│   │   └── scaler.pkl              # Scaler used for speech emotion feature normalization
│   └── facial_emotion_model/       # Directory intended to store the facial emotion model
│
└── src/
    ├── api/
    │   └── emotion_api.py          # Flask API to test the emotion detection and music recommendation models
    │
    ├── config.py                   # Configuration file containing settings and credentials (e.g., Spotify API credentials)
    │
    ├── utils.py                    # Utility functions, including fetching Spotify access tokens
    │
    ├── recommendation/
    │   └── music_recommendation.py # Contains logic to fetch music recommendations based on detected emotions
    │
    ├── models/
    │   ├── text_emotion.py         # Code for predicting emotions from text inputs
    │   ├── speech_emotion.py       # Code for predicting emotions from speech inputs
    │   ├── facial_emotion.py       # Code for predicting emotions from facial image inputs
    │   ├── download_models.py      # Script to download pre-trained models for speech and facial emotion detection
    │   ├── train_text_emotion.py   # Script to train the text emotion model
    │   └── test_emotion_models.py  # Script to test all emotion models and get music recommendations
    │
    └── data_processing/
        ├── preprocess_text.py      # Optional file for additional preprocessing (if needed)
        └── feature_extraction.py   # Contains functions for extracting features from audio files (used in speech model training)
```

## **Getting Started**

Follow these steps to get started with the project:

### **1. Install Dependencies**

It’s recommended to set up a virtual environment before installing the required packages.

```bash
# Create a virtual environment
python -m venv .venv

# Activate the virtual environment
# On Windows
.venv\Scripts\activate

# On Linux/macOS
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### **2. Install PyTorch (GPU Support)**

If you want to train models using GPU support, install PyTorch with CUDA:

```bash
pip3 install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
```

This installation command is optimized for CUDA 11.8. Check the [official PyTorch website](https://pytorch.org/get-started/locally/) for other CUDA versions.

### **3. Setting Up Configuration**

Update the `config.py` file with your Spotify API credentials and other configuration settings:
```python
CONFIG = {
    "model_name": "bert-base-uncased",
    "num_labels": 5,  # Number of emotion labels
    "batch_size": 16,
    "num_epochs": 4,
    "learning_rate": 2e-5,
    "train_data_path": "C:/Users/hoang/PycharmProjects/Emotion-Based-Music-App/Emotion-Based-Music-App/ai_ml/data/training.csv",  # Replace with your data path
    "test_data_path": "C:/Users/hoang/PycharmProjects/Emotion-Based-Music-App/Emotion-Based-Music-App/ai_ml/data/test.csv", # Replace with your data path
    "output_dir": "C:/Users/hoang/PycharmProjects/Emotion-Based-Music-App/Emotion-Based-Music-App/ai_ml/models/text_emotion_model", # Replace with your data path
    "speech_emotion_model_path": "C:/Users/hoang/PycharmProjects/Emotion-Based-Music-App/Emotion-Based-Music-App/ai_ml/models/speech_emotion_model", # Replace with your data path
    "facial_emotion_model_path": "C:/Users/hoang/PycharmProjects/Emotion-Based-Music-App/Emotion-Based-Music-App/ai_ml/models/facial_emotion_model", # Replace with your data path
    "spotify_client_id": "your_spotify_client_id",  # Replace with your Spotify client ID
    "spotify_client_secret": "your_spotify_client_secret",  # Replace with your Spotify client secret
    "api_port": 5000,
    "max_length": 128,
}
```

### **4. Training the Text Emotion Model**

The `train_text_emotion.py` script trains a BERT-based text emotion model using the dataset found in `data/training.csv`. To start training, run:

```bash
python ai_ml/src/models/train_text_emotion.py
```

Note that, by default, the model will be trained using GPU support if available. If you want to train the model on the CPU, you can modify the script to use the CPU instead.
Before training by GPU, make sure you have installed the necessary dependencies and set up PyTorch with CUDA support.

### **Model Training Workflow**

```mermaid
flowchart TD
    A[Start Training] --> B[Load Configuration]
    B --> C[Check GPU Availability]
    C -->|GPU Available| D[Initialize CUDA]
    C -->|No GPU| E[Use CPU]
    D --> F[Load Dataset]
    E --> F
    F --> G[Data Preprocessing]

    G --> H{Data Augmentation}
    H -->|Text| I[Synonym Replacement<br/>Back Translation]
    H -->|Speech| J[Pitch Shifting<br/>Time Stretching<br/>Noise Addition]
    H -->|Image| K[Rotation<br/>Flip<br/>Brightness Adjustment]

    I --> L[Split Train/Val/Test]
    J --> L
    K --> L

    L --> M[Initialize Model]
    M --> N[Set Optimizer & Scheduler]
    N --> O[Training Loop]

    O --> P{Epoch Complete?}
    P -->|No| Q[Forward Pass]
    Q --> R[Calculate Loss]
    R --> S[Backward Pass]
    S --> T[Update Weights]
    T --> U[Validate on Val Set]
    U --> V{Early Stopping?}
    V -->|No| P
    V -->|Yes| W[Save Best Model]
    P -->|Yes| W

    W --> X[Evaluate on Test Set]
    X --> Y[Generate Metrics Report]
    Y --> Z[Save Model Artifacts]
    Z --> AA[Training Complete]

    style A fill:#4CAF50
    style D fill:#FF6F00
    style E fill:#FFC107
    style M fill:#2196F3
    style W fill:#9C27B0
    style AA fill:#4CAF50
```

### **Text Emotion Model Architecture**

```mermaid
graph TB
    subgraph "Input Processing"
        A[Input Text] --> B[BERT Tokenizer]
        B --> C[Token IDs<br/>Attention Masks]
    end

    subgraph "BERT Base Model"
        C --> D[Embedding Layer<br/>768 dimensions]
        D --> E[Transformer Encoder 1]
        E --> F[Transformer Encoder 2]
        F --> G[...]
        G --> H[Transformer Encoder 12]
        H --> I[Pooled Output<br/>CLS Token]
    end

    subgraph "Classification Head"
        I --> J[Dropout 0.3]
        J --> K[Linear Layer<br/>768 -> 256]
        K --> L[ReLU Activation]
        L --> M[Dropout 0.3]
        M --> N[Linear Layer<br/>256 -> 5]
        N --> O[Softmax]
    end

    subgraph "Output"
        O --> P[Emotion Probabilities<br/>Joy, Sadness, Anger<br/>Fear, Surprise]
    end

    style A fill:#4CAF50
    style D fill:#2196F3
    style E fill:#2196F3
    style I fill:#FF9800
    style O fill:#9C27B0
    style P fill:#4CAF50
```

### **Speech Emotion Model Architecture**

```mermaid
graph TB
    subgraph "Audio Input"
        A[Audio File<br/>WAV/MP3] --> B[Librosa Loader<br/>Sample Rate: 22050]
    end

    subgraph "Feature Extraction"
        B --> C[MFCC Features<br/>40 coefficients]
        B --> D[Chroma Features<br/>12 dimensions]
        B --> E[Spectral Contrast<br/>7 bands]
        B --> F[Zero Crossing Rate]
        C --> G[Feature Concatenation<br/>193 features]
        D --> G
        E --> G
        F --> G
    end

    subgraph "Preprocessing"
        G --> H[Normalization<br/>StandardScaler]
        H --> I[Reshape for CNN<br/>time_steps x features]
    end

    subgraph "CNN Layers"
        I --> J[Conv1D<br/>64 filters, kernel=3]
        J --> K[BatchNorm + ReLU]
        K --> L[MaxPooling<br/>pool_size=2]
        L --> M[Conv1D<br/>128 filters, kernel=3]
        M --> N[BatchNorm + ReLU]
        N --> O[MaxPooling<br/>pool_size=2]
    end

    subgraph "LSTM Layers"
        O --> P[LSTM<br/>128 units, return_sequences]
        P --> Q[Dropout 0.3]
        Q --> R[LSTM<br/>64 units]
        R --> S[Dropout 0.3]
    end

    subgraph "Dense Layers"
        S --> T[Dense<br/>64 units, ReLU]
        T --> U[Dropout 0.4]
        U --> V[Dense<br/>7 units, Softmax]
    end

    subgraph "Output"
        V --> W[Emotions<br/>Neutral, Calm, Happy<br/>Sad, Angry, Fearful, Disgust]
    end

    style A fill:#2196F3
    style G fill:#FF9800
    style J fill:#9C27B0
    style P fill:#E91E63
    style V fill:#4CAF50
    style W fill:#4CAF50
```

### **Facial Emotion Model Architecture**

```mermaid
graph TB
    subgraph "Image Input"
        A[Image File<br/>JPG/PNG] --> B[Face Detection<br/>Haar Cascade/MTCNN]
        B --> C[Crop Face Region]
        C --> D[Resize to 224x224]
        D --> E[Normalize<br/>ImageNet Stats]
    end

    subgraph "ResNet50 Backbone"
        E --> F[Conv1: 7x7, 64]
        F --> G[MaxPool: 3x3]
        G --> H[ResBlock 1<br/>64 filters x 3]
        H --> I[ResBlock 2<br/>128 filters x 4]
        I --> J[ResBlock 3<br/>256 filters x 6]
        J --> K[ResBlock 4<br/>512 filters x 3]
        K --> L[Global Average Pool]
    end

    subgraph "Custom Classification Head"
        L --> M[Flatten<br/>2048 features]
        M --> N[Dropout 0.5]
        N --> O[Dense<br/>512 units, ReLU]
        O --> P[BatchNorm]
        P --> Q[Dropout 0.3]
        Q --> R[Dense<br/>256 units, ReLU]
        R --> S[Dense<br/>7 units, Softmax]
    end

    subgraph "Output"
        S --> T[Emotions<br/>Angry, Disgust, Fear<br/>Happy, Sad, Surprise, Neutral]
    end

    style A fill:#FF9800
    style B fill:#2196F3
    style H fill:#9C27B0
    style I fill:#9C27B0
    style J fill:#9C27B0
    style K fill:#9C27B0
    style S fill:#4CAF50
    style T fill:#4CAF50
```

### **Expected Output**
After training, the model and tokenizer will be saved in the `models/text_emotion_model` directory. Below is an example of the expected training output:

<p align="center">
  <img src="../images/train_text_model.png" alt="Train text model demo image">
</p>

### **5. Testing the Emotion Detection Models**

To test the emotion detection models (text, speech, and facial), run the `test_emotion_models.py` script:

```bash
python ai_ml/src/models/test_emotion_models.py
```

You will be prompted to choose which model you want to test and provide any necessary input files (audio, image, or text).

### **6. Running the Flask APIs**

A simple REST API is provided using Flask to test the models and receive music recommendations. To start the API:

```bash
python ai_ml/src/api/emotion_api.py
```

### **7. Music Recommendation Model**

The `music_recommendation.py` script contains the logic to fetch music recommendations based on the detected emotions. The script uses the Spotify API to fetch music recommendations for the detected emotion.

To test the music recommendation model, run the following command:

```bash
python ai_ml/src/recommendation/music_recommendation.py
```

### **Endpoints:**

- `/text_emotion`: Detects emotion from text input
- `/speech_emotion`: Detects emotion from speech audio
- `/facial_emotion`: Detects emotion from an image
- `/music_recommendation`: Provides music recommendations based on the detected emotion

Here's a detailed guide on **how to test the APIs on both Windows and macOS** using `cURL`. This will help avoid the problems you faced earlier with PowerShell, as it behaves slightly differently from typical command-line interfaces.

### **Testing the APIs on Windows and macOS**

After running the Flask API using:

```bash
python ai_ml/src/api/emotion_api.py
```

You can test the API endpoints using `cURL` commands. Below are the instructions for **both Windows (PowerShell)** and **macOS/Linux (Terminal)**.

#### **1. Testing `/text_emotion` Endpoint**

#### **Windows (PowerShell)**

```powershell
Invoke-WebRequest -Uri "http://127.0.0.1:5000/text_emotion" `
    -Method POST `
    -ContentType "application/json" `
    -Body '{"text": "I am feeling very happy today!"}' `
    -UseBasicParsing
```

#### **macOS/Linux (Terminal)**

```bash
curl -X POST "http://127.0.0.1:5000/text_emotion" \
    -H "Content-Type: application/json" \
    -d '{"text": "I am feeling very happy today!"}'
```

#### **2. Testing `/speech_emotion` Endpoint**

For testing the speech emotion endpoint, you need to upload an audio file (e.g., `speech.mp4` or `speech.wav`).

#### **Windows (PowerShell)**

```powershell
Invoke-WebRequest -Uri "http://127.0.0.1:5000/speech_emotion" `
    -Method POST `
    -InFile "C:\path\to\your\audio\file\speech.mp4" `
    -ContentType "multipart/form-data" `
    -UseBasicParsing
```

#### **macOS/Linux (Terminal)**

```bash
curl -X POST "http://127.0.0.1:5000/speech_emotion" \
    -F "file=@/path/to/your/audio/file/speech.mp4"
```

#### **3. Testing `/facial_emotion` Endpoint**

For testing the facial emotion endpoint, you need to upload an image file (e.g., `image.jpg`).

#### **Windows (PowerShell)**

```powershell
Invoke-WebRequest -Uri "http://127.0.0.1:5000/facial_emotion" `
    -Method POST `
    -InFile "C:\path\to\your\image\file\image.jpg" `
    -ContentType "multipart/form-data" `
    -UseBasicParsing
```

#### **macOS/Linux (Terminal)**

```bash
curl -X POST "http://127.0.0.1:5000/facial_emotion" \
    -F "file=@/path/to/your/image/file/image.jpg"
```

#### **4. Testing `/music_recommendation` Endpoint**

#### **Windows (PowerShell)**

```powershell
Invoke-WebRequest -Uri "http://127.0.0.1:5000/music_recommendation" `
    -Method POST `
    -ContentType "application/json" `
    -Body '{"emotion": "joy"}' `
    -UseBasicParsing
```

#### **macOS/Linux (Terminal)**

```bash
curl -X POST "http://127.0.0.1:5000/music_recommendation" \
    -H "Content-Type: application/json" \
    -d '{"emotion": "joy"}'
```

#### **Explanation:**

- **Windows PowerShell**:
  - PowerShell uses the built-in `Invoke-WebRequest` command for HTTP requests, which differs from the traditional `curl` command.
  - Use backticks (`\``) to break lines in PowerShell.
  - The `-UseBasicParsing` flag is needed in newer versions of PowerShell to bypass certain security checks.

- **macOS/Linux**:
  - Use `curl` with the `-X POST` flag for POST requests.
  - The `-F` flag is used for uploading files, while `-d` is used to send data in JSON format.


### **Notes and Tips**

- **Pre-trained Models:** The `download_models.py` script in `models/` can be used to download pre-trained models for speech and facial emotion detection. These models should be saved in their respective directories (`models/speech_emotion_model` and `models/facial_emotion_model`).
- **Data Handling:** Place your datasets (training and test data) in the `data/` folder before training or testing.

## Contact

If you have any questions or need further assistance, feel free to reach out to me at [hoangson091104@gmail.com](mailto:hoangson091104@gmail.com).

---

Happy training and testing! 🚀

[🔝 Back to Top](#emotion-based-music-recommendation---aiml-directory)
