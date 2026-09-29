"""Forward evaluation of the knowledge base against a set of observations.

Pipeline: observations -> each factor's rules tried in order (first match wins)
-> factor level -> overall level = highest factor level. Every comparison made
along the way is recorded so the result can explain itself.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from .knowledge_base import FACTORS, INDICATORS_BY_KEY, RULESET_VERSION
from .model import Condition, Factor, RiskLevel, Rule

Observations = Mapping[str, float]


class IncompleteRulesError(RuntimeError):
    """Raised when no rule in a factor matches: a defect in the knowledge base."""


@dataclass(frozen=True)
class ConditionTrace:
    condition: Condition
    observed: float
    satisfied: bool


@dataclass(frozen=True)
class RuleTrace:
    rule: Rule
    conditions: tuple[ConditionTrace, ...]
    fired: bool


@dataclass(frozen=True)
class FactorResult:
    factor: Factor
    level: RiskLevel
    fired_rule: Rule
    evaluated: tuple[RuleTrace, ...]

    @property
    def recommendation(self) -> str:
        return self.factor.recommendations[self.level]


@dataclass(frozen=True)
class Evaluation:
    overall: RiskLevel
    factors: tuple[FactorResult, ...]
    ruleset_version: str

    @property
    def drivers(self) -> tuple[FactorResult, ...]:
        """Factors whose level determined the overall level."""
        return tuple(result for result in self.factors if result.level == self.overall)


def evaluate_rule(rule: Rule, observations: Observations) -> RuleTrace:
    traces = tuple(
        ConditionTrace(
            condition=condition,
            observed=observations[condition.indicator],
            satisfied=condition.holds(observations[condition.indicator]),
        )
        for condition in rule.conditions
    )
    outcomes = [trace.satisfied for trace in traces]
    fired = all(outcomes) if rule.match == "all" else any(outcomes)
    return RuleTrace(rule=rule, conditions=traces, fired=fired)


def evaluate_factor(factor: Factor, observations: Observations) -> FactorResult:
    evaluated: list[RuleTrace] = []
    for rule in factor.rules:
        trace = evaluate_rule(rule, observations)
        evaluated.append(trace)
        if trace.fired:
            return FactorResult(
                factor=factor,
                level=rule.conclusion,
                fired_rule=rule,
                evaluated=tuple(evaluated),
            )
    raise IncompleteRulesError(f"No rule in factor {factor.id!r} matched the observations")


def evaluate(observations: Observations, factors: Sequence[Factor] = FACTORS) -> Evaluation:
    """Evaluate validated observations. Every indicator used by ``factors`` must be present."""
    results = tuple(evaluate_factor(factor, observations) for factor in factors)
    overall = max(result.level for result in results)
    return Evaluation(overall=overall, factors=results, ruleset_version=RULESET_VERSION)


def _condition_to_dict(trace: ConditionTrace) -> dict[str, Any]:
    indicator = INDICATORS_BY_KEY[trace.condition.indicator]
    return {
        "indicator": indicator.key,
        "label": indicator.label,
        "unit": indicator.unit,
        "operator": trace.condition.operator,
        "threshold": trace.condition.threshold,
        "observed": trace.observed,
        "satisfied": trace.satisfied,
    }


def evaluation_to_dict(evaluation: Evaluation) -> dict[str, Any]:
    """Self-describing JSON form of an evaluation, persisted alongside each assessment."""
    return {
        "overall_risk": evaluation.overall.label,
        "ruleset_version": evaluation.ruleset_version,
        "drivers": [result.factor.id for result in evaluation.drivers],
        "factors": [
            {
                "id": result.factor.id,
                "name": result.factor.name,
                "level": result.level.label,
                "fired_rule": result.fired_rule.id,
                "recommendation": result.recommendation,
                "rules": [
                    {
                        "id": trace.rule.id,
                        "conclusion": trace.rule.conclusion.label,
                        "match": trace.rule.match,
                        "fired": trace.fired,
                        "conditions": [_condition_to_dict(c) for c in trace.conditions],
                    }
                    for trace in result.evaluated
                ],
            }
            for result in evaluation.factors
        ],
    }
