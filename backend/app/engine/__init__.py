"""Deterministic rule engine for illegal-mining pollution risk."""

from .inference import Evaluation, evaluate, evaluation_to_dict
from .knowledge_base import FACTORS, INDICATORS, INDICATORS_BY_KEY, RULESET_VERSION
from .model import RiskLevel

__all__ = [
    "FACTORS",
    "INDICATORS",
    "INDICATORS_BY_KEY",
    "RULESET_VERSION",
    "Evaluation",
    "RiskLevel",
    "evaluate",
    "evaluation_to_dict",
]
