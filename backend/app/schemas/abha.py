"""Pydantic schemas for ABHA linking endpoints."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ABHALinkRequest(BaseModel):
    """Body for POST /api/abha/link/request-otp."""

    abha_number: str = Field(
        ...,
        min_length=14,
        max_length=17,
        examples=["91-1234-5678-9012"],
        description="14-digit ABHA number, optionally hyphenated",
    )


class ABHALinkOTPResponse(BaseModel):
    """Response after OTP is sent to ABHA-linked mobile."""

    message: str = "OTP sent to mobile linked with ABHA"
    txn_id: str = Field(..., description="Transaction ID for the verify step")


class ABHAVerifyRequest(BaseModel):
    """Body for POST /api/abha/link/verify-otp."""

    txn_id: str = Field(..., description="Transaction ID from request-otp step")
    otp: str = Field(..., min_length=6, max_length=6, examples=["123456"])


class ABHALinkResponse(BaseModel):
    """Response after successful ABHA verification and linking."""

    linked: bool = True
    abha_id: str = Field(..., description="Verified ABHA number")
    abha_address: str | None = Field(None, description="ABHA address (healthId)")
    name: str | None = None
    message: str = "ABHA ID linked successfully"


class ABHAStatusResponse(BaseModel):
    """Response for GET /api/abha/status."""

    linked: bool
    abha_id: str | None = None
