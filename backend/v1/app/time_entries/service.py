"""Time entry business rules (requirements M17, M9/M10 inputs)."""

from datetime import date
from typing import Any

from app.core import permissions
from app.core.actor import Actor
from app.core.errors import Conflict, Forbidden, NotFound, ValidationError
from app.core.ids import new_id
from app.core.paging import DEFAULT_LIMIT, page
from app.projects import repository as projects_repo
from app.projects import service as projects
from app.time_entries import repository as default_repo
from app.time_entries.schemas import CreateTimeEntryRequest, UpdateTimeEntryRequest, time_entry_shape

# ---- helpers -----------------------------------------------------------------


def _assert_project_writable(project: dict[str, Any]) -> None:
    if project["archived"]:
        raise Conflict("This project is archived")
    if project["status"] == projects.STATUS_COMPLETE:
        raise Conflict("This project is complete; time can no longer be logged on it")


def _assert_entry_date(project: dict[str, Any], entry_date: date, today: date) -> None:
    if entry_date > today:
        raise ValidationError("entryDate cannot be in the future", field="entryDate")
    if entry_date < project["start_date"] or entry_date > project["end_date"]:
        raise ValidationError("entryDate must fall within the project dates", field="entryDate")


def _parse_date(value: str | None, field: str) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise ValidationError(f"{field} must be a date (YYYY-MM-DD)", field=field) from exc


def _load_entry(entry_id: str, repo) -> dict[str, Any]:
    row = repo.find_by_id(entry_id)
    if row is None:
        raise NotFound("Time entry not found")
    return row


# ---- read ------------------------------------------------------------------------


def list_entries(
    actor: Actor,
    project_id: str,
    *,
    user_id: str | None,
    date_from: str | None,
    date_to: str | None,
    limit: int = DEFAULT_LIMIT,
    offset: int = 0,
    repo=default_repo,
) -> dict[str, Any]:
    """One page of entries. Managers/admins see everyone's (optionally one person's); members see only their own."""
    project = projects.require_visible(actor, project_id)
    if not permissions.manages_project(actor, project):
        user_id = actor.id
    filters = {"user_id": user_id, "date_from": _parse_date(date_from, "from"), "date_to": _parse_date(date_to, "to")}
    rows = repo.list_entries(project_id, **filters, limit=limit, offset=offset)
    total = repo.count_entries(project_id, **filters)
    return page([time_entry_shape(r) for r in rows], total, limit, offset)


# ---- write -----------------------------------------------------------------------


def create_entry(
    actor: Actor,
    project_id: str,
    dto: CreateTimeEntryRequest,
    repo=default_repo,
    members=projects_repo,
    today: date | None = None,
) -> dict[str, Any]:
    project = projects.require_visible(actor, project_id)
    _assert_project_writable(project)
    membership = members.find_member(project_id, actor.id)
    if membership is None or not membership["is_active"]:
        raise Forbidden("Only active members of the project can log time on it")
    _assert_entry_date(project, dto.entry_date, today or date.today())
    entry_id = new_id()
    while repo.find_by_id(entry_id) is not None:  # pragma: no cover - 1 in 10^9
        entry_id = new_id()
    repo.insert(entry_id, project_id, actor.id, dto.entry_date, dto.hours, dto.note)
    return time_entry_shape(repo.find_by_id(entry_id))


def update_entry(
    actor: Actor, entry_id: str, dto: UpdateTimeEntryRequest, repo=default_repo, today: date | None = None
) -> dict[str, Any]:
    entry = _load_entry(entry_id, repo)
    if entry["user_id"] != actor.id:
        raise Forbidden("Only the person who logged the time can edit it")
    project = projects.load_project(entry["project_id"])
    _assert_project_writable(project)
    fields = dto.provided()
    if not fields:
        raise ValidationError("No fields to update")
    if "entry_date" in fields:
        _assert_entry_date(project, fields["entry_date"], today or date.today())
    repo.update(entry_id, fields)
    return time_entry_shape(repo.find_by_id(entry_id))


def delete_entry(actor: Actor, entry_id: str, repo=default_repo) -> dict[str, Any]:
    """Author, project manager or admin. Returns the deleted entry for the audit summary."""
    entry = _load_entry(entry_id, repo)
    project = projects.load_project(entry["project_id"])
    if entry["user_id"] != actor.id and not permissions.manages_project(actor, project):
        raise Forbidden("Only the author, the project manager or an admin can delete this entry")
    _assert_project_writable(project)
    repo.delete(entry_id)
    return time_entry_shape(entry)
