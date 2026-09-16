"""ABHA linking API — verify and store ABHA IDs via ABDM Sandbox."""

from __future__ import annotations

import logging
import re
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.abha import (
    ABHALinkOTPResponse,
    ABHALinkRequest,
    ABHALinkResponse,
    ABHAStatusResponse,
    ABHAVerifyRequest,
)
from app.services.abdm import ABDMError, get_abdm_client

router = APIRouter(prefix="/api/abha", tags=["abha"])
logger = logging.getLogger(__name__)


def _normalize_abha(raw: str) -> str:
    """Strip hyphens/spaces from an ABHA number → 14 digits."""
    return re.sub(r"[\s\-]", "", raw)


@router.post("/link/request-otp", response_model=ABHALinkOTPResponse)
async def request_abha_otp(
    body: ABHALinkRequest,
    current_user: Annotated[User, Depends(get_current_user)],
) -> ABHALinkOTPResponse:
    """Send an OTP to the mobile number linked with the given ABHA number.

    If the ABDM sandbox is unreachable or credentials are missing, returns a
    502 with a user-friendly message so the patient can skip and try later.
    """
    abha = _normalize_abha(body.abha_number)

    client = get_abdm_client()
    try:
        result = await client.request_abha_otp(abha)
    except ABDMError as exc:
        logger.warning("ABDM OTP request error for user %s: %s", current_user.id, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="ABDM service is temporarily unavailable. You can link your ABHA ID later.",
        )

    if result is None:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="ABDM service is temporarily unavailable. You can link your ABHA ID later.",
        )

    return ABHALinkOTPResponse(txn_id=result["txnId"])


@router.post("/link/verify-otp", response_model=ABHALinkResponse)
async def verify_abha_otp(
    body: ABHAVerifyRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> ABHALinkResponse:
    """Verify OTP and link the ABHA ID to the current user.

    On successful verification, stores ``abha_id`` on the user record.
    If the sandbox fails, returns 502 so the user can retry later.
    """
    client = get_abdm_client()
    try:
        profile = await client.verify_abha_otp(body.txn_id, body.otp)
    except ABDMError as exc:
        logger.warning("ABDM OTP verify error for user %s: %s", current_user.id, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="ABDM verification failed. Please try again later.",
        )

    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="ABDM service is temporarily unavailable. Please try again later.",
        )

    # Store verified ABHA ID on the user record
    abha_number = profile.get("abha_number", "")
    if not abha_number:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="ABDM returned an incomplete profile. Please try again.",
        )

    current_user.abha_id = abha_number
    db.commit()
    db.refresh(current_user)

    logger.info("ABHA linked: user=%s abha=%s", current_user.id, abha_number)

    return ABHALinkResponse(
        abha_id=abha_number,
        abha_address=profile.get("abha_address"),
        name=profile.get("name"),
    )


@router.get("/status", response_model=ABHAStatusResponse)
async def abha_status(
    current_user: Annotated[User, Depends(get_current_user)],
) -> ABHAStatusResponse:
    """Return the current ABHA linking status for the authenticated user."""
    return ABHAStatusResponse(
        linked=current_user.abha_id is not None,
        abha_id=current_user.abha_id,
    )
