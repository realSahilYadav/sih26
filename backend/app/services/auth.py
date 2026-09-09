"""Authentication service — OTP orchestration and JWT token management."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

import jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user import User, UserRole
from app.schemas.auth import AuthResponse
from app.services.sms import get_sms_provider

logger = logging.getLogger(__name__)


# ── JWT helpers ──────────────────────────────────────────────────────────────


def create_access_token(
    user_id: str,
    role: str,
    expires_delta: timedelta | None = None,
) -> str:
    """Create a signed JWT for the given user."""
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    )
    payload = {
        "sub": user_id,
        "role": role,
        "exp": expire,
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Decode and validate a JWT. Raises jwt.PyJWTError on failure."""
    return jwt.decode(
        token,
        settings.JWT_SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
    )


# ── OTP flow ─────────────────────────────────────────────────────────────────


async def create_otp_request(phone: str) -> bool:
    """Send an OTP to the given phone number.

    Returns True if the SMS provider reports success.
    """
    provider = get_sms_provider()
    # In dev mode the OTP is the hardcoded dev code; a real provider would
    # generate a random code and store/track it server-side.
    return await provider.send_otp(phone, settings.OTP_DEV_CODE)


async def verify_otp_and_login(phone: str, otp: str, db: Session) -> AuthResponse:
    """Verify OTP, find-or-create user, return JWT + user info.

    Raises ValueError if OTP is invalid.
    """
    provider = get_sms_provider()
    valid = await provider.verify_otp(phone, otp)
    if not valid:
        raise ValueError("Invalid OTP")

    # Look up existing user by phone
    user: User | None = db.query(User).filter(User.phone == phone).first()

    if user is None:
        # Auto-register as patient on first login
        user = User(
            phone=phone,
            name="New User",
            role=UserRole.patient,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info("Auto-created patient account for phone %s (id=%s)", phone, user.id)

    # Check if user is active
    if not user.is_active:
        raise ValueError("Account is deactivated")

    # Create JWT
    token = create_access_token(str(user.id), user.role.value)

    return AuthResponse(
        access_token=token,
        user_id=str(user.id),
        role=user.role.value,
        name=user.name,
        needs_abha_linking=user.abha_id is None,
    )
