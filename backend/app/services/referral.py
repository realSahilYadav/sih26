"""Referral service — business logic for inter-facility patient transfers."""

from __future__ import annotations

import logging
from typing import Optional

from sqlalchemy.orm import Session

from app.models.doctor_facility import DoctorFacility
from app.models.referral import Referral, ReferralStatus
from app.models.user import User
from app.schemas.referral import (
    ReferralCreate,
    ReferralResponse,
    ReferralStatusUpdate,
)

logger = logging.getLogger(__name__)

# ── State machine ────────────────────────────────────────────────────────────

_VALID_TRANSITIONS: dict[ReferralStatus, set[ReferralStatus]] = {
    ReferralStatus.referred: {ReferralStatus.accepted},
    ReferralStatus.accepted: {ReferralStatus.in_transit},
    ReferralStatus.in_transit: {ReferralStatus.completed, ReferralStatus.follow_up_needed},
}


# ── Helpers ──────────────────────────────────────────────────────────────────


def _build_referral_response(ref: Referral) -> ReferralResponse:
    """Map a Referral ORM instance to its Pydantic response."""
    return ReferralResponse(
        id=str(ref.id),
        patient_id=str(ref.patient_id),
        patient_name=ref.patient.name if ref.patient else "Unknown",
        from_facility_id=str(ref.from_facility_id),
        from_facility_name=ref.from_facility.name if ref.from_facility else "Unknown",
        to_facility_id=str(ref.to_facility_id),
        to_facility_name=ref.to_facility.name if ref.to_facility else "Unknown",
        referring_doctor_id=str(ref.referring_doctor_id),
        referring_doctor_name=ref.referring_doctor.name if ref.referring_doctor else "Unknown",
        reason=ref.reason,
        status=ref.status.value,
        created_at=ref.created_at,
        updated_at=ref.updated_at,
    )


def _get_doctor_facility_id(db: Session, doctor_id: str) -> str | None:
    """Resolve the facility a doctor is linked to.

    If a doctor is linked to multiple facilities, returns the first one.
    """
    link = (
        db.query(DoctorFacility)
        .filter(DoctorFacility.doctor_id == doctor_id)
        .first()
    )
    return str(link.facility_id) if link else None


# ── Create ───────────────────────────────────────────────────────────────────


def create_referral(
    db: Session,
    doctor_id: str,
    data: ReferralCreate,
) -> ReferralResponse:
    """Create a new referral from the doctor's facility to the destination.

    The ``from_facility_id`` is auto-resolved from the doctor's facility
    assignment.

    Raises ValueError on validation failures.
    """
    from_facility_id = _get_doctor_facility_id(db, doctor_id)
    if not from_facility_id:
        raise ValueError("You are not linked to any facility")

    if from_facility_id == data.to_facility_id:
        raise ValueError("Cannot refer a patient to the same facility")

    # Verify the patient exists
    patient = db.query(User).filter(User.id == data.patient_id).first()
    if not patient:
        raise ValueError("Patient not found")

    referral = Referral(
        patient_id=data.patient_id,
        from_facility_id=from_facility_id,
        to_facility_id=data.to_facility_id,
        referring_doctor_id=doctor_id,
        reason=data.reason,
        status=ReferralStatus.referred,
    )
    db.add(referral)
    db.commit()
    db.refresh(referral)

    # Re-query to load relationships
    referral = db.query(Referral).filter(Referral.id == referral.id).first()
    return _build_referral_response(referral)


# ── Read ─────────────────────────────────────────────────────────────────────


def get_patient_referrals(
    db: Session,
    patient_id: str,
) -> list[ReferralResponse]:
    """Get all referrals for a patient, newest first."""
    refs = (
        db.query(Referral)
        .filter(Referral.patient_id == patient_id)
        .order_by(Referral.created_at.desc())
        .all()
    )
    return [_build_referral_response(r) for r in refs]


def get_facility_incoming(
    db: Session,
    facility_id: str,
    status_filter: Optional[str] = None,
) -> list[ReferralResponse]:
    """Get referrals coming INTO a facility."""
    query = db.query(Referral).filter(Referral.to_facility_id == facility_id)

    if status_filter:
        try:
            status_enum = ReferralStatus(status_filter)
            query = query.filter(Referral.status == status_enum)
        except ValueError:
            pass  # Ignore invalid status filter

    refs = query.order_by(Referral.created_at.desc()).all()
    return [_build_referral_response(r) for r in refs]


def get_facility_outgoing(
    db: Session,
    facility_id: str,
    status_filter: Optional[str] = None,
) -> list[ReferralResponse]:
    """Get referrals going OUT of a facility."""
    query = db.query(Referral).filter(Referral.from_facility_id == facility_id)

    if status_filter:
        try:
            status_enum = ReferralStatus(status_filter)
            query = query.filter(Referral.status == status_enum)
        except ValueError:
            pass

    refs = query.order_by(Referral.created_at.desc()).all()
    return [_build_referral_response(r) for r in refs]


def get_facility_all(
    db: Session,
    facility_id: str,
    direction: Optional[str] = None,
    status_filter: Optional[str] = None,
) -> list[ReferralResponse]:
    """Get all referrals for a facility (incoming + outgoing or filtered).

    ``direction`` can be 'incoming', 'outgoing', or None for both.
    """
    if direction == "incoming":
        return get_facility_incoming(db, facility_id, status_filter)
    if direction == "outgoing":
        return get_facility_outgoing(db, facility_id, status_filter)

    # Both directions
    query = db.query(Referral).filter(
        (Referral.from_facility_id == facility_id)
        | (Referral.to_facility_id == facility_id)
    )

    if status_filter:
        try:
            status_enum = ReferralStatus(status_filter)
            query = query.filter(Referral.status == status_enum)
        except ValueError:
            pass

    refs = query.order_by(Referral.created_at.desc()).all()
    return [_build_referral_response(r) for r in refs]


# ── Update ───────────────────────────────────────────────────────────────────


def update_referral_status(
    db: Session,
    referral_id: str,
    user: User,
    data: ReferralStatusUpdate,
) -> ReferralResponse:
    """Update a referral's status with transition validation.

    Raises ValueError on invalid transitions or unauthorized access.
    """
    referral = db.query(Referral).filter(Referral.id == referral_id).first()
    if not referral:
        raise ValueError("Referral not found")

    # Verify the user is connected to either the from or to facility
    user_facility_ids = {
        str(link.facility_id)
        for link in db.query(DoctorFacility).filter(DoctorFacility.doctor_id == user.id).all()
    }
    # Admins can also be linked to facilities; check if user is admin
    involved_facility_ids = {str(referral.from_facility_id), str(referral.to_facility_id)}
    if not user_facility_ids & involved_facility_ids and user.role.value != "admin":
        raise ValueError("You are not authorized to update this referral")

    try:
        new_status = ReferralStatus(data.status)
    except ValueError:
        raise ValueError(f"Invalid status: {data.status}")

    allowed = _VALID_TRANSITIONS.get(referral.status, set())
    if new_status not in allowed:
        raise ValueError(
            f"Cannot transition from '{referral.status.value}' to '{new_status.value}'"
        )

    referral.status = new_status
    db.commit()
    db.refresh(referral)

    return _build_referral_response(referral)
