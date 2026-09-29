"""API error type and the JSON error envelope used by every endpoint.

All errors are returned as ``{"error": {"code", "message", "fields"?}}``.
"""

from __future__ import annotations

import logging

from flask import Flask, jsonify, request
from flask.typing import ResponseReturnValue
from werkzeug.exceptions import HTTPException

logger = logging.getLogger(__name__)


class ApiError(Exception):
    def __init__(
        self,
        status: int,
        code: str,
        message: str,
        fields: dict[str, str] | None = None,
    ) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.fields = fields


class ValidationError(ApiError):
    def __init__(self, fields: dict[str, str]) -> None:
        super().__init__(400, "validation_error", "Some values are missing or invalid.", fields)


def _response(
    status: int, code: str, message: str, fields: dict[str, str] | None = None
) -> ResponseReturnValue:
    body: dict[str, object] = {"code": code, "message": message}
    if fields:
        body["fields"] = fields
    return jsonify(error=body), status


def register_error_handlers(app: Flask) -> None:
    @app.errorhandler(ApiError)
    def handle_api_error(error: ApiError) -> ResponseReturnValue:
        return _response(error.status, error.code, error.message, error.fields)

    @app.errorhandler(HTTPException)
    def handle_http_exception(error: HTTPException) -> ResponseReturnValue:
        # Non-API routes (the SPA) keep Werkzeug's default responses.
        if not request.path.startswith("/api/"):
            return error
        status = error.code or 500
        code = (error.name or "error").lower().replace(" ", "_")
        return _response(status, code, error.description or error.name)

    @app.errorhandler(Exception)
    def handle_unexpected(error: Exception) -> ResponseReturnValue:
        logger.exception("Unhandled error on %s %s", request.method, request.path)
        return _response(500, "internal_error", "Something went wrong on the server.")
