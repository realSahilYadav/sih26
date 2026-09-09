"""Facility search API — nearby facilities using PostGIS."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.facility import FacilityNearbyResponse
from app.services.appointment import get_nearby_facilities

router = APIRouter(prefix="/api/facilities", tags=["facilities"])


@router.get("/nearby", response_model=list[FacilityNearbyResponse])
async def nearby_facilities(
    lat: Annotated[float, Query(description="Latitude of search origin")],
    lng: Annotated[float, Query(description="Longitude of search origin")],
    radius_km: Annotated[float, Query(description="Search radius in km")] = 25.0,
    db: Session = Depends(get_db),
) -> list[FacilityNearbyResponse]:
    """Return facilities within *radius_km* of the given coordinates, sorted by distance."""
    return get_nearby_facilities(db, lat, lng, radius_km)
