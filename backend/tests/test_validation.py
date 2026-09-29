from __future__ import annotations

from typing import Any

import pytest

from app.errors import ValidationError
from app.validation import validate_assessment

from .conftest import assessment_payload


def errors_for(payload: Any) -> dict[str, str]:
    with pytest.raises(ValidationError) as caught:
        validate_assessment(payload)
    assert caught.value.fields is not None
    return caught.value.fields


def test_valid_payload_is_normalised() -> None:
    payload = assessment_payload(community="  Prestea   Huni-Valley ", reports=3.0)
    payload["notes"] = "  sampled downstream  "
    data = validate_assessment(payload)
    assert data.community == "Prestea Huni-Valley"
    assert data.notes == "sampled downstream"
    assert data.observations["reports"] == 3
    assert isinstance(data.observations["reports"], int)
    assert isinstance(data.observations["pm25"], float)


def test_notes_are_optional() -> None:
    payload = assessment_payload()
    del payload["notes"]
    assert validate_assessment(payload).notes == ""


def test_body_must_be_an_object() -> None:
    assert errors_for([1, 2]) == {"body": "Request body must be a JSON object."}


def test_every_missing_field_is_reported() -> None:
    errors = errors_for({"community": "", "observations": {}})
    assert errors["community"] == "Enter the community name."
    assert len([key for key in errors if key.startswith("observations.")]) == 11


@pytest.mark.parametrize(
    ("key", "value", "message"),
    [
        ("pm25", "40", "Must be a number."),
        ("pm25", True, "Must be a number."),
        ("pm25", None, "Enter a value."),
        ("pm25", float("nan"), "Must be a finite number."),
        ("pm25", float("inf"), "Must be a finite number."),
        ("reports", 2.5, "Must be a whole number."),
        ("ph", 14.1, "Must be between 0 and 14."),
        ("deforestation", -1, "Must be between 0 and 100."),
        ("turbidity", 10_001, "Must be between 0 and 10,000."),
    ],
)
def test_invalid_indicator_values(key: str, value: Any, message: str) -> None:
    payload = assessment_payload()
    payload["observations"][key] = value
    assert errors_for(payload) == {f"observations.{key}": message}


def test_unknown_indicators_are_rejected() -> None:
    payload = assessment_payload()
    payload["observations"]["DO"] = 5
    assert errors_for(payload) == {"observations.DO": "Unknown indicator."}


def test_text_length_limits() -> None:
    payload = assessment_payload(community="x" * 121)
    payload["notes"] = "y" * 2001
    errors = errors_for(payload)
    assert errors["community"] == "Use 120 characters or fewer."
    assert errors["notes"] == "Use 2000 characters or fewer."
