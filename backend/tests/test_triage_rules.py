"""Unit tests for the triage rule engine.

These test the pure rule engine in isolation — no database, no API.
"""

from __future__ import annotations

import pytest

from app.services.triage_rules import (
    TriageInput,
    TriageOutput,
    VitalsData,
    evaluate,
    get_symptom_checklist,
)


# ═══════════════════════════════════════════════════════════════════════════════
#  Helpers
# ═══════════════════════════════════════════════════════════════════════════════

def _eval(
    symptoms: list[str] | None = None,
    free_text: str | None = None,
    temperature: float | None = None,
) -> TriageOutput:
    """Convenience wrapper around evaluate()."""
    return evaluate(
        TriageInput(
            symptom_ids=symptoms or [],
            free_text=free_text,
            vitals=VitalsData(temperature=temperature),
        )
    )


def _has_rule(output: TriageOutput, rule_id: str) -> bool:
    """Check if a specific rule fired."""
    return any(r.rule_id == rule_id for r in output.triggered_rules)


# ═══════════════════════════════════════════════════════════════════════════════
#  Symptom checklist tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestSymptomChecklist:
    def test_returns_list_of_categories(self):
        checklist = get_symptom_checklist()
        assert isinstance(checklist, list)
        assert len(checklist) == 8

    def test_each_category_has_required_fields(self):
        for cat in get_symptom_checklist():
            assert "category" in cat
            assert "icon" in cat
            assert "description" in cat
            assert "symptoms" in cat
            assert isinstance(cat["symptoms"], list)
            assert len(cat["symptoms"]) > 0

    def test_symptom_ids_are_unique(self):
        ids = [
            s["id"]
            for cat in get_symptom_checklist()
            for s in cat["symptoms"]
        ]
        assert len(ids) == len(set(ids)), f"Duplicate symptom IDs: {[x for x in ids if ids.count(x) > 1]}"

    def test_eight_categories(self):
        categories = [cat["category"] for cat in get_symptom_checklist()]
        expected = ["fever", "breathing", "chest_pain", "bleeding", "pregnancy", "diarrhea", "injury", "other"]
        assert categories == expected


# ═══════════════════════════════════════════════════════════════════════════════
#  Default / green tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestGreenDefault:
    def test_empty_input_is_green(self):
        result = _eval()
        assert result.urgency_level == "green"
        assert _has_rule(result, "R_DEFAULT")

    def test_no_symptoms_no_vitals(self):
        result = _eval(symptoms=[])
        assert result.urgency_level == "green"

    def test_unknown_symptom_ids_are_green(self):
        result = _eval(symptoms=["nonexistent_symptom_xyz"])
        assert result.urgency_level == "green"

    def test_green_has_recommended_action(self):
        result = _eval()
        assert result.recommended_action
        assert "sub-centre" in result.recommended_action.lower()


# ═══════════════════════════════════════════════════════════════════════════════
#  Red rules tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestRedRules:
    def test_r001_high_fever(self):
        result = _eval(temperature=39.5)
        assert result.urgency_level == "red"
        assert _has_rule(result, "R001")

    def test_r001_very_high_fever(self):
        result = _eval(temperature=41.0)
        assert result.urgency_level == "red"
        assert _has_rule(result, "R001")

    def test_r002_breathing_at_rest(self):
        result = _eval(symptoms=["breathing_rest"])
        assert result.urgency_level == "red"
        assert _has_rule(result, "R002")

    def test_r003_chest_pain_central(self):
        result = _eval(symptoms=["chest_central"])
        assert result.urgency_level == "red"
        assert _has_rule(result, "R003")

    def test_r003_chest_pain_radiating(self):
        result = _eval(symptoms=["chest_radiating"])
        assert result.urgency_level == "red"
        assert _has_rule(result, "R003")

    def test_r004_severe_bleeding(self):
        result = _eval(symptoms=["bleeding_uncontrolled"])
        assert result.urgency_level == "red"
        assert _has_rule(result, "R004")

    def test_r004_large_wound(self):
        result = _eval(symptoms=["bleeding_large_wound"])
        assert result.urgency_level == "red"
        assert _has_rule(result, "R004")

    def test_r005_pregnancy_vaginal_bleeding(self):
        result = _eval(symptoms=["preg_vaginal_bleeding"])
        assert result.urgency_level == "red"
        assert _has_rule(result, "R005")

    def test_r005_pregnancy_seizures(self):
        result = _eval(symptoms=["preg_seizures"])
        assert result.urgency_level == "red"
        assert _has_rule(result, "R005")

    def test_r006_severe_dehydration(self):
        result = _eval(symptoms=["dehydration_sunken", "dehydration_unable_drink"])
        assert result.urgency_level == "red"
        assert _has_rule(result, "R006")

    def test_r006_requires_both_symptoms(self):
        """Sunken eyes alone should NOT trigger R006."""
        result = _eval(symptoms=["dehydration_sunken"])
        assert not _has_rule(result, "R006")

    def test_r007_head_injury(self):
        result = _eval(symptoms=["injury_head"])
        assert result.urgency_level == "red"
        assert _has_rule(result, "R007")

    def test_r007_fracture(self):
        result = _eval(symptoms=["injury_fracture"])
        assert result.urgency_level == "red"
        assert _has_rule(result, "R007")

    def test_r008_fever_plus_breathing(self):
        result = _eval(symptoms=["fever_high", "breathing_exertion"])
        assert result.urgency_level == "red"
        assert _has_rule(result, "R008")

    def test_r009_danger_keyword_unconscious(self):
        result = _eval(free_text="The patient is unconscious and not responding")
        assert result.urgency_level == "red"
        assert _has_rule(result, "R009")

    def test_r009_danger_keyword_seizure(self):
        result = _eval(free_text="Having a seizure right now")
        assert result.urgency_level == "red"
        assert _has_rule(result, "R009")

    def test_r009_danger_keyword_snake_bite(self):
        result = _eval(free_text="snake bite on the leg about 20 minutes ago")
        assert result.urgency_level == "red"
        assert _has_rule(result, "R009")

    def test_r009_case_insensitive(self):
        result = _eval(free_text="Patient is UNCONSCIOUS")
        assert _has_rule(result, "R009")

    def test_r010_blood_in_stool(self):
        result = _eval(symptoms=["bleeding_blood_stool"])
        assert result.urgency_level == "red"
        assert _has_rule(result, "R010")

    def test_r010_diarrhea_bloody(self):
        result = _eval(symptoms=["diarrhea_bloody"])
        assert result.urgency_level == "red"
        assert _has_rule(result, "R010")


# ═══════════════════════════════════════════════════════════════════════════════
#  Yellow rules tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestYellowRules:
    def test_r011_moderate_fever(self):
        result = _eval(temperature=38.5)
        assert result.urgency_level == "yellow"
        assert _has_rule(result, "R011")

    def test_r011_lower_boundary(self):
        result = _eval(temperature=38.0)
        assert _has_rule(result, "R011")

    def test_r011_not_triggered_below_38(self):
        result = _eval(temperature=37.5)
        assert not _has_rule(result, "R011")

    def test_r012_breathing_on_exertion(self):
        result = _eval(symptoms=["breathing_exertion"])
        assert result.urgency_level == "yellow"
        assert _has_rule(result, "R012")

    def test_r012_not_triggered_with_rest_breathing(self):
        """If breathing_rest is present, R002 (red) fires but R012 should NOT."""
        result = _eval(symptoms=["breathing_rest", "breathing_exertion"])
        assert not _has_rule(result, "R012")  # R002 wins

    def test_r013_minor_bleeding(self):
        result = _eval(symptoms=["bleeding_minor"])
        assert _has_rule(result, "R013")

    def test_r014_pregnancy_swelling(self):
        result = _eval(symptoms=["preg_swelling"])
        assert _has_rule(result, "R014")

    def test_r015_diarrhea_watery(self):
        result = _eval(symptoms=["diarrhea_watery"])
        assert _has_rule(result, "R015")

    def test_r016_minor_injury(self):
        result = _eval(symptoms=["injury_minor"])
        assert _has_rule(result, "R016")

    def test_r017_prolonged_fever(self):
        result = _eval(symptoms=["fever_3days"])
        assert _has_rule(result, "R017")

    def test_r018_fever_with_rash(self):
        result = _eval(symptoms=["fever_rash"])
        assert _has_rule(result, "R018")


# ═══════════════════════════════════════════════════════════════════════════════
#  Escalation rule tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestEscalation:
    def test_three_yellow_symptoms_escalate_to_red(self):
        """≥ 3 yellow-only triggers should escalate to red."""
        result = _eval(symptoms=["bleeding_minor", "injury_minor", "fever_3days"])
        assert result.urgency_level == "red"
        assert _has_rule(result, "R_ESC")

    def test_two_yellow_stays_yellow(self):
        result = _eval(symptoms=["bleeding_minor", "fever_3days"])
        assert result.urgency_level == "yellow"
        assert not _has_rule(result, "R_ESC")

    def test_no_escalation_when_red_already_present(self):
        """If a red rule already fires, escalation is redundant."""
        result = _eval(symptoms=["chest_central", "bleeding_minor", "fever_3days", "injury_minor"])
        # R003 (chest pain) is red — escalation should not add R_ESC
        assert _has_rule(result, "R003")
        assert not _has_rule(result, "R_ESC")


# ═══════════════════════════════════════════════════════════════════════════════
#  Aggregation & explainability tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestAggregation:
    def test_multiple_rules_can_fire(self):
        """Multiple symptoms should trigger multiple rules."""
        result = _eval(symptoms=["chest_central", "breathing_rest"])
        triggered_ids = {r.rule_id for r in result.triggered_rules}
        assert "R002" in triggered_ids
        assert "R003" in triggered_ids

    def test_red_wins_over_yellow(self):
        result = _eval(symptoms=["chest_central", "bleeding_minor"])
        assert result.urgency_level == "red"

    def test_triggered_rules_sorted_by_urgency(self):
        result = _eval(symptoms=["chest_central", "bleeding_minor"])
        urgencies = [r.urgency for r in result.triggered_rules]
        # Reds should come first
        assert urgencies[0] == "red"

    def test_all_triggered_rules_have_explanation(self):
        result = _eval(symptoms=["fever_high", "breathing_rest", "bleeding_minor"])
        for rule in result.triggered_rules:
            assert rule.explanation
            assert rule.rule_id
            assert rule.rule_name
            assert rule.recommended_action

    def test_recommended_action_from_top_rule(self):
        """Recommended action should come from the highest-urgency rule."""
        result = _eval(symptoms=["chest_central"])
        assert result.recommended_action == result.triggered_rules[0].recommended_action


# ═══════════════════════════════════════════════════════════════════════════════
#  Edge cases
# ═══════════════════════════════════════════════════════════════════════════════

class TestEdgeCases:
    def test_free_text_without_danger_words_is_green(self):
        result = _eval(free_text="I have a mild headache since yesterday")
        assert result.urgency_level == "green"

    def test_empty_free_text(self):
        result = _eval(free_text="")
        assert result.urgency_level == "green"

    def test_none_free_text(self):
        result = _eval(free_text=None)
        assert result.urgency_level == "green"

    def test_vitals_only_yellow(self):
        """Temperature alone (moderate) should give yellow."""
        result = _eval(temperature=38.8)
        assert result.urgency_level == "yellow"

    def test_vitals_only_red(self):
        """Temperature alone (very high) should give red."""
        result = _eval(temperature=40.0)
        assert result.urgency_level == "red"

    def test_normal_temperature_no_effect(self):
        result = _eval(temperature=36.8)
        assert result.urgency_level == "green"

    def test_combination_fever_and_breathing_and_vitals(self):
        """Fever symptom + breathing symptom + high temp should trigger multiple red rules."""
        result = _eval(
            symptoms=["fever_high", "breathing_rest"],
            temperature=39.5,
        )
        assert result.urgency_level == "red"
        triggered_ids = {r.rule_id for r in result.triggered_rules}
        assert "R001" in triggered_ids  # high fever vitals
        assert "R002" in triggered_ids  # breathing at rest
        assert "R008" in triggered_ids  # fever + breathing combo
