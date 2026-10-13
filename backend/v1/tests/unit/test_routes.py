"""Structural guarantees over the route table (D13: every mutating route is audited)."""

from app.routes import build_router


def test_every_mutating_route_declares_audit():
    router = build_router()
    missing = [f"{r.method} {r.pattern}" for r in router.routes if r.is_mutating and not r.audit]
    assert missing == [], f"Mutating routes without audit declaration: {missing}"


def test_only_login_and_health_are_public():
    router = build_router()
    public = sorted(f"{r.method} {r.pattern}" for r in router.routes if not r.auth)
    assert set(public) <= {"GET /health", "POST /auth/login"}
