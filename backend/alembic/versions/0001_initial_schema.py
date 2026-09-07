"""Initial schema — all core tables for the rural healthcare platform.

Revision ID: 0001
Revises:
Create Date: 2026-09-07
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID
from geoalchemy2 import Geography

# revision identifiers, used by Alembic.
revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Enable PostGIS extension ─────────────────────────────────────────
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    # ── users ────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("abha_id", sa.String(50), nullable=True, unique=True, comment="ABDM ABHA ID"),
        sa.Column("phone", sa.String(15), nullable=False, unique=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column(
            "role",
            sa.Enum("patient", "doctor", "admin", "health_worker", name="user_role", create_constraint=True),
            nullable=False,
        ),
        sa.Column("preferred_language", sa.String(10), nullable=False, server_default=sa.text("'en'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_users_abha_id", "users", ["abha_id"])
    op.create_index("ix_users_role", "users", ["role"])

    # ── facilities ───────────────────────────────────────────────────────
    op.create_table(
        "facilities",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column(
            "type",
            sa.Enum("sub_centre", "phc", "rural_hospital", "district_hospital", name="facility_type", create_constraint=True),
            nullable=False,
        ),
        sa.Column(
            "location",
            Geography(geometry_type="POINT", srid=4326, spatial_index=False),
            nullable=False,
            comment="PostGIS geography point (lng, lat)",
        ),
        sa.Column("address", sa.Text(), nullable=False),
        sa.Column("contact_phone", sa.String(15), nullable=True),
    )
    op.create_index("ix_facilities_location", "facilities", ["location"], postgresql_using="gist")

    # ── doctor_facility ──────────────────────────────────────────────────
    op.create_table(
        "doctor_facility",
        sa.Column("doctor_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("facility_id", UUID(as_uuid=True), sa.ForeignKey("facilities.id", ondelete="CASCADE"), primary_key=True),
    )

    # ── appointments ─────────────────────────────────────────────────────
    op.create_table(
        "appointments",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("patient_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("doctor_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("facility_id", UUID(as_uuid=True), sa.ForeignKey("facilities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "status",
            sa.Enum("booked", "checked_in", "in_progress", "completed", "cancelled", "no_show", name="appointment_status", create_constraint=True),
            nullable=False,
            server_default=sa.text("'booked'"),
        ),
        sa.Column("queue_position", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_appointments_patient_id", "appointments", ["patient_id"])
    op.create_index("ix_appointments_facility_id", "appointments", ["facility_id"])
    op.create_index("ix_appointments_scheduled_at", "appointments", ["scheduled_at"])
    op.create_index("ix_appointments_doctor_schedule", "appointments", ["doctor_id", "scheduled_at"])

    # ── triage_records ───────────────────────────────────────────────────
    op.create_table(
        "triage_records",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("patient_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("symptoms", JSONB(), nullable=False, comment="Structured symptom data from triage flow"),
        sa.Column(
            "urgency_level",
            sa.Enum("red", "yellow", "green", name="urgency_level", create_constraint=True),
            nullable=False,
        ),
        sa.Column("recommended_action", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_triage_records_patient_id", "triage_records", ["patient_id"])

    # ── referrals ────────────────────────────────────────────────────────
    op.create_table(
        "referrals",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("patient_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("from_facility_id", UUID(as_uuid=True), sa.ForeignKey("facilities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("to_facility_id", UUID(as_uuid=True), sa.ForeignKey("facilities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("referring_doctor_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("referred", "accepted", "in_transit", "completed", "follow_up_needed", name="referral_status", create_constraint=True),
            nullable=False,
            server_default=sa.text("'referred'"),
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_referrals_patient_id", "referrals", ["patient_id"])

    # ── medicine_stock ───────────────────────────────────────────────────
    op.create_table(
        "medicine_stock",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("facility_id", UUID(as_uuid=True), sa.ForeignKey("facilities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("medicine_name", sa.String(200), nullable=False),
        sa.Column("quantity_available", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("last_updated_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_medicine_stock_facility_medicine", "medicine_stock", ["facility_id", "medicine_name"])


def downgrade() -> None:
    op.drop_table("medicine_stock")
    op.drop_table("referrals")
    op.drop_table("triage_records")
    op.drop_table("appointments")
    op.drop_table("doctor_facility")
    op.drop_table("facilities")
    op.drop_table("users")

    # Drop enum types
    op.execute("DROP TYPE IF EXISTS referral_status")
    op.execute("DROP TYPE IF EXISTS appointment_status")
    op.execute("DROP TYPE IF EXISTS urgency_level")
    op.execute("DROP TYPE IF EXISTS facility_type")
    op.execute("DROP TYPE IF EXISTS user_role")

    # Note: we intentionally do NOT drop the postgis extension
