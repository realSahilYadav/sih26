"""Health Worker API — assisted patient registration, triage, and booking.

All endpoints require `health_worker` role. These enable frontline health
workers to register patients without smartphones, run triage on their behalf,
and book appointments for them.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_roles
from app.models.user import User, UserRole
from app.schemas.appointment import AppointmentCreate, AppointmentResponse
from app.schemas.health_worker import (
    AssistedBookingRequest,
    AssistedTriageRequest,
    RegisterPatientRequest,
    RegisterPatientResponse,
)
from app.schemas.triage import TriageRequest, TriageResponse
from app.services.appointment import create_appointment
from app.services import triage_service

router = APIRouter(prefix="/api/health-worker", tags=["health_worker"])
logger = logging.getLogger(__name__)


@router.post(
    "/register-patient",
    response_model=RegisterPatientResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new patient on behalf",
)
async def register_patient(
    body: RegisterPatientRequest,
    hw: Annotated[User, Depends(require_roles("health_worker"))],
    db: Annotated[Session, Depends(get_db)],
) -> RegisterPatientResponse:
    """Create a patient account for someone without a smartphone.

    If the phone number already exists, returns the existing patient's info
    instead of creating a duplicate.
    """
    # Check if phone already registered
    existing = db.query(User).filter(User.phone == body.phone).first()
    if existing:
        return RegisterPatientResponse(
            patient_id=str(existing.id),
            name=existing.name,
            phone=existing.phone,
            message="Patient already registered",
        )

    patient = User(
        phone=body.phone,
        name=body.name,
        role=UserRole.patient,
        preferred_language=body.preferred_language,
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)

    logger.info(
        "Health worker %s registered patient %s (id=%s)",
        hw.name,
        patient.name,
        patient.id,
    )

    return RegisterPatientResponse(
        patient_id=str(patient.id),
        name=patient.name,
        phone=patient.phone,
    )


@router.post(
    "/triage",
    response_model=TriageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Run triage on behalf of a patient",
)
async def assisted_triage(
    body: AssistedTriageRequest,
    hw: Annotated[User, Depends(require_roles("health_worker"))],
    db: Annotated[Session, Depends(get_db)],
) -> TriageResponse:
    """Submit triage for a registered patient.

    Identical logic to the patient-facing triage but uses patient_id from the
    request body instead of the authenticated user's ID.
    """
    # Verify patient exists
    patient = db.query(User).filter(User.id == body.patient_id).first()
    if not patient or patient.role != UserRole.patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found",
        )

    triage_req = TriageRequest(
        symptoms=body.symptoms,
        free_text=body.free_text,
        vitals=body.vitals,
    )
    return triage_service.evaluate_and_store(db, patient.id, triage_req)


@router.post(
    "/book-appointment",
    response_model=AppointmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Book appointment on behalf of a patient",
)
async def assisted_booking(
    body: AssistedBookingRequest,
    hw: Annotated[User, Depends(require_roles("health_worker"))],
    db: Annotated[Session, Depends(get_db)],
) -> AppointmentResponse:
    """Book an appointment for a registered patient.

    Reuses the existing appointment service logic.
    """
    # Verify patient exists
    patient = db.query(User).filter(User.id == body.patient_id).first()
    if not patient or patient.role != UserRole.patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found",
        )

    appt_create = AppointmentCreate(
        facility_id=body.facility_id,
        doctor_id=body.doctor_id,
        scheduled_at=datetime.fromisoformat(body.scheduled_at) if body.scheduled_at else None,
        is_walkin=body.is_walkin,
    )

    try:
        return create_appointment(db, str(patient.id), appt_create)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )
