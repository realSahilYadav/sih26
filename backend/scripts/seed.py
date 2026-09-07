"""
Seed script — populate the database with sample data for development.

Usage:
    cd backend
    python -m scripts.seed

Idempotent: skips insertion if data already exists.
"""

from __future__ import annotations

import random
import sys
import uuid

from sqlalchemy import select, text

# Ensure the backend package is importable
sys.path.insert(0, ".")

from app.core.database import SessionLocal
from app.models.doctor_facility import DoctorFacility
from app.models.facility import Facility
from app.models.medicine_stock import MedicineStock
from app.models.user import User, UserRole


# ── Fixed UUIDs so the seed is deterministic & re-runnable ───────────────
FACILITY_IDS = [uuid.UUID(f"00000000-0000-4000-a000-00000000000{i}") for i in range(1, 6)]
DOCTOR_IDS = [uuid.UUID(f"00000000-0000-4000-b000-00000000000{i}") for i in range(1, 4)]
PATIENT_IDS = [uuid.UUID(f"00000000-0000-4000-c000-00000000000{i}") for i in range(1, 3)]
ADMIN_ID = uuid.UUID("00000000-0000-4000-d000-000000000001")

# ── Facility seed data ──────────────────────────────────────────────────
FACILITIES = [
    {
        "id": FACILITY_IDS[0],
        "name": "Sub Centre Karjat",
        "type": "sub_centre",
        "lng": 73.32,
        "lat": 18.91,
        "address": "Near Karjat Railway Station, Karjat, Raigad, Maharashtra 410201",
        "contact_phone": "+912148222111",
    },
    {
        "id": FACILITY_IDS[1],
        "name": "PHC Murbad",
        "type": "phc",
        "lng": 73.39,
        "lat": 19.25,
        "address": "Murbad-Kalyan Road, Murbad, Thane, Maharashtra 421401",
        "contact_phone": "+912524222333",
    },
    {
        "id": FACILITY_IDS[2],
        "name": "Rural Hospital Shahapur",
        "type": "rural_hospital",
        "lng": 73.33,
        "lat": 19.45,
        "address": "Hospital Road, Shahapur, Thane, Maharashtra 421601",
        "contact_phone": "+912527222444",
    },
    {
        "id": FACILITY_IDS[3],
        "name": "PHC Jawhar",
        "type": "phc",
        "lng": 73.23,
        "lat": 19.91,
        "address": "Main Road, Jawhar, Palghar, Maharashtra 401603",
        "contact_phone": "+912520222555",
    },
    {
        "id": FACILITY_IDS[4],
        "name": "District Hospital Thane",
        "type": "district_hospital",
        "lng": 72.97,
        "lat": 19.22,
        "address": "Civil Hospital Campus, Station Road, Thane (W), Maharashtra 400601",
        "contact_phone": "+912225331100",
    },
]

# ── Doctor seed data ────────────────────────────────────────────────────
DOCTORS = [
    {
        "id": DOCTOR_IDS[0],
        "name": "Dr. Anjali Deshmukh",
        "phone": "+919876543210",
        "preferred_language": "mr",
    },
    {
        "id": DOCTOR_IDS[1],
        "name": "Dr. Rajesh Patil",
        "phone": "+919876543211",
        "preferred_language": "mr",
    },
    {
        "id": DOCTOR_IDS[2],
        "name": "Dr. Priya Sharma",
        "phone": "+919876543212",
        "preferred_language": "hi",
    },
]

# Doctor → Facility assignments
DOCTOR_FACILITY_LINKS = [
    (DOCTOR_IDS[0], FACILITY_IDS[0]),  # Dr. Anjali → Sub Centre Karjat
    (DOCTOR_IDS[0], FACILITY_IDS[1]),  # Dr. Anjali → PHC Murbad (visits)
    (DOCTOR_IDS[1], FACILITY_IDS[2]),  # Dr. Rajesh → Rural Hospital Shahapur
    (DOCTOR_IDS[2], FACILITY_IDS[3]),  # Dr. Priya → PHC Jawhar
    (DOCTOR_IDS[2], FACILITY_IDS[4]),  # Dr. Priya → District Hospital Thane
]

# ── Patient seed data ──────────────────────────────────────────────────
PATIENTS = [
    {
        "id": PATIENT_IDS[0],
        "name": "Ramesh Kumar",
        "phone": "+919900110011",
        "abha_id": "91-1234-5678-9012",
        "preferred_language": "hi",
    },
    {
        "id": PATIENT_IDS[1],
        "name": "Sunita Jadhav",
        "phone": "+919900110022",
        "abha_id": "91-1234-5678-9013",
        "preferred_language": "mr",
    },
]

# ── Admin seed data ─────────────────────────────────────────────────────
ADMIN = {
    "id": ADMIN_ID,
    "name": "System Admin",
    "phone": "+919900000001",
    "preferred_language": "en",
}

# ── Medicine seed data ──────────────────────────────────────────────────
MEDICINES = ["Paracetamol 500mg", "Amoxicillin 250mg", "ORS Sachets", "Metformin 500mg", "Ibuprofen 400mg"]


def seed() -> None:
    """Insert sample development data. Idempotent — checks before inserting."""
    db = SessionLocal()
    random.seed(42)  # deterministic quantities

    try:
        # Check if data already exists
        existing = db.scalar(select(User).limit(1))
        if existing is not None:
            print("⚠️  Database already contains data — skipping seed.")
            return

        print("🌱 Seeding database …")

        # ── Users ────────────────────────────────────────────────────────
        # Admin
        db.add(User(role=UserRole.admin, **ADMIN))

        # Doctors
        for doc in DOCTORS:
            db.add(User(role=UserRole.doctor, **doc))

        # Patients
        for patient in PATIENTS:
            db.add(User(role=UserRole.patient, **patient))

        db.flush()
        print(f"  ✓ Created {1 + len(DOCTORS) + len(PATIENTS)} users")

        # ── Facilities ───────────────────────────────────────────────────
        for fac in FACILITIES:
            lat = fac.pop("lat")
            lng = fac.pop("lng")
            db.add(
                Facility(
                    location=text(f"ST_MakePoint({lng}, {lat})::geography"),
                    **fac,
                )
            )
        db.flush()
        print(f"  ✓ Created {len(FACILITIES)} facilities")

        # ── Doctor ↔ Facility links ──────────────────────────────────────
        for doctor_id, facility_id in DOCTOR_FACILITY_LINKS:
            db.add(DoctorFacility(doctor_id=doctor_id, facility_id=facility_id))
        db.flush()
        print(f"  ✓ Linked {len(DOCTOR_FACILITY_LINKS)} doctor–facility pairs")

        # ── Medicine stock ───────────────────────────────────────────────
        stock_count = 0
        for fac_id in FACILITY_IDS:
            # Each facility gets 3-5 random medicines
            for med_name in random.sample(MEDICINES, k=random.randint(3, 5)):
                db.add(
                    MedicineStock(
                        facility_id=fac_id,
                        medicine_name=med_name,
                        quantity_available=random.randint(10, 500),
                        last_updated_by=ADMIN_ID,
                    )
                )
                stock_count += 1
        db.flush()
        print(f"  ✓ Created {stock_count} medicine stock entries")

        db.commit()
        print("✅ Seed complete!")

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
