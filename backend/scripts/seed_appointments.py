"""Seed script — populate dev DB with facilities, doctors, and a test patient.

Usage:
    cd backend
    python -m scripts.seed_appointments
"""

from __future__ import annotations

import sys
import os

# Ensure the backend package is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.doctor_facility import DoctorFacility
from app.models.facility import Facility, FacilityType
from app.models.user import User, UserRole


# ── Seed data ────────────────────────────────────────────────────────────────

FACILITIES = [
    {
        "name": "Pune PHC Kothrud",
        "type": FacilityType.phc,
        "address": "Near MIT College, Kothrud, Pune 411038",
        "contact_phone": "+912025431234",
        "lat": 18.5074,
        "lng": 73.8077,
    },
    {
        "name": "Baramati Rural Hospital",
        "type": FacilityType.rural_hospital,
        "address": "Station Road, Baramati, Pune 413102",
        "contact_phone": "+912112243210",
        "lat": 18.1514,
        "lng": 74.5774,
    },
    {
        "name": "Satara District Hospital",
        "type": FacilityType.district_hospital,
        "address": "Powai Naka, Satara 415001",
        "contact_phone": "+912162234567",
        "lat": 17.6805,
        "lng": 74.0183,
    },
    {
        "name": "Junnar Sub Centre",
        "type": FacilityType.sub_centre,
        "address": "Main Road, Junnar, Pune 410502",
        "contact_phone": "+912132222111",
        "lat": 19.2090,
        "lng": 73.8747,
    },
]

DOCTORS = [
    {"phone": "+919900000001", "name": "Dr. Anita Sharma"},
    {"phone": "+919900000002", "name": "Dr. Rajesh Patil"},
    {"phone": "+919900000003", "name": "Dr. Meena Kulkarni"},
]

TEST_PATIENT = {"phone": "+919800000001", "name": "Ravi Kumar"}

# Which doctors go to which facilities (index-based)
DOCTOR_FACILITY_MAP = [
    (0, 0),  # Dr. Sharma → Pune PHC
    (0, 1),  # Dr. Sharma → Baramati
    (1, 0),  # Dr. Patil → Pune PHC
    (1, 2),  # Dr. Patil → Satara
    (2, 1),  # Dr. Kulkarni → Baramati
    (2, 3),  # Dr. Kulkarni → Junnar
]


def seed(db: Session) -> None:
    """Insert seed data (idempotent — skips if facilities already exist)."""

    existing = db.query(Facility).first()
    if existing:
        print("⚠️  Facilities already exist — skipping seed to avoid duplicates.")
        print("   To re-seed, truncate the tables first:")
        print("   TRUNCATE facilities, users, doctor_facility, appointments CASCADE;")
        return

    # ── Facilities ───────────────────────────────────────────────────────
    facility_objs: list[Facility] = []
    for f in FACILITIES:
        fac = Facility(
            name=f["name"],
            type=f["type"],
            address=f["address"],
            contact_phone=f["contact_phone"],
            location=f"SRID=4326;POINT({f['lng']} {f['lat']})",
        )
        db.add(fac)
        facility_objs.append(fac)
    db.flush()  # Assign IDs

    print(f"✓ Created {len(facility_objs)} facilities")

    # ── Doctors ──────────────────────────────────────────────────────────
    doctor_objs: list[User] = []
    for d in DOCTORS:
        doc = User(phone=d["phone"], name=d["name"], role=UserRole.doctor)
        db.add(doc)
        doctor_objs.append(doc)
    db.flush()

    print(f"✓ Created {len(doctor_objs)} doctors")

    # ── Doctor ↔ Facility links ──────────────────────────────────────────
    for doc_idx, fac_idx in DOCTOR_FACILITY_MAP:
        link = DoctorFacility(
            doctor_id=doctor_objs[doc_idx].id,
            facility_id=facility_objs[fac_idx].id,
        )
        db.add(link)

    print(f"✓ Created {len(DOCTOR_FACILITY_MAP)} doctor–facility links")

    # ── Test patient ─────────────────────────────────────────────────────
    patient = User(
        phone=TEST_PATIENT["phone"],
        name=TEST_PATIENT["name"],
        role=UserRole.patient,
    )
    db.add(patient)
    db.flush()

    print(f"✓ Created test patient: {patient.name} ({patient.phone})")

    db.commit()
    print("\n🎉 Seed complete! Test credentials:")
    print(f"   Patient phone: {TEST_PATIENT['phone']}  (OTP: 123456)")
    print(f"   Doctor phones: {', '.join(d['phone'] for d in DOCTORS)}  (OTP: 123456)")


if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed(db)
    except Exception as e:
        db.rollback()
        print(f"❌ Seed failed: {e}")
        raise
    finally:
        db.close()
