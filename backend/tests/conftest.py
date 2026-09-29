from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from flask import Flask
from flask.testing import FlaskClient

from app import create_app

# All indicators within limits: every factor is Low.
BASELINE: dict[str, float] = {
    "deforestation": 10,
    "turbidity": 20,
    "heavy_metals": 5,
    "soil_erosion": 5,
    "reports": 0,
    "ph": 7.2,
    "dissolved_oxygen": 7.5,
    "biodiversity_loss": 5,
    "pm25": 20,
    "noise_level": 45,
    "health_reports": 1,
}


def observations(**overrides: float) -> dict[str, float]:
    return {**BASELINE, **overrides}


def assessment_payload(community: str = "Tarkwa", **overrides: Any) -> dict[str, Any]:
    return {"community": community, "notes": "", "observations": observations(**overrides)}


@pytest.fixture
def app(tmp_path: Path) -> Iterator[Flask]:
    yield create_app({"DATABASE_PATH": str(tmp_path / "test.db"), "LOG_LEVEL": "WARNING"})


@pytest.fixture
def client(app: Flask) -> FlaskClient:
    return app.test_client()
