"""Health worker schemas — assisted patient registration and on-behalf flows."""

from __future__ import annotations

from pydantic import BaseModel, Field


class RegisterPatientRequest(BaseModel):
    """Body for POST /api/health-worker/register-patient."""

    name: str = Field(..., min_length=1, max_length=120, examples=["Ramesh Kumar"])
    phone: str = Field(..., min_length=10, max_length=15, examples=["+919876543210"])
    preferred_language: str = Field("hi", examples=["hi", "mr", "en"])


class RegisterPatientResponse(BaseModel):
    """Response after registering a patient."""

    patient_id: str
    name: str
    phone: str
    message: str = "Patient registered successfully"


class AssistedTriageRequest(BaseModel):
    """Triage submission on behalf of a patient."""

    patient_id: str
    symptoms: list[str]
    free_text: str | None = None
    vitals: dict | None = None


class AssistedBookingRequest(BaseModel):
    """Booking on behalf of a patient."""

    patient_id: str
    facility_id: str
    doctor_id: str
    scheduled_at: str | None = None  # ISO datetime
    is_walkin: bool = False
