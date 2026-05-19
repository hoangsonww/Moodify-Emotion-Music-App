"""Pydantic request/response models for the inference API.

Response shapes intentionally match the legacy Django/Flask API
(``{"emotion": ..., "recommendations": [...]}``) so existing clients keep
working after the cutover.
"""

from typing import Optional

from pydantic import BaseModel, Field


class TextEmotionRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)


class MusicRecommendationRequest(BaseModel):
    emotion: str = Field(..., min_length=1)
    market: Optional[str] = None
    # Recent detected moods, oldest first. Used to blend in tracks for the
    # user's recurring mood alongside the current one. Capped to bound the
    # payload; extra entries are ignored.
    history: list[str] = Field(default_factory=list, max_length=50)


class Track(BaseModel):
    name: str
    artist: str
    album: Optional[str] = None
    preview_url: Optional[str] = None
    external_url: Optional[str] = None
    image_url: Optional[str] = None
    # Sort metadata for the client (popularity 0-100; release_date "YYYY..").
    popularity: int = 0
    duration_ms: int = 0
    release_date: Optional[str] = None


class EmotionResponse(BaseModel):
    emotion: str
    recommendations: list[Track] = []
    # True when a model failed and a fallback was used, instead of the
    # legacy behaviour of silently returning a random emotion.
    degraded: bool = False
    market: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    models_loaded: dict[str, bool]
