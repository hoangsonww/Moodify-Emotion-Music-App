"""Text emotion inference -- fine-tuned BERT sequence classifier.

Refactored from ai_ml/src/models/text_emotion.py. The legacy code called
``from_pretrained`` on every request; here the model is loaded once in
``load()`` (from the Modal @modal.enter hook) and reused.
"""

import logging

import config
from cache import TTLCache

logger = logging.getLogger(__name__)


# Process-wide cache for text-emotion predictions. Safe to cache because
# the classifier is fully deterministic on the normalised input string,
# and the underlying tokenizer (bert-base-uncased) lowercases the input
# anyway -- so ``Hello`` and ``hello`` share a cache slot AND share a
# prediction. The TTL is long but bounded so a stale label can't outlive
# a model swap forever (replace + redeploy -> new container -> empty cache).
_prediction_cache = TTLCache(
    max_size=config.CACHE_TEXT_MAX,
    ttl_seconds=config.CACHE_TEXT_TTL,
    name="text_emotion",
)


def get_cache() -> TTLCache:
    """Expose the cache for /health observability and tests."""
    return _prediction_cache


def _normalize(text: str) -> str:
    """Cache-key normalisation -- match bert-base-uncased + the model.

    Stripping whitespace and lowercasing collapses callers that mean the
    same thing into the same key without altering what the model would
    have predicted (the tokenizer would normalise this anyway).
    """
    return (text or "").strip().lower()


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
        """Return the predicted emotion label for ``text``.

        Identical inputs (after whitespace+case normalisation) are served
        from a process-wide TTL cache so the BERT forward pass runs at
        most once per unique snippet inside the cache window. The cache
        key is the *normalised* string -- never the raw input -- so we
        never leak cached results across truly different texts.
        """
        if not self.loaded:
            raise RuntimeError("TextEmotionModel.load() was not called")

        key = _normalize(text)
        if key:
            cached = _prediction_cache.get(key)
            if cached is not None:
                return cached

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
            label = self._labels[idx]
        else:
            logger.warning("Text model produced out-of-range index %s", idx)
            label = config.DEFAULT_EMOTION

        if key:
            _prediction_cache.set(key, label)
        return label
