"""ABDM Sandbox client — ABHA number verification via V3 REST API.

Implements the Milestone-1 ABHA flow directly against the ABDM Sandbox:
  1. Authenticate with client credentials → bearer token
  2. Fetch RSA public key → encrypt sensitive data
  3. Request OTP for an ABHA number → txn_id
  4. Verify OTP → verified ABHA profile

All sandbox calls are wrapped in try/except so failures never block the user.
"""

from __future__ import annotations

import base64
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

import httpx
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.x509 import load_pem_x509_certificate

from app.core.config import settings

logger = logging.getLogger(__name__)


class ABDMError(Exception):
    """Raised when the ABDM sandbox returns a non-recoverable error."""

    def __init__(self, message: str, status_code: int | None = None) -> None:
        self.status_code = status_code
        super().__init__(message)


class ABDMClient:
    """Async client for the ABDM V3 Sandbox API.

    Manages session tokens and RSA key caching internally.
    All public methods return ``None`` on transient failures instead of
    raising, unless explicitly noted.
    """

    # Token cache (module-level singleton pattern)
    _session_token: str | None = None
    _token_expires_at: float = 0
    _public_key_pem: bytes | None = None

    def __init__(self) -> None:
        self.base_url = settings.ABDM_BASE_URL.rstrip("/")
        self.gateway_url = settings.ABDM_GATEWAY_URL.rstrip("/")
        self.client_id = settings.ABDM_CLIENT_ID
        self.client_secret = settings.ABDM_CLIENT_SECRET
        self._http = httpx.AsyncClient(timeout=30.0)

    # ── Internal helpers ─────────────────────────────────────────────────

    def _is_configured(self) -> bool:
        """Return True if ABDM credentials are set."""
        return bool(self.client_id and self.client_secret)

    @staticmethod
    def _request_headers(token: str) -> dict[str, str]:
        """Standard headers required by every ABDM V3 call."""
        return {
            "Authorization": f"Bearer {token}",
            "REQUEST-ID": str(uuid.uuid4()),
            "TIMESTAMP": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z"),
            "X-CM-ID": "sbx",
            "Content-Type": "application/json",
        }

    # ── Session token ────────────────────────────────────────────────────

    async def _get_session_token(self) -> str | None:
        """Authenticate with ABDM gateway and return a bearer token.

        Caches the token for 15 minutes (ABDM default TTL).
        Returns ``None`` if authentication fails.
        """
        # Return cached token if still valid
        if self._session_token and time.time() < self._token_expires_at:
            return self._session_token

        if not self._is_configured():
            logger.warning("ABDM credentials not configured — skipping ABDM integration")
            return None

        try:
            resp = await self._http.post(
                f"{self.gateway_url}/v3/sessions",
                json={
                    "clientId": self.client_id,
                    "clientSecret": self.client_secret,
                    "grantType": "client_credentials",
                },
            )
            resp.raise_for_status()
            data = resp.json()
            ABDMClient._session_token = data.get("accessToken")
            # Cache for 14 minutes (1 min safety margin on 15-min TTL)
            ABDMClient._token_expires_at = time.time() + 14 * 60
            logger.info("ABDM session token acquired successfully")
            return ABDMClient._session_token
        except httpx.HTTPError as exc:
            logger.warning("ABDM session auth failed: %s", exc)
            return None

    # ── RSA public key ───────────────────────────────────────────────────

    async def _get_public_key(self) -> bytes | None:
        """Fetch the ABDM RSA public key for encrypting sensitive data.

        Cached for the lifetime of this process.
        """
        if ABDMClient._public_key_pem:
            return ABDMClient._public_key_pem

        token = await self._get_session_token()
        if not token:
            return None

        try:
            resp = await self._http.get(
                f"{self.base_url}/v3/profile/public/certificate",
                headers=self._request_headers(token),
            )
            resp.raise_for_status()
            # Response is the PEM certificate as plain text or JSON
            cert_data = resp.text
            if cert_data.startswith("{"):
                # JSON response — extract the certificate string
                cert_data = resp.json().get("publicKey", resp.json().get("certificate", ""))

            ABDMClient._public_key_pem = cert_data.encode()
            logger.info("ABDM RSA public key fetched and cached")
            return ABDMClient._public_key_pem
        except httpx.HTTPError as exc:
            logger.warning("Failed to fetch ABDM public key: %s", exc)
            return None

    async def _encrypt(self, plaintext: str) -> str | None:
        """RSA-OAEP encrypt a string and return base64-encoded ciphertext."""
        pem = await self._get_public_key()
        if not pem:
            return None

        try:
            # Try loading as X.509 certificate first, then as raw public key
            try:
                cert = load_pem_x509_certificate(pem)
                public_key = cert.public_key()
            except Exception:
                public_key = serialization.load_pem_public_key(pem)

            ciphertext = public_key.encrypt(
                plaintext.encode("utf-8"),
                padding.OAEP(
                    mgf=padding.MGF1(algorithm=hashes.SHA1()),
                    algorithm=hashes.SHA1(),
                    label=None,
                ),
            )
            return base64.b64encode(ciphertext).decode("utf-8")
        except Exception as exc:
            logger.warning("ABDM RSA encryption failed: %s", exc)
            return None

    # ── Public API methods ───────────────────────────────────────────────

    async def request_abha_otp(self, abha_number: str) -> dict[str, Any] | None:
        """Request OTP for verifying an existing ABHA number.

        Calls ``POST /v3/profile/login/requestOtp`` with the encrypted ABHA
        number.

        Returns a dict with ``txnId`` on success, or ``None`` on failure.
        """
        token = await self._get_session_token()
        if not token:
            return None

        encrypted_abha = await self._encrypt(abha_number)
        if not encrypted_abha:
            # Fallback: try sending plaintext (some sandbox versions accept it)
            encrypted_abha = abha_number

        try:
            resp = await self._http.post(
                f"{self.base_url}/v3/profile/login/requestOtp",
                headers=self._request_headers(token),
                json={
                    "scope": ["abha-login", "mobile-verify"],
                    "loginHint": "abha-number",
                    "loginId": encrypted_abha,
                    "otpSystem": "abdm",
                },
            )
            resp.raise_for_status()
            data = resp.json()
            txn_id = data.get("txnId")
            logger.info("ABDM OTP requested for ABHA %s…, txn=%s", abha_number[:4], txn_id)
            return {"txnId": txn_id}
        except httpx.HTTPStatusError as exc:
            body = exc.response.text
            logger.warning(
                "ABDM requestOtp failed (status=%d): %s", exc.response.status_code, body
            )
            raise ABDMError(
                f"ABDM verification failed: {body}", status_code=exc.response.status_code
            )
        except httpx.HTTPError as exc:
            logger.warning("ABDM requestOtp network error: %s", exc)
            return None

    async def verify_abha_otp(
        self, txn_id: str, otp: str
    ) -> dict[str, Any] | None:
        """Verify OTP and retrieve the ABHA profile.

        Calls ``POST /v3/profile/login/verify`` with the encrypted OTP.

        Returns a dict with ABHA profile fields on success, or ``None``
        on failure.
        """
        token = await self._get_session_token()
        if not token:
            return None

        encrypted_otp = await self._encrypt(otp)
        if not encrypted_otp:
            encrypted_otp = otp

        try:
            resp = await self._http.post(
                f"{self.base_url}/v3/profile/login/verify",
                headers=self._request_headers(token),
                json={
                    "authData": {
                        "authMethods": ["otp"],
                        "otp": {
                            "txnId": txn_id,
                            "otpValue": encrypted_otp,
                        },
                    },
                },
            )
            resp.raise_for_status()
            data = resp.json()
            # Extract the verified ABHA ID (healthIdNumber or ABHANumber)
            profile = {
                "abha_number": data.get("ABHANumber", data.get("healthIdNumber", "")),
                "abha_address": data.get("ABHAAddress", data.get("healthId", "")),
                "name": data.get("name", ""),
                "token": data.get("token", data.get("tokens", {}).get("token", "")),
            }
            logger.info("ABDM OTP verified — ABHA=%s", profile.get("abha_number", "?"))
            return profile
        except httpx.HTTPStatusError as exc:
            body = exc.response.text
            logger.warning(
                "ABDM verifyOtp failed (status=%d): %s", exc.response.status_code, body
            )
            raise ABDMError(
                f"OTP verification failed: {body}", status_code=exc.response.status_code
            )
        except httpx.HTTPError as exc:
            logger.warning("ABDM verifyOtp network error: %s", exc)
            return None

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        await self._http.aclose()


# ── Module-level singleton ───────────────────────────────────────────────────

_client: ABDMClient | None = None


def get_abdm_client() -> ABDMClient:
    """Return the module-level ABDM client singleton."""
    global _client
    if _client is None:
        _client = ABDMClient()
    return _client
