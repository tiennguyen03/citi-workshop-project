"""GET /audit-log (admin)."""

from app.audit_log import service
from app.http import Request, Response, ok


def list_entries(request: Request) -> Response:
    return ok(service.list_entries(request.require_actor, request.query))
