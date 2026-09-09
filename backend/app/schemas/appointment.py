"""Pydantic schemas for the appointment / booking flow."""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field


# ── Availability ─────────────────────────────────────────────────────────────


class SlotResponse(BaseModel):
    """A single 30-min slot for a doctor on a given date."""

    time: str = Field(..., examples=["09:00"], description="HH:MM in 24-hour format")
    available: bool


class DoctorAvailability(BaseModel):
    """Availability payload for one doctor at a facility on a given date."""

    doctor_id: str
    doctor_name: str
    date: date
    slots: list[SlotResponse]


# ── Booking ──────────────────────────────────────────────────────────────────


class AppointmentCreate(BaseModel):
    """Body for POST /api/appointments."""

    facility_id: str
    doctor_id: str
    scheduled_at: datetime | None = Field(
        None,
        description="ISO datetime for a scheduled slot. Omit for a walk-in.",
    )
    is_walkin: bool = False


class AppointmentResponse(BaseModel):
    """Appointment returned by list / create endpoints."""

    id: str
    patient_id: str
    patient_name: str
    doctor_id: str
    doctor_name: str
    facility_id: str
    facility_name: str
    scheduled_at: datetime
    status: str
    queue_position: int | None = None
    created_at: datetime


# ── Status update ────────────────────────────────────────────────────────────


class AppointmentStatusUpdate(BaseModel):
    """Body for PATCH /api/appointments/{id}/status."""

    status: str = Field(
        ...,
        description="New status: checked_in | in_progress | completed | no_show",
    )
