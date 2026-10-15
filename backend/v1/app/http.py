"""
HTTP request/response types and JSON helpers. Knows about the Lambda Function-URL event
shape so nothing else has to.
"""

import base64
import json
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from typing import Any
from urllib.parse import parse_qsl

from app.core.actor import Actor
from app.core.errors import AppError, ValidationError


def json_default(value: Any) -> Any:
    """Serialise Decimal/date/datetime for JSON responses."""
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, datetime | date):
        return value.isoformat()
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


def dumps(value: Any) -> str:
    return json.dumps(value, default=json_default)


@dataclass
class Request:
    """Normalised inbound request."""

    method: str
    path: str
    query: dict[str, str] = field(default_factory=dict)
    headers: dict[str, str] = field(default_factory=dict)
    raw_body: str = ""
    path_params: dict[str, str] = field(default_factory=dict)
    actor: Actor | None = None

    @classmethod
    def from_lambda_event(cls, event: dict[str, Any]) -> "Request":
        """Build from a Lambda Function URL (payload v2) event."""
        http = event.get("requestContext", {}).get("http", {})
        method = (http.get("method") or event.get("httpMethod") or "GET").upper()
        path = event.get("rawPath") or event.get("path") or "/"
        raw_query = event.get("rawQueryString") or ""
        query = dict(parse_qsl(raw_query, keep_blank_values=True))
        headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
        body = event.get("body") or ""
        if event.get("isBase64Encoded") and body:
            body = base64.b64decode(body).decode()
        return cls(method=method, path=path, query=query, headers=headers, raw_body=body)

    def json(self) -> dict[str, Any]:
        """Parse the body as a JSON object. Empty body -> {}."""
        if not self.raw_body.strip():
            return {}
        try:
            parsed = json.loads(self.raw_body)
        except json.JSONDecodeError as exc:
            raise ValidationError("Request body is not valid JSON") from exc
        if not isinstance(parsed, dict):
            raise ValidationError("Request body must be a JSON object")
        return parsed

    @property
    def require_actor(self) -> Actor:
        """The authenticated actor; handlers on protected routes may assume it exists."""
        if self.actor is None:  # pragma: no cover - router guarantees this on auth routes
            raise AppError("Actor missing on authenticated route")
        return self.actor


@dataclass
class Response:
    """Outbound response. `audit_*` fields let handlers describe the change for the audit log."""

    status: int = 200
    body: Any = None
    headers: dict[str, str] = field(default_factory=dict)
    audit_summary: str | None = None
    audit_entity_id: str | None = None
    audit_project_id: str | None = None
    # Only login sets this: the request had no actor yet, but the audit row should name the user.
    audit_actor: Actor | None = None
    # Replaces the sanitised request body in the audit row (an import must not store its CSV); None keeps the body.
    audit_details: Any = None
    # A dry run changes nothing, so it leaves no audit row even on an audited route.
    audit_skip: bool = False

    def to_lambda(self) -> dict[str, Any]:
        headers = {"Content-Type": "application/json", **self.headers}
        if self.status == 204 or self.body is None:
            return {"statusCode": self.status, "headers": headers, "body": ""}
        return {"statusCode": self.status, "headers": headers, "body": dumps(self.body)}


def ok(body: Any, **audit: Any) -> Response:
    return Response(200, body, **_audit_kwargs(audit))


def created(body: Any, **audit: Any) -> Response:
    return Response(201, body, **_audit_kwargs(audit))


def no_content(**audit: Any) -> Response:
    return Response(204, None, **_audit_kwargs(audit))


def error_response(err: AppError) -> Response:
    return Response(err.status, err.to_body())


def _audit_kwargs(audit: dict[str, Any]) -> dict[str, Any]:
    allowed = {"audit_summary", "audit_entity_id", "audit_project_id", "audit_actor", "audit_details", "audit_skip"}
    unknown = set(audit) - allowed
    if unknown:
        raise TypeError(f"Unknown response options: {sorted(unknown)}")
    return audit
