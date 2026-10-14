"""Project business rules (requirements M5–M12, D9, D15)."""

from decimal import Decimal
from typing import Any

from app.core import permissions
from app.core.actor import ROLE_EMPLOYEE, ROLE_MANAGER, Actor
from app.core.errors import Conflict, Forbidden, NotFound, ProjectConflict, ValidationError
from app.core.ids import new_id
from app.core.paging import DEFAULT_LIMIT, page
from app.milestones import repository as milestones_repo
from app.projects import capacity
from app.projects import repository as default_repo
from app.projects.schemas import (
    STATUS_ACTIVE,
    STATUS_COMPLETE,
    AddMemberRequest,
    CreateProjectRequest,
    UpdateMemberRequest,
    UpdateProjectRequest,
    member_shape,
    project_detail,
    project_summary,
)
from app.users import repository as users_repo
from app.users.schemas import user_summary

RELEASED_REMOVED = "removed"
RELEASED_COMPLETED = "completed"
RELEASED_ARCHIVED = "archived"


# ---- helpers -----------------------------------------------------------------


def _load(project_id: str, repo) -> dict[str, Any]:
    project = repo.find_by_id(project_id)
    if project is None:
        raise NotFound("Project not found")
    return project


def _load_visible(actor: Actor, project_id: str, repo) -> dict[str, Any]:
    """Project the actor may view; archived projects are invisible to non-admins (404, not 403)."""
    project = _load(project_id, repo)
    is_member = repo.has_any_membership(project_id, actor.id)
    if not permissions.can_view_project(actor, project, is_member):
        if project["archived"]:
            raise NotFound("Project not found")
        raise Forbidden("You are not on this project")
    return project


def _assert_writable(project: dict[str, Any]) -> None:
    if project["archived"]:
        raise Conflict("This project is archived")


def _with_capacity(row: dict[str, Any]) -> dict[str, Any]:
    per_member = capacity.capacity_hours_per_member(row["start_date"], row["end_date"])
    return {**row, "capacity_per_member": per_member, "capacity_hours": per_member * Decimal(row["member_count"])}


def _validate_manager(manager_id: str, users=users_repo) -> None:
    manager = users.find_by_id(manager_id)
    if manager is None or manager["role"] != ROLE_MANAGER or not manager["is_active"]:
        raise ValidationError("managerId must reference an active manager", field="managerId")


def _membership_for(actor: Actor, project_id: str, repo) -> dict[str, Any] | None:
    row = repo.find_member(project_id, actor.id)
    if row is None:
        return None
    return {
        "isActive": row["is_active"],
        "hoursAssigned": row["hours_assigned"],
        "hoursCompleted": row["hours_completed"],
        "releasedAt": row["released_at"],
        "releasedReason": row["released_reason"],
    }


# ---- shared with other features (milestones, time entries) ---------------------


def load_project(project_id: str, repo=default_repo) -> dict[str, Any]:
    """Bare project row or 404."""
    return _load(project_id, repo)


def require_visible(actor: Actor, project_id: str, repo=default_repo) -> dict[str, Any]:
    """Project the actor may read (404 for archived-and-hidden, 403 for outsiders)."""
    return _load_visible(actor, project_id, repo)


def require_manageable(actor: Actor, project_id: str, repo=default_repo) -> dict[str, Any]:
    """Project the actor may change: admin or its manager (403 otherwise). Archive/complete checks are the caller's."""
    project = _load(project_id, repo)
    permissions.assert_manages_project(actor, project)
    return project


# ---- read ------------------------------------------------------------------------


def list_projects(
    actor: Actor,
    *,
    archived: str | None,
    status: str | None,
    q: str | None = None,
    limit: int = DEFAULT_LIMIT,
    offset: int = 0,
    repo=default_repo,
) -> dict[str, Any]:
    """One page of the projects the actor may see, with the total that matches."""
    want_archived = archived == "true"
    if want_archived and not actor.is_admin:
        raise Forbidden("Only admins can view archived projects")
    if status and status not in (STATUS_ACTIVE, STATUS_COMPLETE):
        raise ValidationError("status must be 'active' or 'complete'", field="status")
    kwargs: dict[str, Any] = {"archived": want_archived, "status": status, "q": q}
    if actor.is_manager:
        kwargs["manager_id"] = actor.id
    elif actor.is_employee:
        kwargs["member_user_id"] = actor.id
    rows = repo.list_summaries(**kwargs, limit=limit, offset=offset)
    total = repo.count_summaries(**kwargs)
    return page([project_summary(_with_capacity(r)) for r in rows], total, limit, offset)


def get_project(actor: Actor, project_id: str, repo=default_repo) -> dict[str, Any]:
    project = _load_visible(actor, project_id, repo)
    row = _with_capacity(repo.find_summary(project_id))
    return project_detail(
        row,
        include_costs=permissions.can_see_project_costs(actor, project),
        membership=_membership_for(actor, project_id, repo),
    )


def get_stats(actor: Actor, project_id: str, repo=default_repo) -> dict[str, Any]:
    project = _load_visible(actor, project_id, repo)
    row = _with_capacity(repo.find_summary(project_id))
    include_costs = permissions.can_see_project_costs(actor, project)
    per_member = capacity.capacity_hours_per_member(row["start_date"], row["end_date"])
    members = [
        member_shape(m, capacity_per_member=per_member, include_costs=include_costs)
        for m in repo.list_members(project_id, include_released=True)
    ]
    stats = {
        "capacityHours": row["capacity_hours"],
        "hoursAssigned": row["hours_assigned"],
        "hoursCompleted": row["hours_completed"],
        "perMember": members,
        "milestoneCounts": {"open": row["milestones_open"], "complete": row["milestones_complete"]},
    }
    if include_costs:
        stats.update(
            {
                "budget": row["budget"],
                "costConsumed": row["cost_consumed"],
                "budgetRemaining": row["budget"] - row["cost_consumed"],
            }
        )
    return stats


# ---- write -----------------------------------------------------------------------


def create_project(actor: Actor, dto: CreateProjectRequest, repo=default_repo) -> dict[str, Any]:
    permissions.assert_admin(actor)
    _validate_manager(dto.manager_id)
    if repo.name_exists(dto.name):
        raise Conflict("A project with this name already exists", {"field": "name"})
    project_id = new_id()
    while repo.find_by_id(project_id) is not None:  # pragma: no cover - 1 in 10^9
        project_id = new_id()
    repo.insert(
        {
            "id": project_id,
            "name": dto.name,
            "description": dto.description,
            "budget": dto.budget,
            "start_date": dto.start_date,
            "end_date": dto.end_date,
            "manager_id": dto.manager_id,
        }
    )
    return get_project(actor, project_id, repo)


def update_project(actor: Actor, project_id: str, dto: UpdateProjectRequest, repo=default_repo) -> dict[str, Any]:
    project = _load(project_id, repo)
    permissions.assert_manages_project(actor, project)
    _assert_writable(project)
    fields = dto.provided()
    if not fields:
        raise ValidationError("No fields to update")
    if "manager_id" in fields:
        if not actor.is_admin:
            raise Forbidden("Only admins can change a project's manager")
        _validate_manager(fields["manager_id"])
    start = fields.get("start_date", project["start_date"])
    end = fields.get("end_date", project["end_date"])
    if end < start:
        raise ValidationError("endDate must be on or after startDate", field="endDate")
    if "name" in fields and repo.name_exists(fields["name"], exclude_id=project_id):
        raise Conflict("A project with this name already exists", {"field": "name"})
    repo.update(project_id, fields)
    return get_project(actor, project_id, repo)


def complete_project(actor: Actor, project_id: str, repo=default_repo) -> dict[str, Any]:
    project = _load(project_id, repo)
    permissions.assert_manages_project(actor, project)
    _assert_writable(project)
    if project["status"] == STATUS_COMPLETE:
        raise Conflict("This project is already complete")
    summary = repo.find_summary(project_id)
    if summary["milestones_open"] > 0:
        raise Conflict(
            "All milestones must be complete before the project can be completed",
            {"openMilestones": summary["milestones_open"]},
        )
    repo.set_status(project_id, STATUS_COMPLETE)
    repo.release_all(project_id, RELEASED_COMPLETED)
    return get_project(actor, project_id, repo)


def archive_project(actor: Actor, project_id: str, repo=default_repo) -> dict[str, Any]:
    permissions.assert_admin(actor)
    project = _load(project_id, repo)
    if project["archived"]:
        raise Conflict("This project is already archived")
    repo.set_archived(project_id, True)
    repo.release_all(project_id, RELEASED_ARCHIVED)
    return get_project(actor, project_id, repo)


def unarchive_project(actor: Actor, project_id: str, repo=default_repo) -> dict[str, Any]:
    permissions.assert_admin(actor)
    project = _load(project_id, repo)
    if not project["archived"]:
        raise Conflict("This project is not archived")
    if project["status"] == STATUS_ACTIVE:
        # Re-claim the people archiving released, unless they've since joined another project.
        blocked = []
        for user_id in repo.members_released_by(project_id, RELEASED_ARCHIVED):
            elsewhere = repo.active_membership(user_id)
            if elsewhere:
                blocked.append({"userId": user_id, "projectId": elsewhere["id"], "projectName": elsewhere["name"]})
        if blocked:
            raise ProjectConflict(
                "Some members are now on another project; remove them from this project first",
                {"userIds": [b["userId"] for b in blocked], "members": blocked},
            )
        repo.reactivate_released_by(project_id, RELEASED_ARCHIVED)
    repo.set_archived(project_id, False)
    return get_project(actor, project_id, repo)


# ---- members ---------------------------------------------------------------------


def list_members(actor: Actor, project_id: str, *, include_released: bool, repo=default_repo) -> list[dict[str, Any]]:
    project = _load_visible(actor, project_id, repo)
    per_member = capacity.capacity_hours_per_member(project["start_date"], project["end_date"])
    include_costs = permissions.can_see_project_costs(actor, project)
    rows = repo.list_members(project_id, include_released=include_released)
    # the open milestone each active member is on (D14: at most one per project) — shown on the Members tab
    open_ms = milestones_repo.open_assignments(project_id, [r["id"] for r in rows if r["is_active"]])
    current = {m["user_id"]: {"id": m["milestone_id"], "name": m["milestone_name"]} for m in open_ms}
    return [
        member_shape(
            r, capacity_per_member=per_member, include_costs=include_costs, current_milestone=current.get(r["id"])
        )
        for r in rows
    ]


def available_members(actor: Actor, project_id: str, repo=default_repo) -> list[dict[str, Any]]:
    project = _load(project_id, repo)
    permissions.assert_manages_project(actor, project)
    rows = repo.available_employees(manager_id=None if actor.is_admin else actor.id)
    return [user_summary(r) for r in rows]


def _assert_hours_within_capacity(project: dict[str, Any], hours: Decimal) -> None:
    per_member = capacity.capacity_hours_per_member(project["start_date"], project["end_date"])
    if hours > per_member:
        raise ValidationError(
            f"hoursAssigned cannot exceed this project's capacity per member ({per_member} h)",
            field="hoursAssigned",
            details={"capacityPerMember": per_member},
        )


def add_member(
    actor: Actor, project_id: str, dto: AddMemberRequest, repo=default_repo, users=users_repo
) -> dict[str, Any]:
    project = _load(project_id, repo)
    permissions.assert_manages_project(actor, project)
    _assert_writable(project)
    if project["status"] == STATUS_COMPLETE:
        raise Conflict("Cannot add members to a completed project")

    user = users.find_by_id(dto.user_id)
    if user is None or user["role"] != ROLE_EMPLOYEE or not user["is_active"]:
        raise ValidationError("userId must reference an active employee", field="userId")
    if actor.is_manager and user["manager_id"] != actor.id:
        raise Forbidden("Managers can only add their own direct reports")
    _assert_hours_within_capacity(project, dto.hours_assigned)

    existing = repo.find_member(project_id, dto.user_id)
    if existing and existing["is_active"]:
        raise Conflict("This employee is already on the project", {"field": "userId"})
    elsewhere = repo.active_membership(dto.user_id)
    if elsewhere:
        raise ProjectConflict(
            f"{user['first_name']} {user['last_name']} is already on project '{elsewhere['name']}'",
            {"userIds": [dto.user_id], "projectId": elsewhere["id"], "projectName": elsewhere["name"]},
        )
    if existing:
        repo.reactivate_member(project_id, dto.user_id, dto.hours_assigned)
    else:
        repo.insert_member(project_id, dto.user_id, dto.hours_assigned)
    return _member(actor, project, dto.user_id, repo)


def update_member(
    actor: Actor, project_id: str, user_id: str, dto: UpdateMemberRequest, repo=default_repo
) -> dict[str, Any]:
    project = _load(project_id, repo)
    permissions.assert_manages_project(actor, project)
    _assert_writable(project)
    member = repo.find_member(project_id, user_id)
    if member is None or not member["is_active"]:
        raise NotFound("Active member not found on this project")
    _assert_hours_within_capacity(project, dto.hours_assigned)
    repo.update_member_hours(project_id, user_id, dto.hours_assigned)
    return _member(actor, project, user_id, repo)


def remove_member(actor: Actor, project_id: str, user_id: str, repo=default_repo) -> dict[str, Any]:
    """Release a member (row kept for history). Returns the member for the audit summary."""
    project = _load(project_id, repo)
    permissions.assert_manages_project(actor, project)
    _assert_writable(project)
    member = repo.find_member(project_id, user_id)
    if member is None or not member["is_active"]:
        raise NotFound("Active member not found on this project")
    repo.release_member(project_id, user_id, RELEASED_REMOVED)
    return _member(actor, project, user_id, repo)


def _member(actor: Actor, project: dict[str, Any], user_id: str, repo) -> dict[str, Any]:
    per_member = capacity.capacity_hours_per_member(project["start_date"], project["end_date"])
    row = repo.find_member(project["id"], user_id)
    return member_shape(
        row, capacity_per_member=per_member, include_costs=permissions.can_see_project_costs(actor, project)
    )
