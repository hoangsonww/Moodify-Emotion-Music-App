"""Model-weight download helper for the Moodify Modal service.

Pure logic, ported from backend/download_models.py. It is wrapped by the
``download_models`` Modal function in modal_app.py, which runs it inside a
container with the model Volume mounted and then commits the Volume.

Run via:   modal run modal_app.py::download_models
"""

import os

# Google Drive file IDs for the trained weights (from the legacy
# backend/download_models.py). The text model directory also needs the
# tokenizer/config files, which are committed in the repo under
# ai_ml/models/text_emotion_model/ -- TODO(impl): decide whether to copy
# those into the Volume here or bake them into the image.
MODEL_FILES = {
    "text_emotion_model/model.safetensors": "1EjGqjYBmGclL1t8aF6tV2eWCfBSnOMot",
    "speech_emotion_model/scaler.pkl": "1cd2m7NIsWfgIPs8jU7C2cB7M0QQY_u_l",
    "speech_emotion_model/trained_speech_emotion_model.pkl": "1MPfkTkWjmjsVVs-cjkav48Mn8NUmVCG9",
    "facial_emotion_model/trained_facial_emotion_model.pt": "1GuW8wQ7KLfeX4pr2f8CAlORIP4YqJvgv",
}


def fetch_all(models_dir: str) -> None:
    """Download every model file into ``models_dir`` (the mounted Volume)."""
    import gdown

    for rel_path, file_id in MODEL_FILES.items():
        dest = os.path.join(models_dir, rel_path)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        if os.path.exists(dest):
            print(f"skip (exists): {rel_path}")
            continue
        print(f"downloading: {rel_path}")
        gdown.download(id=file_id, output=dest, quiet=False)

    # TODO(impl): also place the BERT tokenizer/config files
    # (config.json, tokenizer.json, vocab.txt, ...) into
    # text_emotion_model/ so AutoTokenizer.from_pretrained works.
