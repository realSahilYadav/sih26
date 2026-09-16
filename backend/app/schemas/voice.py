"""Pydantic schemas for the voice (TTS/STT) endpoints."""

from __future__ import annotations

from pydantic import BaseModel, Field


class TTSRequest(BaseModel):
    """Body for POST /api/voice/tts."""

    text: str = Field(..., min_length=1, max_length=5000, examples=["नमस्ते, आपका स्वागत है"])
    language: str = Field("en", examples=["hi", "mr", "en"])


class TTSResponse(BaseModel):
    """Response with base64-encoded audio."""

    audio_base64: str
    language: str
    cached: bool = False


class STTRequest(BaseModel):
    """Body for POST /api/voice/stt."""

    audio_base64: str = Field(..., description="Base64-encoded audio clip (WAV/WebM)")
    language: str = Field("en", examples=["hi", "mr", "en"])


class STTResponse(BaseModel):
    """Response with transcribed text."""

    text: str
    language: str


class LanguageUpdateRequest(BaseModel):
    """Body for PUT /api/auth/language."""

    language: str = Field(..., pattern=r"^(en|hi|mr)$", examples=["hi"])
