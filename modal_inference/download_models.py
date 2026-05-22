"""Model-weight setup for the Moodify Modal service.

Assembles the fine-tuned text-emotion model on the Modal Volume from two
sources: large ``model.safetensors`` weights come from the configured
Hugging Face repo, and the small tokenizer + config files ship in the
image under ``config.TEXT_ASSETS_DIR`` and are copied alongside them.
This lets the HF repo carry only the weights while the loader still
finds a complete transformers-format directory at runtime.

The speech model is bundled in the image and the facial detector uses
the ``fer`` package's bundled weights -- neither needs the Volume.

Wrapped by the ``download_models`` Modal function in modal_app.py; run
once before the first deploy (and again when the model is updated):

    modal run modal_app.py::download_models

The HF repo is configured via HF_TEXT_MODEL_REPO (and HF_TOKEN if the
repo is private) -- see config.py / .env.example.
"""

import os
import shutil

import config


def fetch_all(models_dir: str) -> None:
    """Assemble the text-emotion model into ``models_dir/text_emotion_model``."""
    repo = config.HF_TEXT_MODEL_REPO
    if not repo:
        raise RuntimeError(
            "HF_TEXT_MODEL_REPO is not set -- point it at the Hugging Face "
            "repo that holds the fine-tuned text-emotion model."
        )

    # Imported lazily so the lightweight CI suite (which only exercises the
    # config check above via test_download_models) does not need the
    # huggingface_hub dependency installed.
    from huggingface_hub import snapshot_download

    dest = os.path.join(models_dir, "text_emotion_model")
    os.makedirs(dest, exist_ok=True)

    print(f"Downloading text-emotion model from Hugging Face: {repo}")
    snapshot_download(
        repo_id=repo,
        local_dir=dest,
        token=config.HF_TOKEN or None,
        # Pull what transformers needs (config, tokenizer, weights in
        # either safetensors or .bin form) and nothing else.
        allow_patterns=["*.json", "*.txt", "*.safetensors", "*.bin", "*.model"],
    )

    # Merge the bundled tokenizer / config assets next to the weights.
    # The HF repo may carry only model.safetensors; the small files in
    # the image complete a transformers-format directory. Anything
    # already present (e.g. a config.json published on HF) wins.
    if os.path.isdir(config.TEXT_ASSETS_DIR):
        for name in os.listdir(config.TEXT_ASSETS_DIR):
            source = os.path.join(config.TEXT_ASSETS_DIR, name)
            target = os.path.join(dest, name)
            if os.path.isfile(source) and not os.path.exists(target):
                shutil.copy2(source, target)
                print(f"  + copied bundled {name}")

    print(f"Text-emotion model ready at {dest}")
    print(f"  files: {sorted(os.listdir(dest))}")
