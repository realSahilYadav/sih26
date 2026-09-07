"""Facility model — health facilities with PostGIS location."""

from __future__ import annotations

import enum
import uuid
from typing import TYPE_CHECKING, Optional

from geoalchemy2 import Geography
from sqlalchemy import Enum, Index, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class FacilityType(str, enum.Enum):
    """Government health-facility hierarchy."""

    sub_centre = "sub_centre"
    phc = "phc"
    rural_hospital = "rural_hospital"
    district_hospital = "district_hospital"


class Facility(Base):
    __tablename__ = "facilities"
    __table_args__ = (
        Index("ix_facilities_location", "location", postgresql_using="gist"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    type: Mapped[FacilityType] = mapped_column(
        Enum(FacilityType, name="facility_type", create_constraint=True),
        nullable=False,
    )
    location: Mapped[str] = mapped_column(
        Geography(geometry_type="POINT", srid=4326, spatial_index=False),
        nullable=False,
        comment="PostGIS geography point (lng, lat)",
    )
    address: Mapped[str] = mapped_column(Text, nullable=False)
    contact_phone: Mapped[Optional[str]] = mapped_column(String(15), nullable=True)

    # ── Relationships ────────────────────────────────────────────────────
    doctors: Mapped[list] = relationship(
        "User", secondary="doctor_facility", back_populates="facilities", lazy="selectin"
    )

    # ── Convenience properties ───────────────────────────────────────────
    @hybrid_property
    def lat(self) -> Optional[float]:
        """Latitude extracted from the geography point (Python side only)."""
        # Requires the location to be loaded as a WKBElement;
        # for DB-side usage, use ST_Y(location::geometry).
        from geoalchemy2.shape import to_shape

        if self.location is not None:
            return to_shape(self.location).y
        return None

    @hybrid_property
    def lng(self) -> Optional[float]:
        """Longitude extracted from the geography point (Python side only)."""
        from geoalchemy2.shape import to_shape

        if self.location is not None:
            return to_shape(self.location).x
        return None

    def __repr__(self) -> str:
        return f"<Facility {self.name} ({self.type.value})>"
