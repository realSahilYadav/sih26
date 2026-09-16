"""Medicine stock service — search, upsert, and listing logic."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.medicine_stock import MedicineStock
from app.schemas.medicine import (
    FacilityStockItem,
    MedicineSearchResult,
    StockUpdateResponse,
)

logger = logging.getLogger(__name__)


# ── Nearby medicine search ───────────────────────────────────────────────────


def search_medicine_nearby(
    db: Session,
    name: str,
    lat: float,
    lng: float,
    radius_km: float = 25.0,
) -> list[MedicineSearchResult]:
    """Find facilities within *radius_km* that have *name* in stock (qty > 0).

    Uses PostGIS ST_DWithin (index-assisted) on the geography column,
    joined with ``medicine_stock`` filtered by ILIKE on medicine_name.
    Results are sorted by distance ascending.
    """
    radius_m = radius_km * 1000
    point_wkt = f"SRID=4326;POINT({lng} {lat})"

    rows = db.execute(
        text("""
            SELECT
                f.id            AS facility_id,
                f.name          AS facility_name,
                f.type          AS facility_type,
                f.address,
                f.contact_phone,
                ST_Y(f.location::geometry)  AS lat,
                ST_X(f.location::geometry)  AS lng,
                ST_Distance(f.location, ST_GeogFromText(:point)) / 1000.0 AS distance_km,
                ms.medicine_name,
                ms.quantity_available
            FROM medicine_stock ms
            JOIN facilities f ON f.id = ms.facility_id
            WHERE ms.medicine_name ILIKE :pattern
              AND ms.quantity_available > 0
              AND ST_DWithin(f.location, ST_GeogFromText(:point), :radius_m)
            ORDER BY distance_km
        """),
        {
            "pattern": f"%{name}%",
            "point": point_wkt,
            "radius_m": radius_m,
        },
    ).fetchall()

    return [
        MedicineSearchResult(
            facility_id=str(r.facility_id),
            facility_name=r.facility_name,
            facility_type=r.facility_type,
            address=r.address,
            contact_phone=r.contact_phone,
            lat=r.lat,
            lng=r.lng,
            distance_km=round(r.distance_km, 2),
            medicine_name=r.medicine_name,
            quantity_available=r.quantity_available,
        )
        for r in rows
    ]


# ── Stock upsert ─────────────────────────────────────────────────────────────


def update_facility_stock(
    db: Session,
    facility_id: str,
    medicine_name: str,
    quantity: int,
    user_id: uuid.UUID,
) -> StockUpdateResponse:
    """Upsert a medicine_stock row for the given facility.

    If a row already exists for (facility_id, medicine_name), its quantity and
    updater are updated.  Otherwise a new row is inserted.
    """
    existing = (
        db.query(MedicineStock)
        .filter(
            MedicineStock.facility_id == facility_id,
            MedicineStock.medicine_name == medicine_name,
        )
        .first()
    )

    if existing:
        existing.quantity_available = quantity
        existing.last_updated_by = user_id
        existing.updated_at = datetime.now()
        db.commit()
        db.refresh(existing)
        row = existing
    else:
        row = MedicineStock(
            facility_id=facility_id,
            medicine_name=medicine_name,
            quantity_available=quantity,
            last_updated_by=user_id,
        )
        db.add(row)
        db.commit()
        db.refresh(row)

    logger.info(
        "Stock upsert: facility=%s medicine=%s qty=%d by user=%s",
        facility_id,
        medicine_name,
        quantity,
        user_id,
    )

    return StockUpdateResponse(
        id=str(row.id),
        facility_id=str(row.facility_id),
        medicine_name=row.medicine_name,
        quantity_available=row.quantity_available,
        updated_at=row.updated_at,
    )


# ── Facility stock listing ──────────────────────────────────────────────────


def get_facility_stock(db: Session, facility_id: str) -> list[FacilityStockItem]:
    """Return every medicine_stock row for a facility, ordered by name."""
    rows = (
        db.query(MedicineStock)
        .filter(MedicineStock.facility_id == facility_id)
        .order_by(MedicineStock.medicine_name)
        .all()
    )

    return [
        FacilityStockItem(
            id=str(r.id),
            medicine_name=r.medicine_name,
            quantity_available=r.quantity_available,
            last_updated_by=str(r.last_updated_by) if r.last_updated_by else None,
            updater_name=r.updater.name if r.updater else None,
            updated_at=r.updated_at,
        )
        for r in rows
    ]
