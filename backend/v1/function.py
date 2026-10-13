"""
Lambda entry point for the Project Tracker API (served at /api/v1).

Keeps zero business logic: converts the Lambda Function-URL event into a Request,
ensures the database schema exists (once per container), dispatches through the
router and converts the Response back into the Lambda response shape.
"""

import logging
import time

from app.core import schema
from app.http import Request
from app.routes import build_router

logger = logging.getLogger()
logger.setLevel(logging.INFO)

_router = build_router()


def handler(event: dict | None = None, context: object | None = None) -> dict:
    """Handle one HTTP request delivered by the Lambda Function URL."""
    request = Request.from_lambda_event(event or {})
    started = time.monotonic()

    schema.ensure()
    response = _router.dispatch(request)

    logger.info(
        "%s %s -> %s (%dms) actor=%s",
        request.method,
        request.path,
        response.status,
        int((time.monotonic() - started) * 1000),
        request.actor.id if request.actor else "-",
    )
    return response.to_lambda()


if __name__ == "__main__":
    print(handler({"rawPath": "/health", "requestContext": {"http": {"method": "GET"}}}))
