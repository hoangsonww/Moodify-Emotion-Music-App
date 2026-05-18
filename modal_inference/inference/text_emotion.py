"""Text emotion inference -- BERT sequence classifier.

Refactored from ai_ml/src/models/text_emotion.py. The legacy code called
`from_pretrained` on every request; here the model is loaded once in
`load()` and reused.
"""

import logging

import config

logger = logging.getLogger(__name__)


class TextEmotionModel:
    """Loads the fine-tuned BERT emotion classifier once, then infers."""

    def __init__(self) -> None:
        self._tokenizer = None
        self._model = None
        self._labels: list[str] = []

    @property
    def loaded(self) -> bool:
        return self._model is not None

    def load(self) -> None:
        """Load tokenizer + model from the mounted Modal Volume.

        Called once per container from modal_app.py's @modal.enter() hook.
        """
        import torch  # noqa: F401  (kept warm in the container)
        from transformers import AutoModelForSequenceClassification, AutoTokenizer

        logger.info("Loading text emotion model from %s", config.TEXT_EMOTION_DIR)
        self._tokenizer = AutoTokenizer.from_pretrained(config.TEXT_EMOTION_DIR)
        self._model = AutoModelForSequenceClassification.from_pretrained(config.TEXT_EMOTION_DIR)
        self._model.eval()

        # FIX (plan problem #8): derive labels from the model config instead
        # of a hard-coded list, so num_labels and the label set never drift.
        id2label = getattr(self._model.config, "id2label", None)
        if id2label:
            self._labels = [id2label[i] for i in sorted(id2label)]
        else:
            # TODO(impl): confirm the canonical label order for this model.
            self._labels = ["sadness", "joy", "love", "anger", "fear"]

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
            outputs = self._model(**inputs)

        idx = int(outputs.logits[0].argmax())
        return self._labels[idx]
