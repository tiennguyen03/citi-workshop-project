"""Auth endpoints (api-contract.md › Auth)."""

from app.auth import service
from app.auth.schemas import ChangePasswordRequest, LoginRequest
from app.core.actor import Actor
from app.core.dto import parse
from app.http import Request, Response, ok
from app.users.schemas import user_full


def post_login(request: Request) -> Response:
    """POST /auth/login — public."""
    dto = parse(LoginRequest, request.json())
    result = service.login(dto.username, dto.password)
    user = result.user
    return ok(
        {
            "token": result.token,
            "expiresAt": result.expires_at,
            "user": user_full(user, include_salary=True),
        },
        audit_summary=f"User '{user['username']}' logged in",
        audit_entity_id=user["id"],
        audit_actor=Actor(id=user["id"], role=user["role"], manager_id=user["manager_id"]),
    )


def post_change_password(request: Request) -> Response:
    """POST /auth/change-password — the caller changes their own password."""
    dto = parse(ChangePasswordRequest, request.json())
    user = service.change_password(request.require_actor, dto.current_password, dto.new_password)
    return ok(
        {"changed": True},
        audit_summary=f"User '{user['username']}' changed their password",
        audit_entity_id=user["id"],
    )


def get_me(request: Request) -> Response:
    """GET /auth/me — the caller's own full profile (own salary included)."""
    row = service.current_user(request.require_actor)
    return ok(user_full(row, include_salary=True))
