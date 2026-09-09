"""Pydantic schemas for the authentication flow."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class OTPRequest(BaseModel):
    """Body for POST /api/auth/request-otp."""

    phone: str = Field(..., examples=["+919876543210"])


class OTPVerify(BaseModel):
    """Body for POST /api/auth/verify-otp."""

    phone: str = Field(..., examples=["+919876543210"])
    otp: str = Field(..., min_length=6, max_length=6, examples=["123456"])


class OTPRequestResponse(BaseModel):
    """Response after OTP is sent."""

    message: str = "OTP sent successfully"
    phone: str


class AuthResponse(BaseModel):
    """Response after successful OTP verification."""

    access_token: str
    token_type: str = "bearer"
    user_id: str
    role: str
    name: str
    needs_abha_linking: bool


class UserMeResponse(BaseModel):
    """Response for GET /api/auth/me."""

    user_id: str
    phone: str
    name: str
    role: str
    preferred_language: str
    needs_abha_linking: bool
    created_at: datetime


class TokenPayload(BaseModel):
    """Decoded JWT payload."""

    sub: str  # user_id as string
    role: str
    exp: datetime
