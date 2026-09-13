"""Pydantic schemas for the referral tracking API."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


# ── Request schemas ──────────────────────────────────────────────────────────


class ReferralCreate(BaseModel):
    """Body for POST /api/referrals."""

    patient_id: str = Field(..., description="Patient user ID to refer")
    to_facility_id: str = Field(..., description="Destination facility ID")
    reason: str = Field(
        ..., min_length=1, max_length=2000, description="Clinical reason for referral"
    )


class ReferralStatusUpdate(BaseModel):
    """Body for PATCH /api/referrals/{id}/status."""

    status: str = Field(
        ...,
        description="New status: accepted | in_transit | completed | follow_up_needed",
    )


# ── Response schemas ─────────────────────────────────────────────────────────


class ReferralResponse(BaseModel):
    """Referral returned by list / create endpoints."""

    id: str
    patient_id: str
    patient_name: str
    from_facility_id: str
    from_facility_name: str
    to_facility_id: str
    to_facility_name: str
    referring_doctor_id: str
    referring_doctor_name: str
    reason: str
    status: str
    created_at: datetime
    updated_at: datetime
