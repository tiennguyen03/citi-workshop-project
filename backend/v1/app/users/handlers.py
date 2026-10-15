"""User endpoints (api-contract.md › Users)."""

from app.core.dto import parse
from app.core.paging import parse_page
from app.http import Request, Response, created, ok
from app.users import service
from app.users.schemas import CreateUserRequest, ImportUsersRequest, UpdateUserRequest


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


def import_users(request: Request) -> Response:
    dto = parse(ImportUsersRequest, request.json())
    report = service.import_users(request.require_actor, dto)
    summary = report["summary"]
    if dto.dry_run:
        return ok(report, audit_skip=True)
    usernames = [row["username"] for row in report["rows"]]
    return ok(
        report,
        audit_summary=f"Imported {summary['created']} user{'s' if summary['created'] != 1 else ''} from a CSV file",
        audit_details={"created": summary["created"], "usernames": usernames},
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
