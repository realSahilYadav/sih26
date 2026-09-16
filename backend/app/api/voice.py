"""Voice API — TTS and STT via Bhashini/ULCA pipeline."""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_current_user
from app.models.user import User
from app.schemas.voice import STTRequest, STTResponse, TTSRequest, TTSResponse
from app.services.bhashini import get_bhashini_client

router = APIRouter(prefix="/api/voice", tags=["voice"])
logger = logging.getLogger(__name__)


@router.post("/tts", response_model=TTSResponse)
async def text_to_speech(
    body: TTSRequest,
    current_user: Annotated[User, Depends(get_current_user)],
) -> TTSResponse:
    """Convert text to speech audio using Bhashini TTS.

    Returns base64-encoded WAV audio. Results for identical text+language
    pairs are cached server-side.
    """
    client = get_bhashini_client()
    result = await client.text_to_speech(body.text, body.language)

    if result is None:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Voice service is temporarily unavailable. Please try again later.",
        )

    return TTSResponse(
        audio_base64=result["audio_base64"],
        language=body.language,
        cached=result.get("cached", False),
    )


@router.post("/stt", response_model=STTResponse)
async def speech_to_text(
    body: STTRequest,
    current_user: Annotated[User, Depends(get_current_user)],
) -> STTResponse:
    """Convert speech audio to text using Bhashini ASR.

    Accepts base64-encoded audio (WAV or WebM). Returns transcribed text.
    """
    client = get_bhashini_client()
    result = await client.speech_to_text(body.audio_base64, body.language)

    if result is None:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Voice service is temporarily unavailable. Please try again later.",
        )

    return STTResponse(
        text=result["text"],
        language=body.language,
    )
