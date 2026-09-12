"""Pydantic schemas for the triage API — request/response validation."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


# ── Request schemas ──────────────────────────────────────────────────────────

class VitalsInput(BaseModel):
    """Optional vitals from patient or health worker."""

    temperature: float | None = Field(
        None, ge=30.0, le=45.0, description="Body temperature in °C"
    )
    # Future extensions — add fields here without breaking existing clients:
    # bp_systolic: int | None = Field(None, ge=50, le=300)
    # bp_diastolic: int | None = Field(None, ge=30, le=200)
    # spo2: int | None = Field(None, ge=0, le=100)
    # pulse: int | None = Field(None, ge=20, le=250)


class TriageRequest(BaseModel):
    """Payload for POST /api/triage."""

    symptoms: list[str] = Field(
        default_factory=list,
        description="List of symptom IDs from the checklist",
    )
    free_text: str | None = Field(
        None, max_length=2000, description="Free-text symptom description"
    )
    vitals: VitalsInput | None = None


class LinkAppointmentRequest(BaseModel):
    """Payload for PATCH /api/triage/{id}/link-appointment."""

    appointment_id: str


# ── Response schemas ─────────────────────────────────────────────────────────

class RuleExplanation(BaseModel):
    """One triggered rule's explainability record."""

    rule_id: str
    rule_name: str
    urgency: str
    detail: str


class TriageResponse(BaseModel):
    """Response from POST /api/triage."""

    triage_record_id: str
    urgency_level: str
    recommended_action: str
    explanation: list[RuleExplanation]


class SymptomOptionSchema(BaseModel):
    """A single selectable symptom for the frontend."""

    id: str
    label: str
    category: str


class SymptomCategoryGroup(BaseModel):
    """One symptom category with its options."""

    category: str
    icon: str
    description: str
    symptoms: list[SymptomOptionSchema]


class TriageHistoryItem(BaseModel):
    """One past triage record for the patient's history."""

    id: str
    urgency_level: str
    recommended_action: str | None
    triggered_rules: list[RuleExplanation]
    created_at: datetime
    appointment_id: str | None
