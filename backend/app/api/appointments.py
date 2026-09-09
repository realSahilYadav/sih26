"""Appointment API — availability, booking, patient list, doctor queue, status."""

from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.user import User
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentResponse,
    AppointmentStatusUpdate,
    DoctorAvailability,
)
from app.services.appointment import (
    create_appointment,
    get_doctor_availability,
    get_doctor_today_queue,
    get_patient_appointments,
    update_appointment_status,
)

router = APIRouter(prefix="/api", tags=["appointments"])


# ── Availability ─────────────────────────────────────────────────────────────


@router.get(
    "/doctors/{facility_id}/availability",
    response_model=list[DoctorAvailability],
)
async def doctor_availability(
    facility_id: str,
    date: Annotated[date, Query(alias="date", description="YYYY-MM-DD")],
    db: Session = Depends(get_db),
) -> list[DoctorAvailability]:
    """Return available time slots for every doctor at *facility_id* on *date*."""
    return get_doctor_availability(db, facility_id, date)


# ── Booking ──────────────────────────────────────────────────────────────────


@router.post(
    "/appointments",
    response_model=AppointmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def book_appointment(
    body: AppointmentCreate,
    user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> AppointmentResponse:
    """Book a new appointment or walk-in for the authenticated patient."""
    try:
        return create_appointment(db, str(user.id), body)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )


# ── Patient's own appointments ───────────────────────────────────────────────


@router.get("/appointments/me", response_model=list[AppointmentResponse])
async def my_appointments(
    user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> list[AppointmentResponse]:
    """Return all appointments for the authenticated patient."""
    return get_patient_appointments(db, str(user.id))


# ── Doctor's today queue ─────────────────────────────────────────────────────


@router.get(
    "/appointments/doctor/{doctor_id}/today",
    response_model=list[AppointmentResponse],
)
async def doctor_today_queue(
    doctor_id: str,
    user: Annotated[User, Depends(require_roles("doctor"))],
    db: Session = Depends(get_db),
) -> list[AppointmentResponse]:
    """Return today's appointment queue for the given doctor.

    Only accessible by doctors. The requesting doctor can only view their own queue.
    """
    if str(user.id) != doctor_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own queue",
        )
    return get_doctor_today_queue(db, doctor_id)


# ── Status update ────────────────────────────────────────────────────────────


@router.patch(
    "/appointments/{appointment_id}/status",
    response_model=AppointmentResponse,
)
async def update_status(
    appointment_id: str,
    body: AppointmentStatusUpdate,
    user: Annotated[User, Depends(require_roles("doctor"))],
    db: Session = Depends(get_db),
) -> AppointmentResponse:
    """Update an appointment's status (doctor only)."""
    try:
        return update_appointment_status(db, appointment_id, str(user.id), body)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
