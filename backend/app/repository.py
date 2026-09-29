"""SQLite persistence for assessments.

Assessments are append-only records: the stored evaluation is exactly what the
engine concluded at the time, together with the ruleset version that produced it.
"""

from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

SCHEMA_VERSION = 1

SCHEMA = """
CREATE TABLE IF NOT EXISTS assessments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    community TEXT NOT NULL CHECK (length(community) BETWEEN 1 AND 120),
    notes TEXT NOT NULL DEFAULT '',
    overall_risk TEXT NOT NULL CHECK (overall_risk IN ('Low', 'Medium', 'High')),
    observations TEXT NOT NULL,
    evaluation TEXT NOT NULL,
    ruleset_version TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_assessments_created_at ON assessments (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_assessments_community ON assessments (community COLLATE NOCASE);
"""


@dataclass(frozen=True)
class AssessmentFilter:
    search: str = ""
    risk: str | None = None
    limit: int = 20
    offset: int = 0


def connect(path: str) -> sqlite3.Connection:
    if path != ":memory:":
        Path(path).parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode = WAL")
    connection.execute("PRAGMA busy_timeout = 5000")
    return connection


def migrate(connection: sqlite3.Connection) -> None:
    (version,) = connection.execute("PRAGMA user_version").fetchone()
    if version >= SCHEMA_VERSION:
        return
    with connection:
        connection.executescript(SCHEMA)
        connection.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")


def _summary(row: sqlite3.Row) -> dict[str, Any]:
    evaluation = json.loads(row["evaluation"])
    return {
        "id": row["id"],
        "community": row["community"],
        "overall_risk": row["overall_risk"],
        "factor_levels": {factor["id"]: factor["level"] for factor in evaluation["factors"]},
        "ruleset_version": row["ruleset_version"],
        "created_at": row["created_at"],
    }


def _detail(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "community": row["community"],
        "notes": row["notes"],
        "observations": json.loads(row["observations"]),
        "evaluation": json.loads(row["evaluation"]),
        "overall_risk": row["overall_risk"],
        "ruleset_version": row["ruleset_version"],
        "created_at": row["created_at"],
    }


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class AssessmentRepository:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self._db = connection

    def create(
        self,
        community: str,
        notes: str,
        observations: dict[str, float],
        evaluation: dict[str, Any],
    ) -> dict[str, Any]:
        created_at = datetime.now(UTC).isoformat(timespec="seconds")
        with self._db:
            cursor = self._db.execute(
                """
                INSERT INTO assessments
                    (community, notes, overall_risk, observations, evaluation,
                     ruleset_version, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    community,
                    notes,
                    evaluation["overall_risk"],
                    json.dumps(observations),
                    json.dumps(evaluation),
                    evaluation["ruleset_version"],
                    created_at,
                ),
            )
        new_id = cursor.lastrowid
        created = self.get(new_id) if new_id is not None else None
        if created is None:
            raise RuntimeError("Assessment was not found after insert")
        return created

    def get(self, assessment_id: int) -> dict[str, Any] | None:
        row = self._db.execute(
            "SELECT * FROM assessments WHERE id = ?", (assessment_id,)
        ).fetchone()
        return _detail(row) if row else None

    def find(self, query: AssessmentFilter) -> tuple[list[dict[str, Any]], int]:
        clauses: list[str] = []
        params: list[Any] = []
        if query.search:
            clauses.append("community LIKE ? ESCAPE '\\'")
            params.append(f"%{_escape_like(query.search)}%")
        if query.risk:
            clauses.append("overall_risk = ?")
            params.append(query.risk)
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""

        (total,) = self._db.execute(f"SELECT COUNT(*) FROM assessments {where}", params).fetchone()
        rows = self._db.execute(
            f"SELECT * FROM assessments {where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?",
            [*params, query.limit, query.offset],
        ).fetchall()
        return [_summary(row) for row in rows], total

    def communities(self) -> list[str]:
        rows = self._db.execute(
            """
            SELECT community FROM assessments
            GROUP BY community COLLATE NOCASE
            ORDER BY MAX(id) DESC
            LIMIT 200
            """
        ).fetchall()
        return [row["community"] for row in rows]
