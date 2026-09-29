"""Flask application factory."""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

from flask import Flask, send_from_directory
from flask.typing import ResponseReturnValue
from werkzeug.exceptions import NotFound

from . import api
from .errors import register_error_handlers
from .repository import connect, migrate

BACKEND_ROOT = Path(__file__).resolve().parent.parent


def _config_from_env() -> dict[str, Any]:
    return {
        "DATABASE_PATH": os.environ.get(
            "DATABASE_PATH", str(BACKEND_ROOT / "instance" / "assessments.db")
        ),
        "FRONTEND_DIST": os.environ.get("FRONTEND_DIST", ""),
        "LOG_LEVEL": os.environ.get("LOG_LEVEL", "INFO").upper(),
    }


def create_app(overrides: dict[str, Any] | None = None) -> Flask:
    app = Flask(__name__)
    app.config.update(_config_from_env())
    app.config["MAX_CONTENT_LENGTH"] = 64 * 1024
    app.json.sort_keys = False  # type: ignore[attr-defined]
    if overrides:
        app.config.update(overrides)

    logging.basicConfig(
        level=app.config["LOG_LEVEL"],
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    connection = connect(app.config["DATABASE_PATH"])
    try:
        migrate(connection)
    finally:
        connection.close()

    register_error_handlers(app)
    app.register_blueprint(api.bp)

    if app.config["FRONTEND_DIST"]:
        _serve_frontend(app, Path(app.config["FRONTEND_DIST"]).resolve())

    return app


def _serve_frontend(app: Flask, dist: Path) -> None:
    """Serve the built single-page app, falling back to index.html for client routes."""
    if not (dist / "index.html").is_file():
        raise RuntimeError(f"FRONTEND_DIST={dist} does not contain index.html")

    @app.get("/", defaults={"path": ""})
    @app.get("/<path:path>")
    def frontend(path: str) -> ResponseReturnValue:
        if path.startswith("api/"):
            raise NotFound()
        if path and (dist / path).is_file():
            return send_from_directory(dist, path)
        return send_from_directory(dist, "index.html")
