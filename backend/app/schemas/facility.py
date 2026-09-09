"""Pydantic schemas for facility-related endpoints."""

from __future__ import annotations

from pydantic import BaseModel, Field


class FacilityNearbyResponse(BaseModel):
    """Single facility in the nearby-search results."""

    id: str
    name: str
    type: str
    address: str
    contact_phone: str | None = None
    lat: float
    lng: float
    distance_km: float = Field(..., description="Distance from query point in kilometres")


class DoctorAtFacility(BaseModel):
    """A doctor available at a given facility."""

    id: str
    name: str
