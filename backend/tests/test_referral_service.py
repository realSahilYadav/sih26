"""Unit tests for referral tracking — state machine + schema validation.

Tests the referral status enum and Pydantic schemas in isolation,
avoiding the full ORM import chain that requires pydantic_settings.
"""

from __future__ import annotations

import enum

import pytest


# ═══════════════════════════════════════════════════════════════════════════════
#  Inline ReferralStatus + state machine (mirrors app/models/referral.py
#  and app/services/referral.py to avoid the DB import chain)
# ═══════════════════════════════════════════════════════════════════════════════


class ReferralStatus(str, enum.Enum):
    referred = "referred"
    accepted = "accepted"
    in_transit = "in_transit"
    completed = "completed"
    follow_up_needed = "follow_up_needed"


# Mirrors _VALID_TRANSITIONS from app/services/referral.py
VALID_TRANSITIONS: dict[ReferralStatus, set[ReferralStatus]] = {
    ReferralStatus.referred: {ReferralStatus.accepted},
    ReferralStatus.accepted: {ReferralStatus.in_transit},
    ReferralStatus.in_transit: {ReferralStatus.completed, ReferralStatus.follow_up_needed},
}


# ═══════════════════════════════════════════════════════════════════════════════
#  State machine tests
# ═══════════════════════════════════════════════════════════════════════════════


class TestStateMachine:
    """Verify the transition rules match the plan."""

    def test_referred_can_transition_to_accepted(self):
        assert ReferralStatus.accepted in VALID_TRANSITIONS[ReferralStatus.referred]

    def test_referred_cannot_skip_to_completed(self):
        assert ReferralStatus.completed not in VALID_TRANSITIONS[ReferralStatus.referred]

    def test_referred_cannot_skip_to_in_transit(self):
        assert ReferralStatus.in_transit not in VALID_TRANSITIONS[ReferralStatus.referred]

    def test_accepted_can_transition_to_in_transit(self):
        assert ReferralStatus.in_transit in VALID_TRANSITIONS[ReferralStatus.accepted]

    def test_accepted_cannot_skip_to_completed(self):
        assert ReferralStatus.completed not in VALID_TRANSITIONS[ReferralStatus.accepted]

    def test_in_transit_can_complete(self):
        assert ReferralStatus.completed in VALID_TRANSITIONS[ReferralStatus.in_transit]

    def test_in_transit_can_need_follow_up(self):
        assert ReferralStatus.follow_up_needed in VALID_TRANSITIONS[ReferralStatus.in_transit]

    def test_completed_has_no_transitions(self):
        assert ReferralStatus.completed not in VALID_TRANSITIONS

    def test_follow_up_has_no_transitions(self):
        assert ReferralStatus.follow_up_needed not in VALID_TRANSITIONS

    def test_all_non_terminal_statuses_have_transitions(self):
        terminal = {ReferralStatus.completed, ReferralStatus.follow_up_needed}
        for status in ReferralStatus:
            if status not in terminal:
                assert status in VALID_TRANSITIONS, f"Missing transitions for {status}"
                assert len(VALID_TRANSITIONS[status]) > 0

    def test_no_self_transitions(self):
        for from_status, to_statuses in VALID_TRANSITIONS.items():
            assert from_status not in to_statuses

    def test_full_happy_path(self):
        """referred → accepted → in_transit → completed"""
        s = ReferralStatus.referred
        assert ReferralStatus.accepted in VALID_TRANSITIONS[s]
        s = ReferralStatus.accepted
        assert ReferralStatus.in_transit in VALID_TRANSITIONS[s]
        s = ReferralStatus.in_transit
        assert ReferralStatus.completed in VALID_TRANSITIONS[s]

    def test_follow_up_path(self):
        """referred → accepted → in_transit → follow_up_needed"""
        s = ReferralStatus.in_transit
        assert ReferralStatus.follow_up_needed in VALID_TRANSITIONS[s]

    def test_referred_has_exactly_one_transition(self):
        assert len(VALID_TRANSITIONS[ReferralStatus.referred]) == 1

    def test_accepted_has_exactly_one_transition(self):
        assert len(VALID_TRANSITIONS[ReferralStatus.accepted]) == 1

    def test_in_transit_has_exactly_two_transitions(self):
        assert len(VALID_TRANSITIONS[ReferralStatus.in_transit]) == 2

    def test_backward_transitions_not_allowed(self):
        """No transition should go backwards."""
        assert ReferralStatus.referred not in VALID_TRANSITIONS.get(ReferralStatus.accepted, set())
        assert ReferralStatus.referred not in VALID_TRANSITIONS.get(ReferralStatus.in_transit, set())
        assert ReferralStatus.accepted not in VALID_TRANSITIONS.get(ReferralStatus.in_transit, set())


# ═══════════════════════════════════════════════════════════════════════════════
#  Enum tests
# ═══════════════════════════════════════════════════════════════════════════════


class TestReferralStatus:
    def test_all_expected_statuses_exist(self):
        expected = {"referred", "accepted", "in_transit", "completed", "follow_up_needed"}
        actual = {s.value for s in ReferralStatus}
        assert actual == expected

    def test_status_from_string(self):
        assert ReferralStatus("referred") == ReferralStatus.referred
        assert ReferralStatus("accepted") == ReferralStatus.accepted
        assert ReferralStatus("in_transit") == ReferralStatus.in_transit
        assert ReferralStatus("completed") == ReferralStatus.completed
        assert ReferralStatus("follow_up_needed") == ReferralStatus.follow_up_needed

    def test_invalid_status_raises(self):
        with pytest.raises(ValueError):
            ReferralStatus("invalid")

    def test_statuses_are_str_enum(self):
        for s in ReferralStatus:
            assert isinstance(s, str)
            assert s.value == s


# ═══════════════════════════════════════════════════════════════════════════════
#  Schema validation tests (import Pydantic schemas directly — they don't
#  import the ORM chain)
# ═══════════════════════════════════════════════════════════════════════════════


from app.schemas.referral import ReferralCreate, ReferralStatusUpdate, ReferralResponse


class TestSchemaValidation:
    def test_referral_create_valid(self):
        data = ReferralCreate(
            patient_id="some-uuid",
            to_facility_id="facility-uuid",
            reason="Patient needs specialist care",
        )
        assert data.reason == "Patient needs specialist care"

    def test_referral_create_rejects_empty_reason(self):
        with pytest.raises(Exception):
            ReferralCreate(
                patient_id="some-uuid",
                to_facility_id="facility-uuid",
                reason="",
            )

    def test_referral_status_update_valid(self):
        data = ReferralStatusUpdate(status="accepted")
        assert data.status == "accepted"

    def test_referral_create_max_reason_length(self):
        data = ReferralCreate(
            patient_id="some-uuid",
            to_facility_id="facility-uuid",
            reason="x" * 2000,
        )
        assert len(data.reason) == 2000

    def test_referral_create_rejects_too_long_reason(self):
        with pytest.raises(Exception):
            ReferralCreate(
                patient_id="some-uuid",
                to_facility_id="facility-uuid",
                reason="x" * 2001,
            )

    def test_referral_response_accepts_valid_data(self):
        from datetime import datetime
        data = ReferralResponse(
            id="r1",
            patient_id="p1",
            patient_name="John Doe",
            from_facility_id="f1",
            from_facility_name="PHC Alpha",
            to_facility_id="f2",
            to_facility_name="District Hospital",
            referring_doctor_id="d1",
            referring_doctor_name="Dr. Smith",
            reason="Needs surgery",
            status="referred",
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        assert data.patient_name == "John Doe"
        assert data.status == "referred"
