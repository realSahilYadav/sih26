"""Medicine stock API — search, update, and facility stock listing."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.user import User
from app.schemas.medicine import (
    FacilityStockItem,
    MedicineSearchResult,
    StockUpdateRequest,
    StockUpdateResponse,
)
from app.services.medicine import (
    get_facility_stock,
    search_medicine_nearby,
    update_facility_stock,
)

router = APIRouter(prefix="/api/medicines", tags=["medicines"])


@router.get("/search", response_model=list[MedicineSearchResult])
async def search_medicines(
    name: Annotated[str, Query(description="Medicine name (partial match)")],
    lat: Annotated[float, Query(description="Latitude of search origin")],
    lng: Annotated[float, Query(description="Longitude of search origin")],
    radius_km: Annotated[float, Query(description="Search radius in km")] = 25.0,
    db: Session = Depends(get_db),
) -> list[MedicineSearchResult]:
    """Find facilities within *radius_km* that have the given medicine in stock."""
    if not name.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Medicine name must not be empty",
        )
    return search_medicine_nearby(db, name.strip(), lat, lng, radius_km)


@router.post("/stock", response_model=StockUpdateResponse)
async def update_stock(
    body: StockUpdateRequest,
    current_user: Annotated[User, Depends(require_roles("admin"))],
    db: Session = Depends(get_db),
) -> StockUpdateResponse:
    """Admin endpoint — upsert medicine stock for a facility."""
    return update_facility_stock(
        db,
        facility_id=body.facility_id,
        medicine_name=body.medicine_name,
        quantity=body.quantity,
        user_id=current_user.id,
    )


@router.get("/facility/{facility_id}", response_model=list[FacilityStockItem])
async def facility_stock(
    facility_id: str,
    db: Session = Depends(get_db),
) -> list[FacilityStockItem]:
    """Return the full stock list for a facility."""
    return get_facility_stock(db, facility_id)
