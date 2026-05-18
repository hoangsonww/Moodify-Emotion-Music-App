"""Model-weight setup for the Moodify Modal service.

Assembles the text emotion model directory on the Modal Volume:
  * copies the bundled tokenizer/config files (image asset) into the
    Volume, and
  * downloads the large ``model.safetensors`` weight file from Google Drive.

Speech weights are bundled directly in the image; the facial detector uses
the ``fer`` package's bundled weights -- neither needs the Volume.

Wrapped by the ``download_models`` Modal function in modal_app.py:
    modal run modal_app.py::download_models
"""

import os
import shutil

import config

# Google Drive file ID for the fine-tuned BERT weights (from the legacy
# backend/download_models.py).
TEXT_SAFETENSORS_GDRIVE_ID = "1EjGqjYBmGclL1t8aF6tV2eWCfBSnOMot"


def assemble_text_model(models_dir: str) -> None:
    """Build ``<models_dir>/text_emotion_model`` from assets + Drive weights."""
    import gdown

    dest_dir = os.path.join(models_dir, "text_emotion_model")
    os.makedirs(dest_dir, exist_ok=True)

    # 1. Copy bundled tokenizer/config files (small) from the image asset.
    for name in os.listdir(config.TEXT_ASSETS_DIR):
        src = os.path.join(config.TEXT_ASSETS_DIR, name)
        if os.path.isfile(src):
            shutil.copy2(src, os.path.join(dest_dir, name))
    print(f"Copied tokenizer/config files into {dest_dir}")

    # 2. Download the large weight file (skip if already present).
    weights_path = os.path.join(dest_dir, "model.safetensors")
    if os.path.exists(weights_path):
        print("model.safetensors already present -- skipping download")
        return
    print("Downloading model.safetensors from Google Drive...")
    gdown.download(id=TEXT_SAFETENSORS_GDRIVE_ID, output=weights_path, quiet=False)
    print(f"Downloaded {weights_path}")


def fetch_all(models_dir: str) -> None:
    """Populate the Modal Volume with every model file it needs."""
    assemble_text_model(models_dir)
