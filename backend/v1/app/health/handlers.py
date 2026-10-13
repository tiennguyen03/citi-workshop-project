"""GET /health — liveness plus a database round-trip."""

import logging

from app.core import db
from app.http import Request, Response

logger = logging.getLogger(__name__)


def get_health(_: Request) -> Response:
    """Report API and database status. 503 if the database is unreachable."""
    try:
        db.query_one("SELECT 1 AS ok")
        return Response(200, {"status": "ok", "db": "ok"})
    except Exception:
        logger.exception("Health check: database unreachable")
        db.reset()
        return Response(503, {"status": "degraded", "db": "error"})
