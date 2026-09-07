"""Medicine stock model — per-facility inventory tracking."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import ForeignKey, Index, Integer, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.facility import Facility
    from app.models.user import User


class MedicineStock(Base):
    __tablename__ = "medicine_stock"
    __table_args__ = (
        Index("ix_medicine_stock_facility_medicine", "facility_id", "medicine_name"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    facility_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("facilities.id", ondelete="CASCADE"),
        nullable=False,
    )
    medicine_name: Mapped[str] = mapped_column(String(200), nullable=False)
    quantity_available: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_updated_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=text("now()"), onupdate=datetime.now
    )

    # ── Relationships ────────────────────────────────────────────────────
    facility: Mapped["Facility"] = relationship(lazy="selectin")
    updater: Mapped[Optional["User"]] = relationship(
        foreign_keys=[last_updated_by], lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<MedicineStock {self.medicine_name} qty={self.quantity_available}>"
