"""Project endpoints (api-contract.md › Projects)."""

from app.core.dto import parse
from app.core.paging import parse_page
from app.http import Request, Response, created, no_content, ok
from app.projects import service
from app.projects.schemas import AddMemberRequest, CreateProjectRequest, UpdateMemberRequest, UpdateProjectRequest


def _pid(request: Request) -> str:
    return request.path_params["id"]


def _name(user: dict) -> str:
    return f"{user['firstName']} {user['lastName']}"


def list_projects(request: Request) -> Response:
    limit, offset = parse_page(request.query)
    return ok(
        service.list_projects(
            request.require_actor,
            archived=request.query.get("archived"),
            status=request.query.get("status") or None,
            q=request.query.get("q") or None,
            limit=limit,
            offset=offset,
        )
    )


def create_project(request: Request) -> Response:
    dto = parse(CreateProjectRequest, request.json())
    project = service.create_project(request.require_actor, dto)
    return created(
        project,
        audit_summary=f"Created project '{project['name']}' (manager {_name(project['manager'])})",
        audit_entity_id=project["id"],
        audit_project_id=project["id"],
    )


def get_project(request: Request) -> Response:
    return ok(service.get_project(request.require_actor, _pid(request)))


def update_project(request: Request) -> Response:
    dto = parse(UpdateProjectRequest, request.json())
    project = service.update_project(request.require_actor, _pid(request), dto)
    changed = ", ".join(sorted(dto.provided()))
    return ok(project, audit_summary=f"Updated project '{project['name']}' ({changed})", audit_project_id=project["id"])


def complete_project(request: Request) -> Response:
    project = service.complete_project(request.require_actor, _pid(request))
    return ok(project, audit_summary=f"Marked project '{project['name']}' complete", audit_project_id=project["id"])


def archive_project(request: Request) -> Response:
    project = service.archive_project(request.require_actor, _pid(request))
    return ok(project, audit_summary=f"Archived project '{project['name']}'", audit_project_id=project["id"])


def unarchive_project(request: Request) -> Response:
    project = service.unarchive_project(request.require_actor, _pid(request))
    return ok(project, audit_summary=f"Unarchived project '{project['name']}'", audit_project_id=project["id"])


def get_stats(request: Request) -> Response:
    return ok(service.get_stats(request.require_actor, _pid(request)))


def list_members(request: Request) -> Response:
    include_released = request.query.get("includeReleased") == "true"
    items = service.list_members(request.require_actor, _pid(request), include_released=include_released)
    return ok({"items": items, "total": len(items)})


def available_members(request: Request) -> Response:
    items = service.available_members(request.require_actor, _pid(request))
    return ok({"items": items, "total": len(items)})


def add_member(request: Request) -> Response:
    dto = parse(AddMemberRequest, request.json())
    member = service.add_member(request.require_actor, _pid(request), dto)
    return created(
        member,
        audit_summary=f"Added {_name(member['user'])} to the project ({member['hoursAssigned']} h assigned)",
        audit_entity_id=member["user"]["id"],
        audit_project_id=_pid(request),
    )


def update_member(request: Request) -> Response:
    dto = parse(UpdateMemberRequest, request.json())
    member = service.update_member(request.require_actor, _pid(request), request.path_params["userId"], dto)
    return ok(
        member,
        audit_summary=f"Set {_name(member['user'])}'s assigned hours to {member['hoursAssigned']} h",
        audit_entity_id=member["user"]["id"],
        audit_project_id=_pid(request),
    )


def remove_member(request: Request) -> Response:
    member = service.remove_member(request.require_actor, _pid(request), request.path_params["userId"])
    return no_content(
        audit_summary=f"Released {_name(member['user'])} from the project",
        audit_entity_id=member["user"]["id"],
        audit_project_id=_pid(request),
    )
