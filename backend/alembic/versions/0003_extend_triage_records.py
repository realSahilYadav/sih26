"""Extend triage_records for rule engine — add vitals, triggered_rules, free_text, appointment_id.

Revision ID: 0003
Revises: 0002_add_is_active
Create Date: 2026-09-12
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

# revision identifiers, used by Alembic.
revision = "0003_extend_triage_records"
down_revision = "0002_add_is_active"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add JSONB column for structured vitals (temperature, BP, etc.)
    op.add_column(
        "triage_records",
        sa.Column(
            "vitals",
            JSONB,
            nullable=True,
            comment="Optional vitals: {temperature, bp_systolic, ...}",
        ),
    )

    # Add JSONB column for explainability — stores every rule that fired
    op.add_column(
        "triage_records",
        sa.Column(
            "triggered_rules",
            JSONB,
            nullable=True,
            comment="Array of {rule_id, rule_name, urgency, explanation} — explainability record",
        ),
    )

    # Add free-text symptom description
    op.add_column(
        "triage_records",
        sa.Column(
            "free_text",
            sa.Text,
            nullable=True,
            comment="Patient free-text symptom description",
        ),
    )

    # Add FK to appointments — links triage to resulting appointment
    op.add_column(
        "triage_records",
        sa.Column(
            "appointment_id",
            UUID(as_uuid=True),
            sa.ForeignKey("appointments.id", ondelete="SET NULL"),
            nullable=True,
            comment="Resulting appointment if patient booked after triage",
        ),
    )


def downgrade() -> None:
    op.drop_column("triage_records", "appointment_id")
    op.drop_column("triage_records", "free_text")
    op.drop_column("triage_records", "triggered_rules")
    op.drop_column("triage_records", "vitals")
