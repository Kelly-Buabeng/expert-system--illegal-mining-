"""HTTP endpoints under ``/api``."""

from __future__ import annotations

import logging
import sqlite3
from typing import Any

from flask import Blueprint, current_app, g, jsonify, request
from flask.typing import ResponseReturnValue

from .engine import FACTORS, INDICATORS, RULESET_VERSION, RiskLevel, evaluate, evaluation_to_dict
from .errors import ApiError, ValidationError
from .repository import AssessmentFilter, AssessmentRepository, connect
from .validation import validate_assessment

logger = logging.getLogger(__name__)

bp = Blueprint("api", __name__, url_prefix="/api")

MAX_PAGE_SIZE = 100
RISK_LABELS = [level.label for level in RiskLevel]


def get_repository() -> AssessmentRepository:
    if "db" not in g:
        g.db = connect(current_app.config["DATABASE_PATH"])
    return AssessmentRepository(g.db)


@bp.teardown_app_request
def close_db(_exc: BaseException | None) -> None:
    db: sqlite3.Connection | None = g.pop("db", None)
    if db is not None:
        db.close()


def _int_arg(name: str, default: int, minimum: int, maximum: int) -> int:
    raw = request.args.get(name)
    if raw is None or raw == "":
        return default
    try:
        value = int(raw)
    except ValueError:
        raise ValidationError({name: "Must be a whole number."}) from None
    if not minimum <= value <= maximum:
        raise ValidationError({name: f"Must be between {minimum} and {maximum}."})
    return value


def _knowledge_base() -> dict[str, Any]:
    return {
        "ruleset_version": RULESET_VERSION,
        "risk_levels": RISK_LABELS,
        "indicators": [
            {
                "key": i.key,
                "label": i.label,
                "unit": i.unit,
                "kind": i.kind,
                "minimum": i.minimum,
                "maximum": i.maximum,
                "description": i.description,
            }
            for i in INDICATORS
        ],
        "factors": [
            {
                "id": f.id,
                "name": f.name,
                "description": f.description,
                "indicators": list(f.indicators),
                "rules": [
                    {
                        "id": r.id,
                        "conclusion": r.conclusion.label,
                        "match": r.match,
                        "note": r.note,
                        "conditions": [
                            {
                                "indicator": c.indicator,
                                "operator": c.operator,
                                "threshold": c.threshold,
                            }
                            for c in r.conditions
                        ],
                    }
                    for r in f.rules
                ],
                "recommendations": {level.label: f.recommendations[level] for level in RiskLevel},
            }
            for f in FACTORS
        ],
    }


@bp.get("/health")
def health() -> ResponseReturnValue:
    return jsonify(status="ok")


@bp.get("/knowledge-base")
def knowledge_base() -> ResponseReturnValue:
    return jsonify(_knowledge_base())


@bp.post("/assessments")
def create_assessment() -> ResponseReturnValue:
    if not request.is_json:
        raise ApiError(415, "unsupported_media_type", "Send the assessment as application/json.")
    payload = request.get_json(silent=True)
    data = validate_assessment(payload)

    evaluation = evaluation_to_dict(evaluate(data.observations))
    record = get_repository().create(
        community=data.community,
        notes=data.notes,
        observations=data.observations,
        evaluation=evaluation,
    )
    logger.info(
        "Assessment %s recorded for %r: overall risk %s",
        record["id"],
        record["community"],
        record["overall_risk"],
    )
    response = jsonify(record)
    response.status_code = 201
    response.headers["Location"] = f"/api/assessments/{record['id']}"
    return response


@bp.get("/assessments")
def list_assessments() -> ResponseReturnValue:
    risk = request.args.get("risk") or None
    if risk is not None and risk not in RISK_LABELS:
        raise ValidationError({"risk": f"Must be one of {', '.join(RISK_LABELS)}."})
    query = AssessmentFilter(
        search=(request.args.get("q") or "").strip()[:120],
        risk=risk,
        limit=_int_arg("limit", 20, 1, MAX_PAGE_SIZE),
        offset=_int_arg("offset", 0, 0, 10_000_000),
    )
    items, total = get_repository().find(query)
    return jsonify(items=items, total=total, limit=query.limit, offset=query.offset)


@bp.get("/assessments/<int:assessment_id>")
def get_assessment(assessment_id: int) -> ResponseReturnValue:
    record = get_repository().get(assessment_id)
    if record is None:
        raise ApiError(404, "not_found", f"Assessment {assessment_id} does not exist.")
    return jsonify(record)


@bp.get("/communities")
def communities() -> ResponseReturnValue:
    return jsonify(items=get_repository().communities())
