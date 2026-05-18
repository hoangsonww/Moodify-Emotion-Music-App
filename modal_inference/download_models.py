"""Model-weight setup for the Moodify Modal service.

Downloads the fine-tuned text-emotion model (config + tokenizer +
model.safetensors) from the Hugging Face Hub into the Modal Volume. The
speech model is bundled in the image and the facial detector uses the
``fer`` package's bundled weights -- neither needs the Volume.

Wrapped by the ``download_models`` Modal function in modal_app.py; run
once before the first deploy (and again when the model is updated):

    modal run modal_app.py::download_models

The HF repo is configured via HF_TEXT_MODEL_REPO (and HF_TOKEN if the
repo is private) -- see config.py / .env.example.
"""

import os

import config


def fetch_all(models_dir: str) -> None:
    """Download the text-emotion model from Hugging Face into the Volume."""
    from huggingface_hub import snapshot_download

    repo = config.HF_TEXT_MODEL_REPO
    if not repo:
        raise RuntimeError(
            "HF_TEXT_MODEL_REPO is not set -- point it at the Hugging Face "
            "repo that holds the fine-tuned text-emotion model."
        )

    dest = os.path.join(models_dir, "text_emotion_model")
    os.makedirs(dest, exist_ok=True)

    print(f"Downloading text-emotion model from Hugging Face: {repo}")
    snapshot_download(
        repo_id=repo,
        local_dir=dest,
        token=config.HF_TOKEN or None,
        # Pull only what transformers needs to load the model.
        allow_patterns=["*.json", "*.txt", "*.safetensors", "*.model"],
    )
    print(f"Text-emotion model ready at {dest}")
