"""Triage record model — symptom-based urgency assessment."""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import Enum, ForeignKey, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class UrgencyLevel(str, enum.Enum):
    red = "red"
    yellow = "yellow"
    green = "green"


class TriageRecord(Base):
    __tablename__ = "triage_records"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    symptoms: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, comment="Structured symptom data from triage flow"
    )
    vitals: Mapped[Optional[dict[str, Any]]] = mapped_column(
        JSONB, nullable=True, comment="Optional vitals: {temperature, bp_systolic, ...}"
    )
    urgency_level: Mapped[UrgencyLevel] = mapped_column(
        Enum(UrgencyLevel, name="urgency_level", create_constraint=True),
        nullable=False,
    )
    recommended_action: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )
    triggered_rules: Mapped[Optional[list[dict[str, Any]]]] = mapped_column(
        JSONB,
        nullable=True,
        comment="Array of {rule_id, rule_name, urgency, explanation} — explainability record",
    )
    free_text: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="Patient free-text symptom description"
    )
    appointment_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("appointments.id", ondelete="SET NULL"),
        nullable=True,
        comment="Resulting appointment if patient booked after triage",
    )
    created_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=text("now()")
    )

    # ── Relationships ────────────────────────────────────────────────────
    patient: Mapped["User"] = relationship(lazy="selectin")  # type: ignore[name-defined]
    appointment: Mapped[Optional["Appointment"]] = relationship(lazy="selectin")  # type: ignore[name-defined]

    def __repr__(self) -> str:
        return f"<TriageRecord {self.id} urgency={self.urgency_level.value}>"
