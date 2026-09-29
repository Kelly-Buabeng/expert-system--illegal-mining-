"""Validation of assessment input, driven by the indicator definitions."""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

from .engine import INDICATORS, INDICATORS_BY_KEY
from .engine.model import Indicator
from .errors import ValidationError

COMMUNITY_MAX_LENGTH = 120
NOTES_MAX_LENGTH = 2000


@dataclass(frozen=True)
class AssessmentInput:
    community: str
    notes: str
    observations: dict[str, float]


def _format_number(value: float) -> str:
    return f"{value:g}" if isinstance(value, float) else f"{value:,}"


def _validate_indicator(indicator: Indicator, value: Any) -> tuple[float | None, str | None]:
    # bool is a subclass of int in Python; reject it explicitly.
    if value is None or value == "":
        return None, "Enter a value."
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None, "Must be a number."
    if not math.isfinite(value):
        return None, "Must be a finite number."
    if indicator.kind == "integer" and not float(value).is_integer():
        return None, "Must be a whole number."
    if not indicator.minimum <= value <= indicator.maximum:
        return None, (
            f"Must be between {_format_number(indicator.minimum)} "
            f"and {_format_number(indicator.maximum)}."
        )
    return (int(value) if indicator.kind == "integer" else float(value)), None


def validate_assessment(payload: Any) -> AssessmentInput:
    if not isinstance(payload, dict):
        raise ValidationError({"body": "Request body must be a JSON object."})

    errors: dict[str, str] = {}

    community = payload.get("community")
    if not isinstance(community, str) or not community.strip():
        errors["community"] = "Enter the community name."
    elif len(community.strip()) > COMMUNITY_MAX_LENGTH:
        errors["community"] = f"Use {COMMUNITY_MAX_LENGTH} characters or fewer."

    notes = payload.get("notes", "")
    if notes is None:
        notes = ""
    if not isinstance(notes, str):
        errors["notes"] = "Notes must be text."
    elif len(notes.strip()) > NOTES_MAX_LENGTH:
        errors["notes"] = f"Use {NOTES_MAX_LENGTH} characters or fewer."

    raw = payload.get("observations")
    observations: dict[str, float] = {}
    if not isinstance(raw, dict):
        errors["observations"] = "Observations must be an object of indicator values."
    else:
        for key in raw:
            if key not in INDICATORS_BY_KEY:
                errors[f"observations.{key}"] = "Unknown indicator."
        for indicator in INDICATORS:
            value, error = _validate_indicator(indicator, raw.get(indicator.key))
            if error:
                errors[f"observations.{indicator.key}"] = error
            elif value is not None:
                observations[indicator.key] = value

    if errors:
        raise ValidationError(errors)

    # Both are known to be strings once no errors were collected.
    return AssessmentInput(
        community=" ".join(str(community).split()),
        notes=str(notes).strip(),
        observations=observations,
    )
