"""Milestone and goal endpoints (api-contract.md › Milestones & goals)."""

from app.core.dto import parse
from app.core.paging import parse_page
from app.http import Request, Response, created, no_content, ok
from app.milestones import service
from app.milestones.schemas import CreateGoalRequest, CreateMilestoneRequest, UpdateGoalRequest, UpdateMilestoneRequest


def _pid(request: Request) -> str:
    return request.path_params["id"]


def list_milestones(request: Request) -> Response:
    limit, offset = parse_page(request.query)
    return ok(service.list_milestones(request.require_actor, _pid(request), limit=limit, offset=offset))


def create_milestone(request: Request) -> Response:
    dto = parse(CreateMilestoneRequest, request.json())
    milestone = service.create_milestone(request.require_actor, _pid(request), dto)
    return created(
        milestone,
        audit_summary=f"Created milestone '{milestone['name']}' ({len(milestone['assignees'])} assignees)",
        audit_entity_id=milestone["id"],
        audit_project_id=milestone["projectId"],
    )


def get_milestone(request: Request) -> Response:
    return ok(service.get_milestone(request.require_actor, _pid(request)))


def update_milestone(request: Request) -> Response:
    dto = parse(UpdateMilestoneRequest, request.json())
    milestone = service.update_milestone(request.require_actor, _pid(request), dto)
    changed = ", ".join(sorted(dto.provided()))
    return ok(
        milestone,
        audit_summary=f"Updated milestone '{milestone['name']}' ({changed})",
        audit_project_id=milestone["projectId"],
    )


def complete_milestone(request: Request) -> Response:
    milestone = service.complete_milestone(request.require_actor, _pid(request))
    open_goals = milestone["details"]["openGoals"]
    note = f" with {open_goals} open goal{'s' if open_goals != 1 else ''}" if open_goals else ""
    return ok(
        milestone,
        audit_summary=f"Completed milestone '{milestone['name']}'{note}",
        audit_project_id=milestone["projectId"],
    )


def reopen_milestone(request: Request) -> Response:
    milestone = service.reopen_milestone(request.require_actor, _pid(request))
    return ok(
        milestone, audit_summary=f"Reopened milestone '{milestone['name']}'", audit_project_id=milestone["projectId"]
    )


def available_assignees(request: Request) -> Response:
    return ok(
        service.available_assignees(request.require_actor, _pid(request), request.query.get("milestoneId") or None)
    )


def create_goal(request: Request) -> Response:
    dto = parse(CreateGoalRequest, request.json())
    goal = service.create_goal(request.require_actor, _pid(request), dto)
    milestone = service.get_milestone(request.require_actor, goal["milestoneId"])
    return created(
        goal,
        audit_summary=f"Added goal '{goal['title']}' to milestone '{milestone['name']}'",
        audit_entity_id=goal["id"],
        audit_project_id=milestone["projectId"],
    )


def update_goal(request: Request) -> Response:
    dto = parse(UpdateGoalRequest, request.json())
    goal = service.update_goal(request.require_actor, _pid(request), dto)
    milestone = service.get_milestone(request.require_actor, goal["milestoneId"])
    fields = dto.provided()
    if set(fields) == {"is_done"}:
        summary = f"{'Completed' if fields['is_done'] else 'Reopened'} goal '{goal['title']}'"
    else:
        summary = f"Updated goal '{goal['title']}' ({', '.join(sorted(fields))})"
    return ok(goal, audit_summary=summary, audit_project_id=milestone["projectId"])


def delete_goal(request: Request) -> Response:
    goal = service.delete_goal(request.require_actor, _pid(request))
    milestone = service.get_milestone(request.require_actor, goal["milestoneId"])
    return no_content(
        audit_summary=f"Deleted goal '{goal['title']}' from milestone '{milestone['name']}'",
        audit_project_id=milestone["projectId"],
    )
