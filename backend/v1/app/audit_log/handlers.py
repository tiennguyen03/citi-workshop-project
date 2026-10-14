"""GET /audit-log and GET /audit-log/actions (admin)."""

from app.audit_log import service
from app.http import Request, Response, ok


def list_entries(request: Request) -> Response:
    return ok(service.list_entries(request.require_actor, request.query))


def list_actions(request: Request) -> Response:
    return ok(service.list_actions(request.require_actor))
