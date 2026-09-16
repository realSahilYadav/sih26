"""Bhashini/ULCA pipeline client — TTS and STT via the two-step API.

Implements the standard ULCA flow:
  1. Config call → get serviceId + inferenceApiKey for the model
  2. Inference call → perform TTS or ASR

TTS results for static prompts are cached to disk to avoid redundant API calls.
"""

from __future__ import annotations

import base64
import hashlib
import logging
import os
from pathlib import Path
from typing import Any, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# TTS cache directory (relative to backend root)
TTS_CACHE_DIR = Path(__file__).resolve().parent.parent.parent / "tts_cache"
TTS_CACHE_DIR.mkdir(exist_ok=True)


class BhashiniClient:
    """Async client for the Bhashini ULCA pipeline API.

    Handles config resolution, inference calls, and TTS caching.
    """

    # Pipeline config cache: (task, language) → {serviceId, inferenceApiKey, ...}
    _pipeline_cache: dict[tuple[str, str], dict[str, Any]] = {}

    def __init__(self) -> None:
        self.pipeline_url = settings.BHASHINI_PIPELINE_URL
        self.inference_url = settings.BHASHINI_INFERENCE_URL
        self.api_key = settings.BHASHINI_API_KEY
        self.user_id = settings.BHASHINI_USER_ID
        self._http = httpx.AsyncClient(timeout=30.0)

    def _is_configured(self) -> bool:
        return bool(self.api_key and self.user_id)

    # ── Pipeline config ──────────────────────────────────────────────────

    async def _get_pipeline_config(
        self, task: str, source_language: str
    ) -> dict[str, Any] | None:
        """Fetch pipeline config for a given task (tts/asr) and language.

        Returns dict with ``serviceId`` and ``inferenceApiKey``, or ``None``.
        Cached per (task, language).
        """
        cache_key = (task, source_language)
        if cache_key in self._pipeline_cache:
            return self._pipeline_cache[cache_key]

        if not self._is_configured():
            logger.warning("Bhashini credentials not configured — skipping")
            return None

        try:
            resp = await self._http.post(
                self.pipeline_url,
                headers={
                    "ulcaApiKey": self.api_key,
                    "userID": self.user_id,
                    "Content-Type": "application/json",
                },
                json={
                    "pipelineTasks": [{"taskType": task, "config": {"language": {"sourceLanguage": source_language}}}],
                    "pipelineRequestConfig": {"pipelineId": "64392f96daac500b55c543cd"},
                },
            )
            resp.raise_for_status()
            data = resp.json()

            # Extract service config
            pipeline_response = data.get("pipelineResponseConfig", [{}])
            if not pipeline_response:
                logger.warning("Bhashini pipeline returned empty config for %s/%s", task, source_language)
                return None

            config_item = pipeline_response[0].get("config", [{}])
            if isinstance(config_item, list) and config_item:
                config_item = config_item[0]

            service_id = config_item.get("serviceId", "")

            # Get inference API key from pipelineInferenceAPIEndPoint
            inference_info = data.get("pipelineInferenceAPIEndPoint", {})
            inference_key = inference_info.get("inferenceApiKey", {}).get("value", "")
            callback_url = inference_info.get("callbackUrl", self.inference_url)

            result = {
                "serviceId": service_id,
                "inferenceApiKey": inference_key,
                "callbackUrl": callback_url,
            }
            BhashiniClient._pipeline_cache[cache_key] = result
            logger.info("Bhashini pipeline config cached for %s/%s (serviceId=%s)", task, source_language, service_id)
            return result

        except httpx.HTTPError as exc:
            logger.warning("Bhashini pipeline config failed for %s/%s: %s", task, source_language, exc)
            return None

    # ── TTS cache ────────────────────────────────────────────────────────

    @staticmethod
    def _tts_cache_key(text: str, language: str) -> str:
        """Generate a deterministic cache key for TTS output."""
        raw = f"{language}:{text}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    @staticmethod
    def _get_cached_tts(text: str, language: str) -> str | None:
        """Return base64 audio from cache, or None."""
        key = BhashiniClient._tts_cache_key(text, language)
        cache_file = TTS_CACHE_DIR / f"{key}.b64"
        if cache_file.exists():
            return cache_file.read_text()
        return None

    @staticmethod
    def _save_tts_cache(text: str, language: str, audio_b64: str) -> None:
        """Save TTS output to file cache."""
        key = BhashiniClient._tts_cache_key(text, language)
        cache_file = TTS_CACHE_DIR / f"{key}.b64"
        cache_file.write_text(audio_b64)

    # ── TTS ──────────────────────────────────────────────────────────────

    async def text_to_speech(
        self, text: str, language: str = "en"
    ) -> dict[str, Any] | None:
        """Convert text to speech audio.

        Returns ``{"audio_base64": "...", "cached": bool}`` on success,
        or ``None`` on failure.
        """
        # Check cache first
        cached = self._get_cached_tts(text, language)
        if cached:
            logger.debug("TTS cache hit for lang=%s text=%s...", language, text[:30])
            return {"audio_base64": cached, "cached": True}

        config = await self._get_pipeline_config("tts", language)
        if not config:
            return None

        try:
            resp = await self._http.post(
                config["callbackUrl"],
                headers={
                    "Authorization": config["inferenceApiKey"],
                    "Content-Type": "application/json",
                },
                json={
                    "pipelineTasks": [
                        {
                            "taskType": "tts",
                            "config": {
                                "language": {"sourceLanguage": language},
                                "serviceId": config["serviceId"],
                                "gender": "female",
                            },
                        }
                    ],
                    "inputData": {
                        "input": [{"source": text}],
                    },
                },
            )
            resp.raise_for_status()
            data = resp.json()

            # Extract audio from response
            output = data.get("pipelineResponse", [{}])
            if output:
                audio_list = output[0].get("audio", [])
                if audio_list:
                    audio_b64 = audio_list[0].get("audioContent", "")
                    if audio_b64:
                        # Cache for future use
                        self._save_tts_cache(text, language, audio_b64)
                        logger.info("TTS generated for lang=%s text=%s...", language, text[:30])
                        return {"audio_base64": audio_b64, "cached": False}

            logger.warning("Bhashini TTS returned empty audio for lang=%s", language)
            return None

        except httpx.HTTPError as exc:
            logger.warning("Bhashini TTS failed for lang=%s: %s", language, exc)
            return None

    # ── STT (ASR) ────────────────────────────────────────────────────────

    async def speech_to_text(
        self, audio_base64: str, language: str = "en"
    ) -> dict[str, Any] | None:
        """Convert speech audio to text.

        ``audio_base64`` should be a base64-encoded audio clip (WAV/WebM/OGG).
        Returns ``{"text": "..."}`` on success, or ``None`` on failure.
        """
        config = await self._get_pipeline_config("asr", language)
        if not config:
            return None

        try:
            resp = await self._http.post(
                config["callbackUrl"],
                headers={
                    "Authorization": config["inferenceApiKey"],
                    "Content-Type": "application/json",
                },
                json={
                    "pipelineTasks": [
                        {
                            "taskType": "asr",
                            "config": {
                                "language": {"sourceLanguage": language},
                                "serviceId": config["serviceId"],
                                "audioFormat": "wav",
                                "samplingRate": 16000,
                            },
                        }
                    ],
                    "inputData": {
                        "audio": [{"audioContent": audio_base64}],
                    },
                },
            )
            resp.raise_for_status()
            data = resp.json()

            output = data.get("pipelineResponse", [{}])
            if output:
                text_list = output[0].get("output", [])
                if text_list:
                    transcribed = text_list[0].get("source", "")
                    if transcribed:
                        logger.info("STT transcribed for lang=%s: %s...", language, transcribed[:50])
                        return {"text": transcribed}

            logger.warning("Bhashini STT returned empty result for lang=%s", language)
            return None

        except httpx.HTTPError as exc:
            logger.warning("Bhashini STT failed for lang=%s: %s", language, exc)
            return None

    async def close(self) -> None:
        await self._http.aclose()


# ── Module-level singleton ───────────────────────────────────────────────────

_client: BhashiniClient | None = None


def get_bhashini_client() -> BhashiniClient:
    """Return the module-level Bhashini client singleton."""
    global _client
    if _client is None:
        _client = BhashiniClient()
    return _client
