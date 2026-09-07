"""
app.models — SQLAlchemy ORM models for the rural healthcare platform.

Import this package to ensure all model metadata is registered with Base
(required for Alembic autogenerate).
"""

from app.models.appointment import Appointment, AppointmentStatus  # noqa: F401
from app.models.doctor_facility import DoctorFacility  # noqa: F401
from app.models.facility import Facility, FacilityType  # noqa: F401
from app.models.medicine_stock import MedicineStock  # noqa: F401
from app.models.referral import Referral, ReferralStatus  # noqa: F401
from app.models.triage_record import TriageRecord, UrgencyLevel  # noqa: F401
from app.models.user import User, UserRole  # noqa: F401

__all__ = [
    "Appointment",
    "AppointmentStatus",
    "DoctorFacility",
    "Facility",
    "FacilityType",
    "MedicineStock",
    "Referral",
    "ReferralStatus",
    "TriageRecord",
    "UrgencyLevel",
    "User",
    "UserRole",
]
