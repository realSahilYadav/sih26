"""Pydantic schemas for medicine stock endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ── Search ───────────────────────────────────────────────────────────────────


class MedicineSearchResult(BaseModel):
    """A facility that has a given medicine in stock, with distance info."""

    facility_id: str
    facility_name: str
    facility_type: str
    address: str
    contact_phone: str | None = None
    lat: float
    lng: float
    distance_km: float = Field(..., description="Distance from search point in km")
    medicine_name: str
    quantity_available: int


# ── Stock update ─────────────────────────────────────────────────────────────


class StockUpdateRequest(BaseModel):
    """Body for POST /api/medicines/stock."""

    facility_id: str = Field(..., description="UUID of the facility to update stock for")
    medicine_name: str = Field(..., min_length=1, max_length=200)
    quantity: int = Field(..., ge=0, description="New quantity (replaces current)")


class StockUpdateResponse(BaseModel):
    """Confirmation after a stock upsert."""

    id: str
    facility_id: str
    medicine_name: str
    quantity_available: int
    updated_at: datetime


# ── Facility stock list ──────────────────────────────────────────────────────


class FacilityStockItem(BaseModel):
    """Single medicine row in a facility's full stock list."""

    id: str
    medicine_name: str
    quantity_available: int
    last_updated_by: str | None = None
    updater_name: str | None = None
    updated_at: datetime
