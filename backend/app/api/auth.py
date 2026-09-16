"""Authentication API — OTP request, verification, and session info."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.auth import (
    AuthResponse,
    OTPRequest,
    OTPRequestResponse,
    OTPVerify,
    UserMeResponse,
)
from app.schemas.voice import LanguageUpdateRequest
from app.services.auth import create_otp_request, verify_otp_and_login

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/request-otp", response_model=OTPRequestResponse)
async def request_otp(body: OTPRequest):
    """Send a one-time password to the given phone number."""
    success = await create_otp_request(body.phone)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to send OTP. Please try again.",
        )
    return OTPRequestResponse(phone=body.phone)


@router.post("/verify-otp", response_model=AuthResponse)
async def verify_otp(
    body: OTPVerify,
    db: Annotated[Session, Depends(get_db)],
):
    """Verify OTP and return a JWT access token.

    If the phone number is new, a patient account is auto-created.
    """
    try:
        return await verify_otp_and_login(body.phone, body.otp, db)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        )


@router.get("/me", response_model=UserMeResponse)
async def get_me(user: Annotated[User, Depends(get_current_user)]):
    """Return the currently authenticated user's profile."""
    return UserMeResponse(
        user_id=str(user.id),
        phone=user.phone,
        name=user.name,
        role=user.role.value,
        preferred_language=user.preferred_language,
        needs_abha_linking=user.abha_id is None,
        abha_id=user.abha_id,
        created_at=user.created_at,
    )


@router.put("/language")
async def update_language(
    body: LanguageUpdateRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Update the authenticated user's preferred language."""
    user.preferred_language = body.language
    db.commit()
    return {"message": "Language updated", "language": body.language}
