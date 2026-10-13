"""
Route matching, auth middleware, transaction boundary, error mapping and audit hook.

Mutating requests (anything but GET/HEAD/OPTIONS) run inside one database transaction so
the service's writes and the audit row commit — or roll back — together (D13).
"""

import logging
import re
from collections.abc import Callable
from dataclasses import dataclass

from app.core import audit, db
from app.core.errors import AppError, MethodNotAllowed, NotFound, Unauthenticated
from app.core.ids import ID_PATTERN
from app.http import Request, Response, error_response

logger = logging.getLogger(__name__)

Handler = Callable[[Request], Response]
Authenticator = Callable[[Request], object]

PREFIX_RE = re.compile(r"^/api/v1(?=/|$)")
PARAM_RE = re.compile(r"{(\w+)}")
READ_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


@dataclass(frozen=True)
class Route:
    method: str
    pattern: str
    handler: Handler
    regex: re.Pattern[str]
    auth: bool = True
    audit: str | None = None
    audit_on_failure: str | None = None

    @property
    def is_mutating(self) -> bool:
        return self.method not in READ_METHODS


def compile_pattern(pattern: str) -> re.Pattern[str]:
    """Turn `/projects/{id}/members/{userId}` into a regex with named 6-char-ID groups."""
    escaped = re.escape(pattern)
    # re.escape turns `{id}` into `\{id\}`
    regex = re.sub(r"\\{(\w+)\\}", lambda m: f"(?P<{m.group(1)}>{ID_PATTERN})", escaped)
    return re.compile(f"^{regex}/?$")


def normalise_path(path: str) -> str:
    """Strip the optional `/api/v1` prefix (present behind CloudFront, absent behind the proxy)."""
    stripped = PREFIX_RE.sub("", path) or "/"
    return stripped if stripped.startswith("/") else f"/{stripped}"


class Router:
    """Ordered route table with dispatch."""

    def __init__(self, authenticator: Authenticator | None = None):
        self.routes: list[Route] = []
        self.authenticator = authenticator

    def add(
        self,
        method: str,
        pattern: str,
        handler: Handler,
        *,
        auth: bool = True,
        audit: str | None = None,
        audit_on_failure: str | None = None,
    ) -> None:
        self.routes.append(
            Route(method.upper(), pattern, handler, compile_pattern(pattern), auth, audit, audit_on_failure)
        )

    def match(self, method: str, path: str) -> tuple[Route, dict[str, str]]:
        """Find the route for method+path. 404 if no path matches, 405 if only the method differs."""
        path_matched = False
        for route in self.routes:
            m = route.regex.match(path)
            if not m:
                continue
            path_matched = True
            if route.method == method:
                return route, m.groupdict()
        if path_matched:
            raise MethodNotAllowed(f"{method} is not allowed on {path}")
        raise NotFound(f"No route for {path}")

    def dispatch(self, request: Request) -> Response:
        """Run the full pipeline for one request. Never raises."""
        path = normalise_path(request.path)
        route: Route | None = None
        try:
            route, params = self.match(request.method, path)
            request.path_params = params
            if route.auth:
                if self.authenticator is None:
                    raise Unauthenticated("Authentication is not configured")
                request.actor = self.authenticator(request)  # type: ignore[assignment]
            if not route.is_mutating:
                return route.handler(request)
            with db.transaction() as conn:
                response = route.handler(request)
                if route.audit:
                    self._record_audit(conn, route.audit, request, response)
                return response
        except AppError as err:
            if route is not None and route.audit_on_failure and isinstance(err, Unauthenticated):
                self._record_failure(route.audit_on_failure, request, err)
            return error_response(err)
        except Exception:
            logger.exception("Unhandled error on %s %s", request.method, path)
            return error_response(AppError())

    @staticmethod
    def _record_audit(conn, action: str, request: Request, response: Response) -> None:
        entity_id = response.audit_entity_id or next(iter(request.path_params.values()), None)
        summary = response.audit_summary or f"{action} {entity_id or ''}".strip()
        details = _safe_json(request)
        audit.record(
            conn,
            action=action,
            actor=response.audit_actor or request.actor,
            status_code=response.status,
            summary=summary,
            entity_id=entity_id,
            project_id=response.audit_project_id,
            details=details,
        )

    @staticmethod
    def _record_failure(action: str, request: Request, err: AppError) -> None:
        """Audit a failed login in its own transaction (the main one has rolled back)."""
        try:
            with db.transaction() as conn:
                body = _safe_json(request) or {}
                audit.record(
                    conn,
                    action=action,
                    actor=None,
                    status_code=err.status,
                    summary=f"Failed login for '{body.get('username', '?')}'",
                    details=body,
                )
        except Exception:  # pragma: no cover - never let audit failure mask the real error
            logger.exception("Could not record failure audit entry")


def _safe_json(request: Request) -> dict | None:
    try:
        return request.json() or None
    except AppError:
        return None
