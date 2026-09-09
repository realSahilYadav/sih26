"""Appointment service — business logic for facility search, availability, and booking."""

from __future__ import annotations

import logging
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import and_, func, text
from sqlalchemy.orm import Session

from app.models.appointment import Appointment, AppointmentStatus
from app.models.doctor_facility import DoctorFacility
from app.models.facility import Facility
from app.models.user import User, UserRole
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentResponse,
    AppointmentStatusUpdate,
    DoctorAvailability,
    SlotResponse,
)
from app.schemas.facility import DoctorAtFacility, FacilityNearbyResponse

logger = logging.getLogger(__name__)

# IST offset (UTC+5:30) — used for "today" calculation in doctor queue
IST = timezone(timedelta(hours=5, minutes=30))

# ── Default slot config (will be per-doctor later) ───────────────────────────
SLOT_START_HOUR = 9
SLOT_END_HOUR = 17  # 5 PM (exclusive — last slot starts at 16:30)
SLOT_DURATION_MINUTES = 30
# Weekday numbers: Monday=0 … Friday=4
WORKING_DAYS = {0, 1, 2, 3, 4}


# ── Helpers ──────────────────────────────────────────────────────────────────


def _build_appointment_response(appt: Appointment) -> AppointmentResponse:
    """Map an Appointment ORM instance to its Pydantic response."""
    return AppointmentResponse(
        id=str(appt.id),
        patient_id=str(appt.patient_id),
        patient_name=appt.patient.name if appt.patient else "Unknown",
        doctor_id=str(appt.doctor_id),
        doctor_name=appt.doctor.name if appt.doctor else "Unknown",
        facility_id=str(appt.facility_id),
        facility_name=appt.facility.name if appt.facility else "Unknown",
        scheduled_at=appt.scheduled_at,
        status=appt.status.value,
        queue_position=appt.queue_position,
        created_at=appt.created_at,
    )


def _generate_day_slots(target_date: date) -> list[str]:
    """Generate all possible HH:MM slot strings for a working day."""
    if target_date.weekday() not in WORKING_DAYS:
        return []
    slots: list[str] = []
    current = time(SLOT_START_HOUR, 0)
    end = time(SLOT_END_HOUR, 0)
    while current < end:
        slots.append(current.strftime("%H:%M"))
        minutes = current.hour * 60 + current.minute + SLOT_DURATION_MINUTES
        current = time(minutes // 60, minutes % 60)
    return slots


# ── Facility search ─────────────────────────────────────────────────────────


def get_nearby_facilities(
    db: Session,
    lat: float,
    lng: float,
    radius_km: float = 25.0,
) -> list[FacilityNearbyResponse]:
    """Find facilities within *radius_km* of (lat, lng), sorted by distance.

    Uses PostGIS ST_DWithin (index-assisted) on the geography column.
    """
    radius_m = radius_km * 1000
    point_wkt = f"SRID=4326;POINT({lng} {lat})"

    rows = db.execute(
        text("""
            SELECT
                id,
                name,
                type,
                address,
                contact_phone,
                ST_Y(location::geometry) AS lat,
                ST_X(location::geometry) AS lng,
                ST_Distance(location, ST_GeogFromText(:point)) / 1000.0 AS distance_km
            FROM facilities
            WHERE ST_DWithin(location, ST_GeogFromText(:point), :radius_m)
            ORDER BY distance_km
        """),
        {"point": point_wkt, "radius_m": radius_m},
    ).fetchall()

    return [
        FacilityNearbyResponse(
            id=str(r.id),
            name=r.name,
            type=r.type,
            address=r.address,
            contact_phone=r.contact_phone,
            lat=r.lat,
            lng=r.lng,
            distance_km=round(r.distance_km, 2),
        )
        for r in rows
    ]


# ── Doctor availability ─────────────────────────────────────────────────────


def get_doctor_availability(
    db: Session,
    facility_id: str,
    target_date: date,
) -> list[DoctorAvailability]:
    """Return slot availability for every doctor at *facility_id* on *target_date*."""
    all_slots = _generate_day_slots(target_date)
    if not all_slots:
        return []  # Not a working day

    # Doctors linked to this facility
    doctor_links = (
        db.query(DoctorFacility)
        .filter(DoctorFacility.facility_id == facility_id)
        .all()
    )

    results: list[DoctorAvailability] = []
    for link in doctor_links:
        doctor = db.query(User).filter(User.id == link.doctor_id, User.role == UserRole.doctor).first()
        if not doctor:
            continue

        # Existing bookings for this doctor on this date
        day_start = datetime.combine(target_date, time(0, 0), tzinfo=IST)
        day_end = day_start + timedelta(days=1)

        booked_rows = (
            db.query(Appointment.scheduled_at)
            .filter(
                Appointment.doctor_id == doctor.id,
                Appointment.scheduled_at >= day_start,
                Appointment.scheduled_at < day_end,
                Appointment.status.notin_([
                    AppointmentStatus.cancelled,
                    AppointmentStatus.no_show,
                ]),
            )
            .all()
        )
        booked_times = {
            row.scheduled_at.astimezone(IST).strftime("%H:%M") for row in booked_rows
        }

        slots = [
            SlotResponse(time=s, available=(s not in booked_times))
            for s in all_slots
        ]

        results.append(
            DoctorAvailability(
                doctor_id=str(doctor.id),
                doctor_name=doctor.name,
                date=target_date,
                slots=slots,
            )
        )

    return results


# ── Booking ──────────────────────────────────────────────────────────────────


def create_appointment(
    db: Session,
    patient_id: str,
    data: AppointmentCreate,
) -> AppointmentResponse:
    """Book a new appointment or walk-in.

    Raises ValueError on validation failures (double-booking, bad slot, etc.).
    """
    # Validate doctor is linked to facility
    link = (
        db.query(DoctorFacility)
        .filter(
            DoctorFacility.doctor_id == data.doctor_id,
            DoctorFacility.facility_id == data.facility_id,
        )
        .first()
    )
    if not link:
        raise ValueError("Doctor is not available at this facility")

    now_ist = datetime.now(IST)

    if data.is_walkin:
        # Walk-in: scheduled_at = now, assign queue_position
        scheduled_at = now_ist

        # Queue position = count of today's appointments for this doctor + 1
        today_start = datetime.combine(now_ist.date(), time(0, 0), tzinfo=IST)
        today_end = today_start + timedelta(days=1)

        current_count = (
            db.query(func.count(Appointment.id))
            .filter(
                Appointment.doctor_id == data.doctor_id,
                Appointment.scheduled_at >= today_start,
                Appointment.scheduled_at < today_end,
                Appointment.status.notin_([
                    AppointmentStatus.cancelled,
                    AppointmentStatus.no_show,
                ]),
            )
            .scalar()
        ) or 0

        queue_position = current_count + 1
    else:
        if data.scheduled_at is None:
            raise ValueError("scheduled_at is required for non-walk-in appointments")

        scheduled_at = data.scheduled_at
        queue_position = None

        # Validate the slot isn't already booked
        existing = (
            db.query(Appointment)
            .filter(
                Appointment.doctor_id == data.doctor_id,
                Appointment.scheduled_at == scheduled_at,
                Appointment.status.notin_([
                    AppointmentStatus.cancelled,
                    AppointmentStatus.no_show,
                ]),
            )
            .first()
        )
        if existing:
            raise ValueError("This time slot is already booked")

    appt = Appointment(
        patient_id=patient_id,
        doctor_id=data.doctor_id,
        facility_id=data.facility_id,
        scheduled_at=scheduled_at,
        status=AppointmentStatus.booked,
        queue_position=queue_position,
    )
    db.add(appt)
    db.commit()
    db.refresh(appt)

    # Eagerly load relationships for the response
    appt = (
        db.query(Appointment)
        .filter(Appointment.id == appt.id)
        .first()
    )

    return _build_appointment_response(appt)


# ── Patient's appointments ───────────────────────────────────────────────────


def get_patient_appointments(
    db: Session,
    patient_id: str,
) -> list[AppointmentResponse]:
    """Get all appointments for a patient, newest first."""
    appts = (
        db.query(Appointment)
        .filter(Appointment.patient_id == patient_id)
        .order_by(Appointment.scheduled_at.desc())
        .all()
    )
    return [_build_appointment_response(a) for a in appts]


# ── Doctor's today queue ─────────────────────────────────────────────────────


def get_doctor_today_queue(
    db: Session,
    doctor_id: str,
) -> list[AppointmentResponse]:
    """Get today's appointment queue for a doctor, ordered by time then queue position."""
    now_ist = datetime.now(IST)
    today_start = datetime.combine(now_ist.date(), time(0, 0), tzinfo=IST)
    today_end = today_start + timedelta(days=1)

    appts = (
        db.query(Appointment)
        .filter(
            Appointment.doctor_id == doctor_id,
            Appointment.scheduled_at >= today_start,
            Appointment.scheduled_at < today_end,
        )
        .order_by(
            Appointment.scheduled_at.asc(),
            Appointment.queue_position.asc().nulls_last(),
        )
        .all()
    )
    return [_build_appointment_response(a) for a in appts]


# ── Status update ────────────────────────────────────────────────────────────

# Allowed transitions
_VALID_TRANSITIONS: dict[AppointmentStatus, set[AppointmentStatus]] = {
    AppointmentStatus.booked: {AppointmentStatus.checked_in, AppointmentStatus.no_show, AppointmentStatus.cancelled},
    AppointmentStatus.checked_in: {AppointmentStatus.in_progress, AppointmentStatus.no_show},
    AppointmentStatus.in_progress: {AppointmentStatus.completed},
}


def update_appointment_status(
    db: Session,
    appointment_id: str,
    doctor_id: str,
    data: AppointmentStatusUpdate,
) -> AppointmentResponse:
    """Update an appointment's status with transition validation.

    Raises ValueError if the appointment doesn't belong to the doctor
    or the status transition is invalid.
    """
    appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appt:
        raise ValueError("Appointment not found")

    if str(appt.doctor_id) != doctor_id:
        raise ValueError("This appointment does not belong to you")

    try:
        new_status = AppointmentStatus(data.status)
    except ValueError:
        raise ValueError(f"Invalid status: {data.status}")

    allowed = _VALID_TRANSITIONS.get(appt.status, set())
    if new_status not in allowed:
        raise ValueError(
            f"Cannot transition from '{appt.status.value}' to '{new_status.value}'"
        )

    appt.status = new_status
    db.commit()
    db.refresh(appt)

    return _build_appointment_response(appt)
