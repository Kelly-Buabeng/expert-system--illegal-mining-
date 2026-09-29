"""Expert-system regression tests.

Each case pins INPUT -> RULE THAT FIRES -> LEVEL, and the whole engine is
checked against the original Flask implementation over a grid of inputs.
"""

from __future__ import annotations

import itertools
from typing import Any

import pytest

from app.engine import FACTORS, INDICATORS, RiskLevel, evaluate, evaluation_to_dict
from app.engine.inference import IncompleteRulesError, evaluate_factor
from app.engine.model import Condition, Factor, Rule

from . import legacy_reference as legacy
from .conftest import observations

HIGH, MEDIUM, LOW = RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW


def factor_result(obs: dict[str, float], factor_id: str) -> tuple[str, RiskLevel]:
    result = next(r for r in evaluate(obs).factors if r.factor.id == factor_id)
    return result.fired_rule.id, result.level


# (description, overrides, factor, expected rule, expected level)
FACTOR_CASES: list[tuple[str, dict[str, float], str, str, RiskLevel]] = [
    # Factor 1: deforestation and pollution
    (
        "all land/water limits exceeded, many reports",
        dict(deforestation=85, turbidity=250, heavy_metals=120, soil_erosion=45, reports=12),
        "land_water",
        "R1.1",
        HIGH,
    ),
    (
        "all limits exceeded, exactly 6 reports",
        dict(deforestation=70, turbidity=101, heavy_metals=51, soil_erosion=31, reports=6),
        "land_water",
        "R1.1",
        HIGH,
    ),
    (
        "all limits exceeded, 5 reports",
        dict(deforestation=70, turbidity=101, heavy_metals=51, soil_erosion=31, reports=5),
        "land_water",
        "R1.2",
        MEDIUM,
    ),
    (
        "all limits exceeded, no reports",
        dict(deforestation=95, turbidity=400, heavy_metals=300, soil_erosion=80, reports=0),
        "land_water",
        "R1.2",
        MEDIUM,
    ),
    (
        "everything at the limit",
        dict(deforestation=69.9, turbidity=100, heavy_metals=50, soil_erosion=30, reports=50),
        "land_water",
        "R1.3",
        LOW,
    ),
    ("gap: deforestation only", dict(deforestation=80), "land_water", "R1.4", MEDIUM),
    ("gap: turbidity only", dict(turbidity=150), "land_water", "R1.4", MEDIUM),
    (
        "gap: three of four exceeded with many reports",
        dict(deforestation=90, turbidity=300, heavy_metals=90, reports=40),
        "land_water",
        "R1.4",
        MEDIUM,
    ),
    # Factor 2: pH and dissolved oxygen
    ("acidic and low oxygen", dict(ph=5.8, dissolved_oxygen=3), "water_chemistry", "R2.1", HIGH),
    ("acidic only", dict(ph=6.4), "water_chemistry", "R2.2", MEDIUM),
    ("low oxygen only", dict(dissolved_oxygen=3.9), "water_chemistry", "R2.2", MEDIUM),
    (
        "pH and oxygen at the limit",
        dict(ph=6.5, dissolved_oxygen=4),
        "water_chemistry",
        "R2.3",
        LOW,
    ),
    # Factor 3: biodiversity
    ("biodiversity loss above 50", dict(biodiversity_loss=50.1), "biodiversity", "R3.1", HIGH),
    ("biodiversity loss exactly 50", dict(biodiversity_loss=50), "biodiversity", "R3.2", MEDIUM),
    (
        "biodiversity loss just over 20",
        dict(biodiversity_loss=20.5),
        "biodiversity",
        "R3.2",
        MEDIUM,
    ),
    ("biodiversity loss exactly 20", dict(biodiversity_loss=20), "biodiversity", "R3.3", LOW),
    # Factor 4: air quality
    ("PM2.5 above 150", dict(pm25=151), "air_quality", "R4.1", HIGH),
    ("PM2.5 exactly 150", dict(pm25=150), "air_quality", "R4.2", MEDIUM),
    ("PM2.5 exactly 50", dict(pm25=50), "air_quality", "R4.3", LOW),
    # Factor 5: noise
    ("noise above 85", dict(noise_level=90), "noise", "R5.1", HIGH),
    ("noise exactly 85", dict(noise_level=85), "noise", "R5.2", MEDIUM),
    ("noise exactly 60", dict(noise_level=60), "noise", "R5.3", LOW),
    # Factor 6: community health
    ("11 health reports", dict(health_reports=11), "community_health", "R6.1", HIGH),
    ("10 health reports", dict(health_reports=10), "community_health", "R6.2", MEDIUM),
    ("5 health reports", dict(health_reports=5), "community_health", "R6.3", LOW),
]


@pytest.mark.parametrize(
    ("overrides", "factor_id", "rule_id", "level"),
    [case[1:] for case in FACTOR_CASES],
    ids=[case[0] for case in FACTOR_CASES],
)
def test_factor_rules(
    overrides: dict[str, float], factor_id: str, rule_id: str, level: RiskLevel
) -> None:
    assert factor_result(observations(**overrides), factor_id) == (rule_id, level)


def test_all_indicators_within_limits_is_low_overall() -> None:
    evaluation = evaluate(observations())
    assert evaluation.overall is LOW
    assert all(result.level is LOW for result in evaluation.factors)
    assert len(evaluation.drivers) == len(FACTORS)


def test_overall_is_highest_factor_level() -> None:
    evaluation = evaluate(observations(pm25=80, noise_level=70))
    assert evaluation.overall is MEDIUM
    assert [r.factor.id for r in evaluation.drivers] == ["air_quality", "noise"]

    evaluation = evaluate(observations(pm25=80, health_reports=25))
    assert evaluation.overall is HIGH
    assert [r.factor.id for r in evaluation.drivers] == ["community_health"]


def test_trace_stops_at_first_matching_rule() -> None:
    result = evaluate_factor(FACTORS[1], observations(ph=6.0))  # water chemistry
    assert [trace.rule.id for trace in result.evaluated] == ["R2.1", "R2.2"]
    assert [trace.fired for trace in result.evaluated] == [False, True]
    first = result.evaluated[0].conditions
    assert [(c.condition.indicator, c.observed, c.satisfied) for c in first] == [
        ("ph", 6.0, True),
        ("dissolved_oxygen", 7.5, False),
    ]


def test_factor_without_matching_rule_raises() -> None:
    broken = Factor(
        id="broken",
        name="Broken",
        description="",
        indicators=("pm25",),
        rules=(Rule("X1", HIGH, (Condition("pm25", ">", 100),)),),
        recommendations={HIGH: "", MEDIUM: "", LOW: ""},
    )
    with pytest.raises(IncompleteRulesError):
        evaluate_factor(broken, observations(pm25=10))


def test_serialised_evaluation_is_self_describing() -> None:
    data = evaluation_to_dict(evaluate(observations(deforestation=80)))
    assert data["overall_risk"] == "Medium"
    assert data["drivers"] == ["land_water"]
    land = data["factors"][0]
    assert land["fired_rule"] == "R1.4"
    assert land["recommendation"].startswith("Inspect the site")
    assert [rule["id"] for rule in land["rules"]] == ["R1.1", "R1.2", "R1.3", "R1.4"]
    assert land["rules"][0]["conditions"][0] == {
        "indicator": "deforestation",
        "label": "Deforestation",
        "unit": "%",
        "operator": ">=",
        "threshold": 70,
        "observed": 80,
        "satisfied": True,
    }


def test_every_factor_has_a_recommendation_for_every_level() -> None:
    for factor in FACTORS:
        assert set(factor.recommendations) == set(RiskLevel)


def test_rules_only_reference_their_factor_indicators() -> None:
    known = {indicator.key for indicator in INDICATORS}
    for factor in FACTORS:
        assert set(factor.indicators) <= known
        for rule in factor.rules:
            assert {c.indicator for c in rule.conditions} <= set(factor.indicators)


# Values straddling every threshold used by the rules, plus range extremes.
GRID: dict[str, list[float]] = {
    "deforestation": [0, 69.9, 70, 100],
    "turbidity": [0, 100, 100.5, 10_000],
    "heavy_metals": [0, 50, 51],
    "soil_erosion": [0, 30, 31],
    "reports": [0, 5, 6],
    "ph": [0, 6.4, 6.5, 14],
    "dissolved_oxygen": [0, 3.9, 4, 50],
    "biodiversity_loss": [0, 20, 20.1, 50, 50.1, 100],
    "pm25": [0, 50, 50.1, 150, 150.1],
    "noise_level": [0, 60, 60.1, 85, 85.1],
    "health_reports": [0, 5, 6, 10, 11],
}


def _legacy_levels(obs: dict[str, float]) -> list[Any]:
    return [
        legacy.risk_level(
            obs["deforestation"], obs["turbidity"], obs["heavy_metals"],
            obs["soil_erosion"], obs["reports"],
        ),
        legacy.risk_level_pH_DO(obs["ph"], obs["dissolved_oxygen"]),
        legacy.risk_level_biodiversity(obs["biodiversity_loss"]),
        legacy.risk_level_air_quality(obs["pm25"]),
        legacy.risk_level_noise(obs["noise_level"]),
        legacy.risk_level_health(obs["health_reports"]),
    ]  # fmt: skip


def test_matches_legacy_implementation_across_threshold_grid() -> None:
    """Every factor resolves, and agrees with the original wherever the original resolved."""
    land_keys = ["deforestation", "turbidity", "heavy_metals", "soil_erosion", "reports"]
    compared = gaps = 0
    # Factor 1 needs the full cross product; the single/double-indicator factors
    # are covered by sweeping their own indicators against a baseline.
    for values in itertools.product(*(GRID[k] for k in land_keys)):
        obs = observations(**dict(zip(land_keys, values, strict=True)))
        compared, gaps = _compare(obs, compared, gaps)
    for keys in (["ph", "dissolved_oxygen"], ["biodiversity_loss"], ["pm25"],
                 ["noise_level"], ["health_reports"]):  # fmt: skip
        for values in itertools.product(*(GRID[k] for k in keys)):
            obs = observations(**dict(zip(keys, values, strict=True)))
            compared, gaps = _compare(obs, compared, gaps)
    assert compared > 0 and gaps > 0


def _compare(obs: dict[str, float], compared: int, gaps: int) -> tuple[int, int]:
    evaluation = evaluate(obs)
    expected = _legacy_levels(obs)
    actual = [result.level.label for result in evaluation.factors]
    for factor_result_, legacy_level, level in zip(
        evaluation.factors, expected, actual, strict=True
    ):
        if legacy_level is None:
            # Only the documented R1.4 gap may differ from the original.
            assert factor_result_.fired_rule.id == "R1.4"
            gaps += 1
        else:
            assert level == legacy_level, (obs, factor_result_.factor.id)
            compared += 1
    if None not in expected:
        assert evaluation.overall.label == legacy.overall_risk(expected)
    return compared, gaps
