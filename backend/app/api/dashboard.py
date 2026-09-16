"""Dashboard API — facility summary aggregations."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, cast, func, or_, Date
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.appointment import Appointment, AppointmentStatus
from app.models.facility import Facility
from app.models.medicine_stock import MedicineStock
from app.models.referral import Referral, ReferralStatus
from app.models.triage_record import TriageRecord, UrgencyLevel
from app.models.user import User
from app.schemas.dashboard import (
    AppointmentStats,
    FacilitySummary,
    LowStockAlert,
    ReferralStats,
    TriageDayCount,
)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

# Active referral statuses (exclude completed)
_ACTIVE_REFERRAL_STATUSES = {
    ReferralStatus.referred,
    ReferralStatus.accepted,
    ReferralStatus.in_transit,
    ReferralStatus.follow_up_needed,
}


@router.get("/facility/{facility_id}/summary", response_model=FacilitySummary)
async def facility_summary(
    facility_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    low_stock_threshold: int = Query(10, ge=0, description="Quantity below which a medicine is flagged"),
) -> FacilitySummary:
    """Return a comprehensive dashboard summary for a single facility.

    Aggregates:
    - Today's appointments by status
    - Active referrals (in/out) by status
    - Low-stock medicine alerts
    - Triage volume by urgency level over the last 7 days
    """
    # Verify facility exists
    facility = db.get(Facility, facility_id)
    if not facility:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Facility not found")

    today = date.today()
    seven_days_ago = today - timedelta(days=6)  # inclusive of today = 7 days

    # ── 1. Appointments today ────────────────────────────────────────────
    appt_rows = (
        db.query(Appointment.status, func.count())
        .filter(
            Appointment.facility_id == facility_id,
            cast(Appointment.scheduled_at, Date) == today,
        )
        .group_by(Appointment.status)
        .all()
    )

    appt_counts = {s.value: 0 for s in AppointmentStatus}
    total_appts = 0
    for appt_status, count in appt_rows:
        appt_counts[appt_status.value] = count
        total_appts += count

    appointments = AppointmentStats(
        total=total_appts,
        **appt_counts,
    )

    # ── 2. Active referrals ──────────────────────────────────────────────
    # Incoming (to this facility)
    incoming_q = (
        db.query(Referral.status, func.count())
        .filter(
            Referral.to_facility_id == facility_id,
            Referral.status.in_(_ACTIVE_REFERRAL_STATUSES),
        )
        .group_by(Referral.status)
        .all()
    )

    # Outgoing (from this facility)
    outgoing_q = (
        db.query(Referral.status, func.count())
        .filter(
            Referral.from_facility_id == facility_id,
            Referral.status.in_(_ACTIVE_REFERRAL_STATUSES),
        )
        .group_by(Referral.status)
        .all()
    )

    by_status: dict[str, int] = {}
    incoming_total = 0
    for ref_status, count in incoming_q:
        by_status[ref_status.value] = by_status.get(ref_status.value, 0) + count
        incoming_total += count

    outgoing_total = 0
    for ref_status, count in outgoing_q:
        by_status[ref_status.value] = by_status.get(ref_status.value, 0) + count
        outgoing_total += count

    referrals = ReferralStats(
        incoming_total=incoming_total,
        outgoing_total=outgoing_total,
        by_status=by_status,
    )

    # ── 3. Low-stock medicines ───────────────────────────────────────────
    low_stock_rows = (
        db.query(MedicineStock.medicine_name, MedicineStock.quantity_available)
        .filter(
            MedicineStock.facility_id == facility_id,
            MedicineStock.quantity_available < low_stock_threshold,
        )
        .order_by(MedicineStock.quantity_available.asc())
        .all()
    )

    low_stock_alerts = [
        LowStockAlert(
            medicine_name=row.medicine_name,
            quantity_available=row.quantity_available,
            threshold=low_stock_threshold,
        )
        for row in low_stock_rows
    ]

    # ── 4. Triage trend (last 7 days) ────────────────────────────────────
    # Join triage → appointment to get facility_id
    triage_rows = (
        db.query(
            cast(TriageRecord.created_at, Date).label("day"),
            TriageRecord.urgency_level,
            func.count().label("cnt"),
        )
        .join(Appointment, TriageRecord.appointment_id == Appointment.id, isouter=True)
        .filter(
            or_(
                Appointment.facility_id == facility_id,
                # Include triages without appointment but linked to patients
                # who have appointments at this facility
                and_(
                    TriageRecord.appointment_id.is_(None),
                    TriageRecord.patient_id.in_(
                        db.query(Appointment.patient_id)
                        .filter(Appointment.facility_id == facility_id)
                        .distinct()
                    ),
                ),
            ),
            cast(TriageRecord.created_at, Date) >= seven_days_ago,
        )
        .group_by("day", TriageRecord.urgency_level)
        .order_by("day")
        .all()
    )

    # Build day → urgency → count map
    day_map: dict[str, dict[str, int]] = {}
    for i in range(7):
        d = seven_days_ago + timedelta(days=i)
        day_map[d.isoformat()] = {"red": 0, "yellow": 0, "green": 0}

    for day, urgency, cnt in triage_rows:
        key = day.isoformat() if hasattr(day, "isoformat") else str(day)
        if key in day_map:
            day_map[key][urgency.value] = cnt

    triage_trend = [
        TriageDayCount(
            date=d,
            red=counts["red"],
            yellow=counts["yellow"],
            green=counts["green"],
            total=counts["red"] + counts["yellow"] + counts["green"],
        )
        for d, counts in day_map.items()
    ]

    return FacilitySummary(
        facility_id=str(facility_id),
        facility_name=facility.name,
        appointments=appointments,
        referrals=referrals,
        low_stock_alerts=low_stock_alerts,
        triage_trend=triage_trend,
    )
