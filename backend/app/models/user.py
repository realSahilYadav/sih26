"""User model — patients, doctors, admins, and health workers."""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, Enum, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class UserRole(str, enum.Enum):
    """RBAC roles matching AGENTS.md specification."""

    patient = "patient"
    doctor = "doctor"
    admin = "admin"
    health_worker = "health_worker"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    abha_id: Mapped[Optional[str]] = mapped_column(
        String(50), unique=True, nullable=True, index=True, comment="ABDM ABHA ID"
    )
    phone: Mapped[str] = mapped_column(
        String(15), unique=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role", create_constraint=True),
        nullable=False,
        index=True,
    )
    preferred_language: Mapped[str] = mapped_column(
        String(10), nullable=False, server_default=text("'en'")
    )
    created_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=text("now()")
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )

    # ── Relationships ────────────────────────────────────────────────────
    facilities: Mapped[list] = relationship(  # type: ignore[name-defined]
        "Facility", secondary="doctor_facility", back_populates="doctors", lazy="selectin"
    )
    appointments_as_patient: Mapped[list] = relationship(  # type: ignore[name-defined]
        "Appointment", foreign_keys="[Appointment.patient_id]", back_populates="patient", lazy="selectin"
    )
    appointments_as_doctor: Mapped[list] = relationship(  # type: ignore[name-defined]
        "Appointment", foreign_keys="[Appointment.doctor_id]", back_populates="doctor", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<User {self.name} ({self.role.value})>"
