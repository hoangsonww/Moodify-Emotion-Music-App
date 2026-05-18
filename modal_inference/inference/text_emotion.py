"""Text emotion inference -- fine-tuned BERT sequence classifier.

Refactored from ai_ml/src/models/text_emotion.py. The legacy code called
``from_pretrained`` on every request; here the model is loaded once in
``load()`` (from the Modal @modal.enter hook) and reused.
"""

import logging

import config

logger = logging.getLogger(__name__)


class TextEmotionModel:
    """Loads the fine-tuned BERT emotion classifier once, then infers."""

    def __init__(self) -> None:
        self._tokenizer = None
        self._model = None
        self._labels: list[str] = list(config.TEXT_EMOTION_LABELS)

    @property
    def loaded(self) -> bool:
        return self._model is not None

    def load(self) -> None:
        """Load tokenizer + model from the assembled model directory.

        Called once per container from modal_app.py's @modal.enter() hook.
        """
        import torch  # noqa: F401  (ensures the wheel is importable here)
        from transformers import AutoModelForSequenceClassification, AutoTokenizer

        logger.info("Loading text emotion model from %s", config.TEXT_EMOTION_DIR)
        self._tokenizer = AutoTokenizer.from_pretrained(config.TEXT_EMOTION_DIR)
        self._model = AutoModelForSequenceClassification.from_pretrained(config.TEXT_EMOTION_DIR)
        self._model.eval()

        # Prefer real labels from the model config; fall back to the
        # canonical ordering when the config only has generic LABEL_n names.
        id2label = getattr(self._model.config, "id2label", None) or {}
        names = [id2label[i] for i in sorted(id2label)] if id2label else []
        if names and not all(str(n).upper().startswith("LABEL_") for n in names):
            self._labels = [str(n) for n in names]
        logger.info("Text emotion labels: %s", self._labels)

    def predict(self, text: str) -> str:
        """Return the predicted emotion label for ``text``."""
        if not self.loaded:
            raise RuntimeError("TextEmotionModel.load() was not called")

        import torch

        inputs = self._tokenizer(
            text,
            return_tensors="pt",
            padding=True,
            truncation=True,
            max_length=config.MAX_TEXT_LENGTH,
        )
        with torch.no_grad():
            logits = self._model(**inputs).logits

        idx = int(logits[0].argmax())
        if 0 <= idx < len(self._labels):
            return self._labels[idx]
        logger.warning("Text model produced out-of-range index %s", idx)
        return config.DEFAULT_EMOTION
