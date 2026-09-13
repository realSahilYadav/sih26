"""Referral API — inter-facility patient transfer endpoints."""

from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.user import User
from app.schemas.referral import (
    ReferralCreate,
    ReferralResponse,
    ReferralStatusUpdate,
)
from app.services import referral as referral_service

router = APIRouter(prefix="/api/referrals", tags=["referrals"])


# ── Create ───────────────────────────────────────────────────────────────────


@router.post(
    "",
    response_model=ReferralResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create referral",
)
async def create_referral(
    body: ReferralCreate,
    user: Annotated[User, Depends(require_roles("doctor"))],
    db: Session = Depends(get_db),
) -> ReferralResponse:
    """Create a new referral from the doctor's facility to another facility.

    The ``from_facility_id`` is automatically resolved from the doctor's
    facility assignment — the doctor only specifies the destination.
    """
    try:
        return referral_service.create_referral(db, str(user.id), body)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


# ── Patient history ──────────────────────────────────────────────────────────


@router.get(
    "/patient/{patient_id}",
    response_model=list[ReferralResponse],
    summary="Patient referral history",
)
async def patient_referrals(
    patient_id: str,
    user: Annotated[User, Depends(require_roles("doctor", "admin", "health_worker"))],
    db: Session = Depends(get_db),
) -> list[ReferralResponse]:
    """Return all referrals for a patient, newest first."""
    return referral_service.get_patient_referrals(db, patient_id)


# ── Facility incoming ───────────────────────────────────────────────────────


@router.get(
    "/facility/{facility_id}/incoming",
    response_model=list[ReferralResponse],
    summary="Incoming referrals",
)
async def facility_incoming(
    facility_id: str,
    status: Annotated[Optional[str], Query(description="Filter by status")] = None,
    user: Annotated[User, Depends(require_roles("doctor", "admin"))] = None,
    db: Session = Depends(get_db),
) -> list[ReferralResponse]:
    """Return referrals coming INTO a facility (for receiving doctors/admin)."""
    return referral_service.get_facility_incoming(db, facility_id, status)


# ── Facility outgoing ───────────────────────────────────────────────────────


@router.get(
    "/facility/{facility_id}/outgoing",
    response_model=list[ReferralResponse],
    summary="Outgoing referrals",
)
async def facility_outgoing(
    facility_id: str,
    status: Annotated[Optional[str], Query(description="Filter by status")] = None,
    user: Annotated[User, Depends(require_roles("doctor", "admin"))] = None,
    db: Session = Depends(get_db),
) -> list[ReferralResponse]:
    """Return referrals going OUT from a facility."""
    return referral_service.get_facility_outgoing(db, facility_id, status)


# ── Facility all (admin dashboard) ──────────────────────────────────────────


@router.get(
    "/facility/{facility_id}/all",
    response_model=list[ReferralResponse],
    summary="All facility referrals",
)
async def facility_all_referrals(
    facility_id: str,
    direction: Annotated[Optional[str], Query(description="incoming | outgoing")] = None,
    status: Annotated[Optional[str], Query(description="Filter by status")] = None,
    user: Annotated[User, Depends(require_roles("admin", "doctor"))] = None,
    db: Session = Depends(get_db),
) -> list[ReferralResponse]:
    """Return all referrals (in + out) for a facility.

    Supports ``direction`` filter (incoming/outgoing) and ``status`` filter.
    Primarily used by the admin dashboard.
    """
    return referral_service.get_facility_all(db, facility_id, direction, status)


# ── Status update ────────────────────────────────────────────────────────────


@router.patch(
    "/{referral_id}/status",
    response_model=ReferralResponse,
    summary="Update referral status",
)
async def update_referral_status(
    referral_id: str,
    body: ReferralStatusUpdate,
    user: Annotated[User, Depends(require_roles("doctor", "admin"))],
    db: Session = Depends(get_db),
) -> ReferralResponse:
    """Update a referral's status through the lifecycle.

    Validates the state transition:
    referred → accepted → in_transit → completed / follow_up_needed
    """
    try:
        return referral_service.update_referral_status(db, referral_id, user, body)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
