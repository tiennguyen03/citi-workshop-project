"""Milestone and goal business rules (requirements M13–M15, D14)."""

from typing import Any

from app.core import permissions
from app.core.actor import Actor
from app.core.errors import Conflict, Forbidden, MilestoneConflict, NotFound, ValidationError
from app.core.ids import new_id
from app.milestones import repository as default_repo
from app.milestones.schemas import (
    STATUS_COMPLETE,
    STATUS_OPEN,
    CreateGoalRequest,
    CreateMilestoneRequest,
    UpdateGoalRequest,
    UpdateMilestoneRequest,
    goal_shape,
    milestone_shape,
)
from app.projects import service as projects
from app.users.schemas import user_summary

# ---- helpers -----------------------------------------------------------------


def _assert_project_writable(project: dict[str, Any]) -> None:
    if project["archived"]:
        raise Conflict("This project is archived")
    if project["status"] == projects.STATUS_COMPLETE:
        raise Conflict("This project is complete")


def _load_milestone(milestone_id: str, repo) -> dict[str, Any]:
    row = repo.find_by_id(milestone_id)
    if row is None:
        raise NotFound("Milestone not found")
    return row


def _assert_dates_within_project(project: dict[str, Any], start, due) -> None:
    if due < start:
        raise ValidationError("dueDate must be on or after startDate", field="dueDate")
    if start < project["start_date"]:
        raise ValidationError("startDate must be on or after the project start date", field="startDate")
    if due > project["end_date"]:
        raise ValidationError("dueDate must be on or before the project end date", field="dueDate")


def _assert_members(project_id: str, user_ids: list[str], repo) -> None:
    members = repo.active_member_ids(project_id)
    outsiders = [u for u in user_ids if u not in members]
    if outsiders:
        raise ValidationError(
            "Assignees must be active members of the project", field="assigneeIds", details={"userIds": outsiders}
        )


def _assert_no_open_conflicts(project_id: str, user_ids: list[str], repo, *, exclude: str | None = None) -> None:
    """M13a: none of `user_ids` may already be on another open milestone of this project."""
    clashes = repo.open_assignments(project_id, user_ids, exclude_milestone_id=exclude)
    if clashes:
        names = ", ".join(sorted({c["milestone_name"] for c in clashes}))
        raise MilestoneConflict(
            f"Some assignees are already on an open milestone ({names}); complete it first",
            {
                "userIds": [c["user_id"] for c in clashes],
                "milestoneId": clashes[0]["milestone_id"],
                "conflicts": [
                    {"userId": c["user_id"], "milestoneId": c["milestone_id"], "milestoneName": c["milestone_name"]}
                    for c in clashes
                ],
            },
        )


def _shape_many(rows: list[dict[str, Any]], repo) -> list[dict[str, Any]]:
    ids = [r["id"] for r in rows]
    assignees = repo.assignees_for(ids)
    goals = repo.goals_for(ids)
    return [milestone_shape(r, assignees[r["id"]], goals[r["id"]]) for r in rows]


def _shape_one(milestone_id: str, repo) -> dict[str, Any]:
    return _shape_many([_load_milestone(milestone_id, repo)], repo)[0]


# ---- read ------------------------------------------------------------------------


def list_milestones(actor: Actor, project_id: str, repo=default_repo) -> list[dict[str, Any]]:
    projects.require_visible(actor, project_id)
    return _shape_many(repo.list_by_project(project_id), repo)


def get_milestone(actor: Actor, milestone_id: str, repo=default_repo) -> dict[str, Any]:
    row = _load_milestone(milestone_id, repo)
    projects.require_visible(actor, row["project_id"])
    return _shape_many([row], repo)[0]


def available_assignees(actor: Actor, project_id: str, milestone_id: str | None, repo=default_repo) -> dict[str, Any]:
    """Members free for a milestone, plus the busy ones with the milestone that holds them (ui-flow F5)."""
    projects.require_manageable(actor, project_id)
    items, busy = [], []
    for row in repo.members_with_open_milestone(project_id):
        free = row["milestone_id"] is None or row["milestone_id"] == milestone_id
        if free:
            items.append(user_summary(row))
        else:
            busy.append(
                {"user": user_summary(row), "milestone": {"id": row["milestone_id"], "name": row["milestone_name"]}}
            )
    return {"items": items, "busy": busy, "total": len(items)}


# ---- milestones (write) ------------------------------------------------------------


def create_milestone(actor: Actor, project_id: str, dto: CreateMilestoneRequest, repo=default_repo) -> dict[str, Any]:
    project = projects.require_manageable(actor, project_id)
    _assert_project_writable(project)
    _assert_dates_within_project(project, dto.start_date, dto.due_date)
    _assert_members(project_id, dto.assignee_ids, repo)
    _assert_no_open_conflicts(project_id, dto.assignee_ids, repo)
    milestone_id = new_id()
    while repo.find_by_id(milestone_id) is not None:  # pragma: no cover - 1 in 10^9
        milestone_id = new_id()
    repo.insert(
        {
            "id": milestone_id,
            "project_id": project_id,
            "name": dto.name,
            "description": dto.description,
            "start_date": dto.start_date,
            "due_date": dto.due_date,
            "sort_order": repo.next_sort_order(project_id),
        }
    )
    repo.replace_assignees(milestone_id, project_id, dto.assignee_ids, is_open=True)
    return _shape_one(milestone_id, repo)


def update_milestone(actor: Actor, milestone_id: str, dto: UpdateMilestoneRequest, repo=default_repo) -> dict[str, Any]:
    milestone = _load_milestone(milestone_id, repo)
    project = projects.require_manageable(actor, milestone["project_id"])
    _assert_project_writable(project)
    fields = dto.provided()
    if not fields:
        raise ValidationError("No fields to update")
    new_assignees = fields.pop("assignee_ids", None)
    start = fields.get("start_date", milestone["start_date"])
    due = fields.get("due_date", milestone["due_date"])
    _assert_dates_within_project(project, start, due)

    if new_assignees is not None:
        current = repo.assignee_ids(milestone_id)
        added = [u for u in new_assignees if u not in current]
        removed = [u for u in current if u not in new_assignees]
        _assert_members(project["id"], added, repo)
        if milestone["status"] == STATUS_OPEN:
            _assert_no_open_conflicts(project["id"], added, repo, exclude=milestone_id)
        repo.replace_assignees(milestone_id, project["id"], new_assignees, is_open=milestone["status"] == STATUS_OPEN)
        repo.unassign_goals(milestone_id, removed)
    repo.update(milestone_id, fields)
    return _shape_one(milestone_id, repo)


def complete_milestone(actor: Actor, milestone_id: str, repo=default_repo) -> dict[str, Any]:
    """Mark complete; assignees become free for the next milestone. Open goals only warn (`details.openGoals`)."""
    milestone = _load_milestone(milestone_id, repo)
    project = projects.require_manageable(actor, milestone["project_id"])
    _assert_project_writable(project)
    if milestone["status"] == STATUS_COMPLETE:
        raise Conflict("This milestone is already complete")
    open_goals = repo.open_goal_count(milestone_id)
    repo.set_status(milestone_id, STATUS_COMPLETE)
    return {**_shape_one(milestone_id, repo), "details": {"openGoals": open_goals}}


def reopen_milestone(actor: Actor, milestone_id: str, repo=default_repo) -> dict[str, Any]:
    milestone = _load_milestone(milestone_id, repo)
    project = projects.require_manageable(actor, milestone["project_id"])
    _assert_project_writable(project)
    if milestone["status"] == STATUS_OPEN:
        raise Conflict("This milestone is already open")
    _assert_no_open_conflicts(project["id"], repo.assignee_ids(milestone_id), repo, exclude=milestone_id)
    repo.set_status(milestone_id, STATUS_OPEN)
    return _shape_one(milestone_id, repo)


# ---- goals -----------------------------------------------------------------------


def _writable_milestone(actor: Actor, milestone: dict[str, Any]) -> dict[str, Any]:
    project = projects.require_manageable(actor, milestone["project_id"])
    _assert_project_writable(project)
    if milestone["status"] == STATUS_COMPLETE:
        raise Conflict("This milestone is complete; reopen it to change its goals")
    return project


def _assert_goal_assignee(milestone_id: str, assignee_id: str | None, repo) -> None:
    if assignee_id is not None and assignee_id not in repo.assignee_ids(milestone_id):
        raise ValidationError("assigneeId must be one of the milestone's assignees", field="assigneeId")


def create_goal(actor: Actor, milestone_id: str, dto: CreateGoalRequest, repo=default_repo) -> dict[str, Any]:
    milestone = _load_milestone(milestone_id, repo)
    _writable_milestone(actor, milestone)
    _assert_goal_assignee(milestone_id, dto.assignee_id, repo)
    goal_id = new_id()
    while repo.find_goal(goal_id) is not None:  # pragma: no cover - 1 in 10^9
        goal_id = new_id()
    repo.insert_goal(goal_id, milestone_id, dto.title, dto.assignee_id)
    return goal_shape(repo.find_goal(goal_id))


def _load_goal(goal_id: str, repo) -> dict[str, Any]:
    goal = repo.find_goal(goal_id)
    if goal is None:
        raise NotFound("Goal not found")
    return goal


def update_goal(actor: Actor, goal_id: str, dto: UpdateGoalRequest, repo=default_repo) -> dict[str, Any]:
    """title/assignee: manager or admin. isDone: additionally the goal's assignee."""
    goal = _load_goal(goal_id, repo)
    fields = dto.provided()
    if not fields:
        raise ValidationError("No fields to update")
    project = projects.load_project(goal["project_id"])
    if set(fields) - {"is_done"}:
        permissions.assert_manages_project(actor, project)
    elif not permissions.can_toggle_goal(actor, goal, project):
        raise Forbidden("Only the goal's assignee, the project manager or an admin can tick this goal")
    _assert_project_writable(project)
    if goal["milestone_status"] == STATUS_COMPLETE:
        raise Conflict("This milestone is complete; reopen it to change its goals")
    if "assignee_id" in fields:
        _assert_goal_assignee(goal["milestone_id"], fields["assignee_id"], repo)
    repo.update_goal(goal_id, fields)
    return goal_shape(repo.find_goal(goal_id))


def delete_goal(actor: Actor, goal_id: str, repo=default_repo) -> dict[str, Any]:
    """Delete a goal. Returns the deleted goal (for the audit summary)."""
    goal = _load_goal(goal_id, repo)
    milestone = _load_milestone(goal["milestone_id"], repo)
    _writable_milestone(actor, milestone)
    repo.delete_goal(goal_id)
    return goal_shape(goal)
