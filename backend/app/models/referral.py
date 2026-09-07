"""Referral model — inter-facility patient transfers."""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Enum, ForeignKey, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.facility import Facility
    from app.models.user import User


class ReferralStatus(str, enum.Enum):
    referred = "referred"
    accepted = "accepted"
    in_transit = "in_transit"
    completed = "completed"
    follow_up_needed = "follow_up_needed"


class Referral(Base):
    __tablename__ = "referrals"

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
    from_facility_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("facilities.id", ondelete="CASCADE"),
        nullable=False,
    )
    to_facility_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("facilities.id", ondelete="CASCADE"),
        nullable=False,
    )
    referring_doctor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[ReferralStatus] = mapped_column(
        Enum(ReferralStatus, name="referral_status", create_constraint=True),
        nullable=False,
        server_default=text("'referred'"),
    )
    created_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=text("now()"), onupdate=datetime.now
    )

    # ── Relationships ────────────────────────────────────────────────────
    patient: Mapped["User"] = relationship(foreign_keys=[patient_id], lazy="selectin")
    referring_doctor: Mapped["User"] = relationship(
        foreign_keys=[referring_doctor_id], lazy="selectin"
    )
    from_facility: Mapped["Facility"] = relationship(
        foreign_keys=[from_facility_id], lazy="selectin"
    )
    to_facility: Mapped["Facility"] = relationship(
        foreign_keys=[to_facility_id], lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<Referral {self.id} status={self.status.value}>"
