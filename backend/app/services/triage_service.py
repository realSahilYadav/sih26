"""Triage service — orchestrates the rule engine and database persistence."""

from __future__ import annotations

import uuid
from dataclasses import asdict

from sqlalchemy.orm import Session

from app.models.triage_record import TriageRecord, UrgencyLevel
from app.schemas.triage import (
    LinkAppointmentRequest,
    RuleExplanation,
    TriageHistoryItem,
    TriageRequest,
    TriageResponse,
)
from app.services.triage_rules import TriageInput, VitalsData, evaluate


def evaluate_and_store(
    db: Session,
    patient_id: uuid.UUID,
    request: TriageRequest,
) -> TriageResponse:
    """Evaluate symptoms using the rule engine and persist the result.

    Returns a ``TriageResponse`` with the urgency level, recommended action,
    and the full list of triggered rule explanations.
    """
    # ── Build rule-engine input ──────────────────────────────────────────
    vitals = VitalsData()
    vitals_dict: dict | None = None
    if request.vitals:
        vitals = VitalsData(temperature=request.vitals.temperature)
        vitals_dict = request.vitals.model_dump(exclude_none=True) or None

    triage_input = TriageInput(
        symptom_ids=request.symptoms,
        free_text=request.free_text,
        vitals=vitals,
    )

    # ── Evaluate ─────────────────────────────────────────────────────────
    output = evaluate(triage_input)

    # ── Persist ──────────────────────────────────────────────────────────
    triggered_rules_json = [asdict(r) for r in output.triggered_rules]

    record = TriageRecord(
        patient_id=patient_id,
        symptoms={
            "selected": request.symptoms,
            "free_text": request.free_text,
        },
        vitals=vitals_dict,
        urgency_level=UrgencyLevel(output.urgency_level),
        recommended_action=output.recommended_action,
        triggered_rules=triggered_rules_json,
        free_text=request.free_text,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    # ── Build response ───────────────────────────────────────────────────
    return TriageResponse(
        triage_record_id=str(record.id),
        urgency_level=output.urgency_level,
        recommended_action=output.recommended_action,
        explanation=[
            RuleExplanation(
                rule_id=r.rule_id,
                rule_name=r.rule_name,
                urgency=r.urgency,
                detail=r.explanation,
            )
            for r in output.triggered_rules
        ],
    )


def get_triage_history(
    db: Session,
    patient_id: uuid.UUID,
) -> list[TriageHistoryItem]:
    """Fetch all triage records for a patient, newest first."""
    records = (
        db.query(TriageRecord)
        .filter(TriageRecord.patient_id == patient_id)
        .order_by(TriageRecord.created_at.desc())
        .all()
    )

    items: list[TriageHistoryItem] = []
    for r in records:
        rules_raw = r.triggered_rules or []
        items.append(
            TriageHistoryItem(
                id=str(r.id),
                urgency_level=r.urgency_level.value,
                recommended_action=r.recommended_action,
                triggered_rules=[
                    RuleExplanation(
                        rule_id=rule.get("rule_id", ""),
                        rule_name=rule.get("rule_name", ""),
                        urgency=rule.get("urgency", "green"),
                        detail=rule.get("explanation", ""),
                    )
                    for rule in rules_raw
                ],
                created_at=r.created_at,
                appointment_id=str(r.appointment_id) if r.appointment_id else None,
            )
        )
    return items


def link_appointment(
    db: Session,
    triage_id: uuid.UUID,
    patient_id: uuid.UUID,
    data: LinkAppointmentRequest,
) -> None:
    """Link a triage record to the appointment it led to."""
    record = (
        db.query(TriageRecord)
        .filter(
            TriageRecord.id == triage_id,
            TriageRecord.patient_id == patient_id,
        )
        .first()
    )
    if record is None:
        raise ValueError("Triage record not found")

    record.appointment_id = uuid.UUID(data.appointment_id)  # type: ignore[assignment]
    db.commit()
