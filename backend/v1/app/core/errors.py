"""
Application errors. Services raise these; the router maps them to the JSON error envelope.

Never return error dicts from services — raise one of these instead.
"""

from typing import Any


class AppError(Exception):
    """Base error carrying an HTTP status and a stable machine-readable code."""

    status: int = 500
    code: str = "INTERNAL"

    def __init__(self, message: str = "Internal server error", details: dict[str, Any] | None = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}

    def to_body(self) -> dict[str, Any]:
        """Serialise to the API error envelope."""
        error: dict[str, Any] = {"code": self.code, "message": self.message}
        if self.details:
            error["details"] = self.details
        return {"error": error}


class ValidationError(AppError):
    """400 — malformed input or a violated field/cross-field rule."""

    status = 400
    code = "VALIDATION_ERROR"

    def __init__(self, message: str, field: str | None = None, details: dict[str, Any] | None = None):
        merged = dict(details or {})
        if field:
            merged["field"] = field
        super().__init__(message, merged)


class Unauthenticated(AppError):
    """401 — missing, invalid or expired credentials/token."""

    status = 401
    code = "UNAUTHENTICATED"


class Forbidden(AppError):
    """403 — authenticated but not allowed to perform this action."""

    status = 403
    code = "FORBIDDEN"

    def __init__(self, message: str = "You do not have permission to do that", details=None):
        super().__init__(message, details)


class NotFound(AppError):
    """404 — resource does not exist (or is hidden from this actor)."""

    status = 404
    code = "NOT_FOUND"

    def __init__(self, message: str = "Not found", details=None):
        super().__init__(message, details)


class MethodNotAllowed(AppError):
    """405 — path exists but not for this HTTP method."""

    status = 405
    code = "METHOD_NOT_ALLOWED"


class Conflict(AppError):
    """409 — state conflict (duplicate, archived, already member, …)."""

    status = 409
    code = "CONFLICT"


class ProjectConflict(Conflict):
    """409 — employee is already on another active project (M8 / D15)."""

    code = "PROJECT_CONFLICT"


class MilestoneConflict(Conflict):
    """409 — employee is already on another open milestone in this project (M13a / D14)."""

    code = "MILESTONE_CONFLICT"
