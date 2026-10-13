"""
The route table. Every endpoint in api-contract.md is registered here and nowhere else.

Mutating routes MUST declare `audit=` (enforced by tests/unit/test_routes.py).
"""

from app.auth import handlers as auth
from app.auth.middleware import authenticate
from app.health import handlers as health
from app.router import Router


def build_router() -> Router:
    """Assemble the router with the auth middleware and all feature routes."""
    router = Router(authenticator=authenticate)

    router.add("GET", "/health", health.get_health, auth=False)

    # Auth
    router.add(
        "POST",
        "/auth/login",
        auth.post_login,
        auth=False,
        audit="auth.login",
        audit_on_failure="auth.login_failed",
    )
    router.add("GET", "/auth/me", auth.get_me)

    return router
