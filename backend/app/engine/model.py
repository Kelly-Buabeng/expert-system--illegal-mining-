"""Building blocks of the knowledge base: indicators, conditions, rules and factors."""

from __future__ import annotations

import operator
from collections.abc import Callable
from dataclasses import dataclass
from enum import IntEnum
from typing import Literal

Operator = Literal[">", ">=", "<", "<="]
Match = Literal["all", "any"]

_COMPARATORS: dict[str, Callable[[float, float], bool]] = {
    ">": operator.gt,
    ">=": operator.ge,
    "<": operator.lt,
    "<=": operator.le,
}


class RiskLevel(IntEnum):
    """Ordered so that the overall risk is simply the maximum factor level."""

    LOW = 1
    MEDIUM = 2
    HIGH = 3

    @property
    def label(self) -> str:
        return self.name.capitalize()

    @classmethod
    def from_label(cls, label: str) -> RiskLevel:
        return cls[label.upper()]


@dataclass(frozen=True)
class Indicator:
    """A single field observation the assessor records."""

    key: str
    label: str
    unit: str
    kind: Literal["integer", "decimal"]
    minimum: float
    maximum: float
    description: str


@dataclass(frozen=True)
class Condition:
    """A threshold comparison on one indicator, e.g. ``turbidity > 100``."""

    indicator: str
    operator: Operator
    threshold: float

    def holds(self, value: float) -> bool:
        return _COMPARATORS[self.operator](value, self.threshold)


@dataclass(frozen=True)
class Rule:
    """IF all/any conditions hold THEN the factor is rated ``conclusion``."""

    id: str
    conclusion: RiskLevel
    conditions: tuple[Condition, ...]
    match: Match = "all"
    note: str = ""


@dataclass(frozen=True)
class Factor:
    """A group of indicators assessed together by an ordered list of rules.

    Rules are tried top to bottom and the first one whose conditions hold decides
    the factor's level (the same semantics as the original if/elif chain).
    """

    id: str
    name: str
    description: str
    indicators: tuple[str, ...]
    rules: tuple[Rule, ...]
    recommendations: dict[RiskLevel, str]
