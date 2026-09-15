"""Triage API — symptom-based urgency assessment endpoints."""

from __future__ import annotations

from typing import Annotated

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.user import User
from app.schemas.triage import (
    LinkAppointmentRequest,
    SymptomCategoryGroup,
    TriageHistoryItem,
    TriageRequest,
    TriageResponse,
)
from app.services import triage_service
from app.services.triage_rules import get_symptom_checklist

router = APIRouter(prefix="/api/triage", tags=["triage"])


@router.get(
    "/symptoms",
    response_model=list[SymptomCategoryGroup],
    summary="Get symptom checklist",
)
async def get_symptoms(
    user: Annotated[User, Depends(require_roles("patient", "health_worker"))],
) -> list[dict]:
    """Return the symptom checklist grouped by category.

    The frontend renders this as selectable category cards → symptom
    checkboxes.  The checklist is defined in the rule engine so that
    the API never drifts out of sync with the scorer.
    """
    return get_symptom_checklist()


@router.post(
    "",
    response_model=TriageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Evaluate triage",
)
async def evaluate_triage(
    request: TriageRequest,
    user: Annotated[User, Depends(require_roles("patient", "health_worker"))],
    db: Session = Depends(get_db),
) -> TriageResponse:
    """Accept selected symptoms + optional vitals + free text, evaluate
    against the rule engine, persist the record, and return the urgency
    level with a full explanation of which rules triggered.
    """
    return triage_service.evaluate_and_store(db, user.id, request)


@router.get(
    "/history",
    response_model=list[TriageHistoryItem],
    summary="Triage history",
)
async def triage_history(
    user: Annotated[User, Depends(require_roles("patient", "health_worker", "doctor"))],
    db: Session = Depends(get_db),
) -> list[TriageHistoryItem]:
    """Return the authenticated patient's past triage records, newest first."""
    return triage_service.get_triage_history(db, user.id)


@router.patch(
    "/{triage_id}/link-appointment",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    summary="Link triage to appointment",
)
async def link_appointment(
    triage_id: uuid.UUID,
    data: LinkAppointmentRequest,
    user: Annotated[User, Depends(require_roles("patient", "health_worker"))],
    db: Session = Depends(get_db),
) -> None:
    """Link an existing triage record to the appointment it led to.

    Called by the frontend after the patient books an appointment following
    a triage evaluation.
    """
    try:
        triage_service.link_appointment(db, triage_id, user.id, data)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
