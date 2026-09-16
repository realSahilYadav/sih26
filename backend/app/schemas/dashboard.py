"""Dashboard schemas — facility summary response."""

from __future__ import annotations

from pydantic import BaseModel, Field


class AppointmentStats(BaseModel):
    """Today's appointment counts by status."""

    total: int = 0
    booked: int = 0
    checked_in: int = 0
    in_progress: int = 0
    completed: int = 0
    cancelled: int = 0
    no_show: int = 0


class ReferralStats(BaseModel):
    """Active referral counts by direction and status."""

    incoming_total: int = 0
    outgoing_total: int = 0
    by_status: dict[str, int] = Field(default_factory=dict)


class LowStockAlert(BaseModel):
    """A medicine that is below the low-stock threshold."""

    medicine_name: str
    quantity_available: int
    threshold: int


class TriageDayCount(BaseModel):
    """Triage counts for a single day."""

    date: str  # YYYY-MM-DD
    red: int = 0
    yellow: int = 0
    green: int = 0
    total: int = 0


class FacilitySummary(BaseModel):
    """Full facility dashboard summary."""

    facility_id: str
    facility_name: str
    appointments: AppointmentStats
    referrals: ReferralStats
    low_stock_alerts: list[LowStockAlert] = []
    triage_trend: list[TriageDayCount] = []
