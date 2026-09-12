"""Triage rule engine — deterministic, explainable urgency scoring.

This module is intentionally free of any database, FastAPI, or framework
imports so that it can be tested in isolation and later swapped for (or
blended with) an ML / LLM-based scorer without touching the API layer.

Public API
----------
SYMPTOM_CHECKLIST : list[SymptomCategory]
    The canonical symptom catalogue, grouped by category.  Served to
    the frontend by GET /api/triage/symptoms.

evaluate(triage_input) -> TriageOutput
    Run all rules, return the highest urgency + every triggered rule's
    explanation.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any


# ═══════════════════════════════════════════════════════════════════════════════
#  Symptom Checklist Configuration
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass(frozen=True)
class SymptomOption:
    """A single selectable symptom."""
    id: str
    label: str
    category: str


@dataclass(frozen=True)
class SymptomCategory:
    """A group of related symptoms under one clinical heading."""
    category: str
    icon: str
    description: str
    symptoms: list[SymptomOption]


SYMPTOM_CHECKLIST: list[SymptomCategory] = [
    # ── 1. Fever ──────────────────────────────────────────────────────────
    SymptomCategory(
        category="fever",
        icon="🤒",
        description="Fever & temperature-related",
        symptoms=[
            SymptomOption("fever_high", "Very high fever (feels burning hot)", "fever"),
            SymptomOption("fever_3days", "Fever lasting more than 3 days", "fever"),
            SymptomOption("fever_rash", "Fever with skin rash", "fever"),
            SymptomOption("fever_chills", "Fever with chills / shivering", "fever"),
        ],
    ),
    # ── 2. Breathing difficulty ───────────────────────────────────────────
    SymptomCategory(
        category="breathing",
        icon="😮‍💨",
        description="Breathing & respiratory problems",
        symptoms=[
            SymptomOption("breathing_rest", "Difficulty breathing even at rest", "breathing"),
            SymptomOption("breathing_exertion", "Difficulty breathing on walking / exertion", "breathing"),
            SymptomOption("breathing_wheezing", "Wheezing or noisy breathing", "breathing"),
            SymptomOption("breathing_chest_tight", "Chest feels tight", "breathing"),
        ],
    ),
    # ── 3. Chest pain ────────────────────────────────────────────────────
    SymptomCategory(
        category="chest_pain",
        icon="💔",
        description="Chest pain or discomfort",
        symptoms=[
            SymptomOption("chest_central", "Pain or pressure in the centre of chest", "chest_pain"),
            SymptomOption("chest_radiating", "Pain spreading to arm, jaw, or back", "chest_pain"),
            SymptomOption("chest_sweating", "Chest pain with sweating or nausea", "chest_pain"),
        ],
    ),
    # ── 4. Severe bleeding ───────────────────────────────────────────────
    SymptomCategory(
        category="bleeding",
        icon="🩸",
        description="Bleeding or wounds",
        symptoms=[
            SymptomOption("bleeding_uncontrolled", "Bleeding that won't stop after 10 min pressure", "bleeding"),
            SymptomOption("bleeding_large_wound", "Large open wound or deep cut", "bleeding"),
            SymptomOption("bleeding_blood_stool", "Blood in stool or vomit", "bleeding"),
            SymptomOption("bleeding_minor", "Minor cut or scrape still oozing", "bleeding"),
        ],
    ),
    # ── 5. Pregnancy danger signs ────────────────────────────────────────
    SymptomCategory(
        category="pregnancy",
        icon="🤰",
        description="Pregnancy-related concerns",
        symptoms=[
            SymptomOption("preg_vaginal_bleeding", "Vaginal bleeding during pregnancy", "pregnancy"),
            SymptomOption("preg_seizures", "Seizures / fits during pregnancy", "pregnancy"),
            SymptomOption("preg_severe_headache", "Severe headache with blurred vision", "pregnancy"),
            SymptomOption("preg_swelling", "Swelling of face / hands / feet", "pregnancy"),
            SymptomOption("preg_reduced_movement", "Baby not moving as usual", "pregnancy"),
        ],
    ),
    # ── 6. Diarrhea / dehydration ────────────────────────────────────────
    SymptomCategory(
        category="diarrhea",
        icon="💧",
        description="Diarrhea, vomiting & dehydration signs",
        symptoms=[
            SymptomOption("diarrhea_watery", "Frequent watery stools", "diarrhea"),
            SymptomOption("diarrhea_bloody", "Blood or mucus in stool", "diarrhea"),
            SymptomOption("dehydration_sunken", "Sunken eyes, very dry mouth", "diarrhea"),
            SymptomOption("dehydration_unable_drink", "Unable to drink or keep fluids down", "diarrhea"),
            SymptomOption("diarrhea_3days", "Diarrhea lasting more than 3 days", "diarrhea"),
        ],
    ),
    # ── 7. Injury / trauma ───────────────────────────────────────────────
    SymptomCategory(
        category="injury",
        icon="🤕",
        description="Injuries, falls & accidents",
        symptoms=[
            SymptomOption("injury_head", "Head injury (fell, hit head, confused)", "injury"),
            SymptomOption("injury_fracture", "Suspected broken bone (deformity, can't move)", "injury"),
            SymptomOption("injury_cant_move", "Cannot move an arm or leg after injury", "injury"),
            SymptomOption("injury_minor", "Minor sprain, bruise, or small cut", "injury"),
        ],
    ),
    # ── 8. Other / general ───────────────────────────────────────────────
    SymptomCategory(
        category="other",
        icon="📝",
        description="Other symptoms (describe below)",
        symptoms=[
            SymptomOption("other_fatigue", "Feeling very weak or tired", "other"),
            SymptomOption("other_weight_loss", "Unexplained weight loss", "other"),
            SymptomOption("other_skin", "Skin rash or unusual skin changes", "other"),
        ],
    ),
]

# Build a fast lookup: symptom_id → SymptomOption
_SYMPTOM_MAP: dict[str, SymptomOption] = {
    s.id: s
    for cat in SYMPTOM_CHECKLIST
    for s in cat.symptoms
}


# ═══════════════════════════════════════════════════════════════════════════════
#  Data structures for input / output
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class VitalsData:
    """Optional vitals supplied by the patient / health worker."""
    temperature: float | None = None
    # Future extensions:
    # bp_systolic: int | None = None
    # bp_diastolic: int | None = None
    # spo2: int | None = None
    # pulse: int | None = None


@dataclass
class TriageInput:
    """Everything the rule engine needs to make a decision."""
    symptom_ids: list[str] = field(default_factory=list)
    free_text: str | None = None
    vitals: VitalsData = field(default_factory=VitalsData)


@dataclass(frozen=True)
class RuleResult:
    """A single rule that fired."""
    rule_id: str
    rule_name: str
    urgency: str          # "red" | "yellow" | "green"
    recommended_action: str
    explanation: str


@dataclass(frozen=True)
class TriageOutput:
    """Aggregated triage verdict."""
    urgency_level: str           # highest urgency among triggered rules
    recommended_action: str      # from the highest-urgency rule
    triggered_rules: list[RuleResult]


# ═══════════════════════════════════════════════════════════════════════════════
#  Rule definitions
# ═══════════════════════════════════════════════════════════════════════════════

# Urgency ordering for comparison
_URGENCY_RANK: dict[str, int] = {"green": 0, "yellow": 1, "red": 2}

# Danger keywords for free-text scanning (English only for now)
_DANGER_KEYWORDS: list[str] = [
    "unconscious", "not breathing", "seizure", "convulsion", "fits",
    "severe bleeding", "bleeding heavily", "snake bite", "snakebite",
    "poisoning", "poison", "suicide", "hanging", "drowning",
    "burn", "electrocution", "collapsed", "unresponsive",
]
_DANGER_PATTERN = re.compile(
    r"\b(" + "|".join(re.escape(kw) for kw in _DANGER_KEYWORDS) + r")\b",
    re.IGNORECASE,
)


def _has(symptom_ids: set[str], *ids: str) -> bool:
    """Check if ANY of the given symptom IDs are present."""
    return bool(symptom_ids & set(ids))


def _has_all(symptom_ids: set[str], *ids: str) -> bool:
    """Check if ALL of the given symptom IDs are present."""
    return set(ids).issubset(symptom_ids)


def _has_category(symptom_ids: set[str], category: str) -> bool:
    """Check if any symptom from the given category is present."""
    return any(
        sid in symptom_ids
        for sid, s in _SYMPTOM_MAP.items()
        if s.category == category
    )


# Each rule is a (metadata_dict, condition_callable) tuple.
# We avoid classes with dynamic method attachment for simplicity.

_RuleDef = tuple[dict[str, str], Any]  # (metadata, condition)

_RULE_DEFS: list[_RuleDef] = [
    # ── Red rules (emergency) ────────────────────────────────────────────
    (
        {
            "rule_id": "R001",
            "rule_name": "High fever emergency",
            "urgency": "red",
            "recommended_action": "Go to nearest health facility immediately. Stay hydrated.",
            "explanation": "Temperature ≥ 39.5°C indicates high-grade fever requiring urgent evaluation.",
        },
        lambda sids, ft, v: v.temperature is not None and v.temperature >= 39.5,
    ),
    (
        {
            "rule_id": "R002",
            "rule_name": "Breathing difficulty at rest",
            "urgency": "red",
            "recommended_action": "This is an emergency — call 108 or go to the nearest hospital immediately.",
            "explanation": "Difficulty breathing even at rest may indicate a serious respiratory or cardiac emergency.",
        },
        lambda sids, ft, v: _has(sids, "breathing_rest"),
    ),
    (
        {
            "rule_id": "R003",
            "rule_name": "Chest pain",
            "urgency": "red",
            "recommended_action": "This is an emergency — call 108 or go to the nearest hospital. Do not exert yourself.",
            "explanation": "Chest pain or pressure may indicate a heart attack or other cardiac emergency.",
        },
        lambda sids, ft, v: _has(sids, "chest_central", "chest_radiating", "chest_sweating"),
    ),
    (
        {
            "rule_id": "R004",
            "rule_name": "Severe or uncontrolled bleeding",
            "urgency": "red",
            "recommended_action": "Apply firm pressure with a clean cloth. Go to the nearest hospital immediately.",
            "explanation": "Uncontrolled bleeding or a large wound requires urgent medical attention.",
        },
        lambda sids, ft, v: _has(sids, "bleeding_uncontrolled", "bleeding_large_wound"),
    ),
    (
        {
            "rule_id": "R005",
            "rule_name": "Pregnancy emergency",
            "urgency": "red",
            "recommended_action": "This is an obstetric emergency — go to the nearest hospital with maternity services NOW.",
            "explanation": (
                "Vaginal bleeding, seizures, or severe headache with vision changes during pregnancy "
                "are danger signs requiring emergency care."
            ),
        },
        lambda sids, ft, v: _has(sids, "preg_vaginal_bleeding", "preg_seizures", "preg_severe_headache"),
    ),
    (
        {
            "rule_id": "R006",
            "rule_name": "Severe dehydration",
            "urgency": "red",
            "recommended_action": "Patient needs IV fluids — go to nearest PHC or CHC immediately. Give ORS sips if conscious.",
            "explanation": (
                "Sunken eyes combined with inability to drink indicates severe dehydration, "
                "which can be life-threatening especially in children."
            ),
        },
        lambda sids, ft, v: _has_all(sids, "dehydration_sunken", "dehydration_unable_drink"),
    ),
    (
        {
            "rule_id": "R007",
            "rule_name": "Head injury or suspected fracture",
            "urgency": "red",
            "recommended_action": "Do not move the affected area. Go to the nearest hospital for X-ray and evaluation.",
            "explanation": "Head injuries and suspected fractures require imaging and urgent medical evaluation.",
        },
        lambda sids, ft, v: _has(sids, "injury_head", "injury_fracture"),
    ),
    (
        {
            "rule_id": "R008",
            "rule_name": "Fever with breathing difficulty",
            "urgency": "red",
            "recommended_action": "Possible respiratory infection or pneumonia — go to nearest facility immediately.",
            "explanation": (
                "Fever combined with breathing difficulty may indicate pneumonia or a serious "
                "respiratory infection requiring urgent treatment."
            ),
        },
        lambda sids, ft, v: (
            _has_category(sids, "fever")
            and _has(sids, "breathing_rest", "breathing_exertion", "breathing_wheezing")
        ),
    ),
    (
        {
            "rule_id": "R009",
            "rule_name": "Danger keywords in description",
            "urgency": "red",
            "recommended_action": "Based on your description, this needs immediate medical attention. Call 108 or go to hospital.",
            "explanation": "Your description mentions a potentially life-threatening situation.",
        },
        lambda sids, ft, v: bool(ft and _DANGER_PATTERN.search(ft)),
    ),
    (
        {
            "rule_id": "R010",
            "rule_name": "Blood in stool or vomit",
            "urgency": "red",
            "recommended_action": "Go to nearest PHC or hospital. This may indicate internal bleeding.",
            "explanation": "Blood in stool or vomit may indicate internal bleeding requiring urgent evaluation.",
        },
        lambda sids, ft, v: _has(sids, "bleeding_blood_stool", "diarrhea_bloody"),
    ),

    # ── Yellow rules (urgent but not emergency) ──────────────────────────

    (
        {
            "rule_id": "R011",
            "rule_name": "Moderate fever",
            "urgency": "yellow",
            "recommended_action": "Visit your nearest PHC or health sub-centre within 24 hours. Take paracetamol and stay hydrated.",
            "explanation": "Temperature between 38°C and 39.4°C indicates moderate fever needing medical evaluation.",
        },
        lambda sids, ft, v: v.temperature is not None and 38.0 <= v.temperature < 39.5,
    ),
    (
        {
            "rule_id": "R012",
            "rule_name": "Breathing difficulty on exertion",
            "urgency": "yellow",
            "recommended_action": "Visit your nearest PHC within 24 hours for evaluation.",
            "explanation": "Breathlessness on exertion (but not at rest) needs medical evaluation but is not an immediate emergency.",
        },
        lambda sids, ft, v: _has(sids, "breathing_exertion") and not _has(sids, "breathing_rest"),
    ),
    (
        {
            "rule_id": "R013",
            "rule_name": "Minor persistent bleeding",
            "urgency": "yellow",
            "recommended_action": "Keep the wound clean and covered. Visit PHC within 24 hours if bleeding continues.",
            "explanation": "Minor bleeding that persists may need stitches or further evaluation.",
        },
        lambda sids, ft, v: _has(sids, "bleeding_minor"),
    ),
    (
        {
            "rule_id": "R014",
            "rule_name": "Pregnancy concern — swelling or reduced movement",
            "urgency": "yellow",
            "recommended_action": "Visit your nearest PHC with maternity services within 24 hours.",
            "explanation": "Swelling or reduced baby movement during pregnancy should be evaluated by a healthcare provider.",
        },
        lambda sids, ft, v: _has(sids, "preg_swelling", "preg_reduced_movement"),
    ),
    (
        {
            "rule_id": "R015",
            "rule_name": "Persistent diarrhea or mild dehydration",
            "urgency": "yellow",
            "recommended_action": "Start ORS immediately. Visit PHC within 24 hours if symptoms persist.",
            "explanation": "Diarrhea lasting more than 3 days or signs of mild dehydration need medical evaluation.",
        },
        lambda sids, ft, v: _has(sids, "diarrhea_3days", "dehydration_sunken", "diarrhea_watery"),
    ),
    (
        {
            "rule_id": "R016",
            "rule_name": "Minor injury",
            "urgency": "yellow",
            "recommended_action": "Rest the injured area. Apply ice if swollen. Visit sub-centre or PHC if pain persists.",
            "explanation": "Minor sprains and injuries usually heal on their own but may need evaluation if persistent.",
        },
        lambda sids, ft, v: _has(sids, "injury_minor", "injury_cant_move"),
    ),
    (
        {
            "rule_id": "R017",
            "rule_name": "Prolonged fever",
            "urgency": "yellow",
            "recommended_action": "Visit PHC within 24 hours — prolonged fever needs blood tests and investigation.",
            "explanation": "Fever lasting more than 3 days may indicate an infection requiring lab tests (malaria, dengue, typhoid, etc.).",
        },
        lambda sids, ft, v: _has(sids, "fever_3days"),
    ),
    (
        {
            "rule_id": "R018",
            "rule_name": "Fever with rash",
            "urgency": "yellow",
            "recommended_action": "Visit PHC within 24 hours — could indicate dengue, measles, or other infection.",
            "explanation": "Fever accompanied by a rash needs evaluation to rule out dengue, measles, chickenpox, or allergic reaction.",
        },
        lambda sids, ft, v: _has(sids, "fever_rash"),
    ),
]


# ═══════════════════════════════════════════════════════════════════════════════
#  Public API
# ═══════════════════════════════════════════════════════════════════════════════

def evaluate(triage_input: TriageInput) -> TriageOutput:
    """Run all rules against the input and return the aggregated triage result.

    The highest-urgency rule determines the overall level.  All triggered
    rules are included in ``triggered_rules`` for full explainability.

    If no rules trigger, the result is green / "visit sub-centre at your
    convenience".
    """
    symptom_ids = set(triage_input.symptom_ids)
    free_text = (triage_input.free_text or "").strip()
    vitals = triage_input.vitals

    triggered: list[RuleResult] = []

    for meta, condition in _RULE_DEFS:
        try:
            if condition(symptom_ids, free_text, vitals):
                triggered.append(RuleResult(**meta))
        except Exception:
            # A malformed rule should never crash the triage — skip it.
            continue

    # ── Escalation rule: ≥ 3 yellow-level triggers → red ─────────────────
    yellow_count = sum(1 for r in triggered if r.urgency == "yellow")
    if yellow_count >= 3 and not any(r.urgency == "red" for r in triggered):
        triggered.append(
            RuleResult(
                rule_id="R_ESC",
                rule_name="Multiple concerning symptoms",
                urgency="red",
                recommended_action=(
                    "You have several concerning symptoms — visit the nearest "
                    "health facility as soon as possible."
                ),
                explanation=(
                    f"{yellow_count} separate yellow-level symptoms detected. "
                    f"Multiple concurrent issues increase overall risk."
                ),
            )
        )

    # ── Determine overall urgency ────────────────────────────────────────
    if not triggered:
        return TriageOutput(
            urgency_level="green",
            recommended_action="Visit your nearest health sub-centre at your convenience.",
            triggered_rules=[
                RuleResult(
                    rule_id="R_DEFAULT",
                    rule_name="No concerning symptoms detected",
                    urgency="green",
                    recommended_action="Visit your nearest health sub-centre at your convenience.",
                    explanation=(
                        "Based on the symptoms you reported, no urgent issues were identified. "
                        "You may still visit a health facility if you feel unwell."
                    ),
                )
            ],
        )

    # Sort by urgency descending for readability (reds first)
    triggered.sort(key=lambda r: _URGENCY_RANK.get(r.urgency, 0), reverse=True)
    top = triggered[0]

    return TriageOutput(
        urgency_level=top.urgency,
        recommended_action=top.recommended_action,
        triggered_rules=triggered,
    )


def get_symptom_checklist() -> list[dict]:
    """Return the symptom checklist as a JSON-serialisable list of dicts.

    Each dict has ``category``, ``icon``, ``description``, and ``symptoms``
    (a list of ``{id, label, category}``).
    """
    return [
        {
            "category": cat.category,
            "icon": cat.icon,
            "description": cat.description,
            "symptoms": [
                {"id": s.id, "label": s.label, "category": s.category}
                for s in cat.symptoms
            ],
        }
        for cat in SYMPTOM_CHECKLIST
    ]
