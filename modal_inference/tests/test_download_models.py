"""Tests for the model-download logic (download_models.py).

`huggingface_hub.snapshot_download` is faked, so these run without network
or the huggingface_hub package -- they exercise our own fetch_all logic.
"""

import os
import sys
import tempfile
import types

import pytest

import config
import download_models


def _fake_hf_hub(captured):
    """Return a fake `huggingface_hub` module recording snapshot_download args."""
    module = types.ModuleType("huggingface_hub")

    def snapshot_download(**kwargs):
        captured.update(kwargs)
        return kwargs.get("local_dir")

    module.snapshot_download = snapshot_download
    return module


def test_fetch_all_requires_repo(monkeypatch):
    monkeypatch.setattr(config, "HF_TEXT_MODEL_REPO", "")
    with pytest.raises(RuntimeError, match="HF_TEXT_MODEL_REPO"):
        download_models.fetch_all(tempfile.mkdtemp())


def test_fetch_all_invokes_snapshot_download(monkeypatch):
    captured = {}
    monkeypatch.setattr(config, "HF_TEXT_MODEL_REPO", "acme/moodify-text-emotion")
    monkeypatch.setattr(config, "HF_TOKEN", None)
    monkeypatch.setitem(sys.modules, "huggingface_hub", _fake_hf_hub(captured))

    models_dir = tempfile.mkdtemp()
    download_models.fetch_all(models_dir)

    assert captured["repo_id"] == "acme/moodify-text-emotion"
    assert captured["local_dir"] == os.path.join(models_dir, "text_emotion_model")
    assert os.path.isdir(captured["local_dir"])
    assert captured["token"] is None
    # weights in either format must be allowed
    assert "*.safetensors" in captured["allow_patterns"]
    assert "*.bin" in captured["allow_patterns"]


def test_fetch_all_forwards_token(monkeypatch):
    captured = {}
    monkeypatch.setattr(config, "HF_TEXT_MODEL_REPO", "acme/private-model")
    monkeypatch.setattr(config, "HF_TOKEN", "hf_secrettoken")
    monkeypatch.setitem(sys.modules, "huggingface_hub", _fake_hf_hub(captured))

    download_models.fetch_all(tempfile.mkdtemp())
    assert captured["token"] == "hf_secrettoken"
