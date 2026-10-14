"""User endpoints (api-contract.md › Users)."""

from app.core.dto import parse
from app.core.paging import parse_page
from app.http import Request, Response, created, ok
from app.users import service
from app.users.schemas import CreateUserRequest, UpdateUserRequest


def list_users(request: Request) -> Response:
    limit, offset = parse_page(request.query)
    return ok(
        service.list_users(
            request.require_actor,
            role=request.query.get("role") or None,
            manager_id=request.query.get("managerId") or None,
            q=request.query.get("q") or None,
            include_inactive=request.query.get("inactive") == "true",
            available_only=request.query.get("available") == "true",
            limit=limit,
            offset=offset,
        )
    )


def create_user(request: Request) -> Response:
    dto = parse(CreateUserRequest, request.json())
    user = service.create_user(request.require_actor, dto)
    return created(
        user,
        audit_summary=f"Created {user['role']} '{user['username']}' ({user['firstName']} {user['lastName']})",
        audit_entity_id=user["id"],
    )


def get_user(request: Request) -> Response:
    return ok(service.get_user(request.require_actor, request.path_params["id"]))


def update_user(request: Request) -> Response:
    dto = parse(UpdateUserRequest, request.json())
    user = service.update_user(request.require_actor, request.path_params["id"], dto)
    changed = ", ".join(sorted(dto.provided()))
    return ok(
        user,
        audit_summary=f"Updated user '{user['username']}' ({changed})",
        audit_entity_id=user["id"],
    )


def get_team(request: Request) -> Response:
    return ok(service.get_team(request.require_actor, request.path_params["id"]))
