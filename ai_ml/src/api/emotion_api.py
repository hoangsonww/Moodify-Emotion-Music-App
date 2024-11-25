from flask import Flask, request, jsonify
from ai_ml.src.models.text_emotion import infer_text_emotion
from ai_ml.src.models.speech_emotion import infer_speech_emotion
from ai_ml.src.models.facial_emotion import infer_facial_emotion
from ai_ml.src.recommendation.music_recommendation import get_music_recommendation
import os
import tempfile
from ai_ml.src.config import CONFIG
from flask_cors import CORS  # Import CORS

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes


@app.route("/text_emotion", methods=["POST"])
def text_emotion():
    """
    This function retrieves the emotion from the text input and returns music recommendations based on the emotion.

    :return: The response object containing the emotion and music recommendations.
    """
    data = request.json
    text = data.get("text", "") if data else ""

    if not text:
        return jsonify({"error": "No text provided"}), 400

    emotion = infer_text_emotion(text)
    # Get music recommendations based on the detected emotion
    recommendations = get_music_recommendation(emotion)

    return jsonify({"emotion": emotion, "recommendations": recommendations})


@app.route("/speech_emotion", methods=["POST"])
def speech_emotion():
    """
    This function retrieves the emotion from the speech input and returns music recommendations based on the emotion.

    :return: The response object containing the emotion and music recommendations.
    """
    if 'file' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    audio_file = request.files["file"]

    # Save the uploaded audio file to a temporary location for processing
    temp_file_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_file:
            audio_file.save(temp_file.name)
            temp_file_path = temp_file.name

        # Infer emotion from the speech file
        emotion = infer_speech_emotion(temp_file_path)

        # Get music recommendations based on the detected emotion
        recommendations = get_music_recommendation(emotion)

        return jsonify({"emotion": emotion, "recommendations": recommendations})

    finally:
        # Clean up the temporary file
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)


@app.route("/facial_emotion", methods=["POST"])
def facial_emotion():
    """
    This function retrieves the emotion from the facial image input and returns music recommendations based on the emotion.

    :return: The response object containing the emotion and music recommendations.
    """
    if 'file' not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    image_file = request.files["file"]

    # Save the uploaded image file to a temporary location for processing
    temp_file_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as temp_file:
            image_file.save(temp_file.name)
            temp_file_path = temp_file.name

        # Infer emotion from the facial image file
        emotion = infer_facial_emotion(temp_file_path)

        # Get music recommendations based on the detected emotion
        recommendations = get_music_recommendation(emotion)

        return jsonify({"emotion": emotion, "recommendations": recommendations})

    finally:
        # Clean up the temporary file
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)


@app.route("/music_recommendation", methods=["POST"])
def music_recommendation():
    """
    This function retrieves music recommendations based on the provided emotion.

    :return: The response object containing the emotion and music recommendations.
    """
    data = request.json
    emotion = data.get("emotion", "") if data else ""

    if not emotion:
        return jsonify({"error": "No emotion provided"}), 400

    recommendations = get_music_recommendation(emotion)
    return jsonify({"emotion": emotion, "recommendations": recommendations})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=CONFIG["api_port"], debug=True)

