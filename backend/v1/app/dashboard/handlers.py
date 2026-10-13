"""Dashboard endpoint (api-contract.md › Dashboard)."""

from app.dashboard import service
from app.http import Request, Response, ok


def get_dashboard(request: Request) -> Response:
    return ok(service.get_dashboard(request.require_actor))
