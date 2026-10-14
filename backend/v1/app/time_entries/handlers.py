"""Time entry endpoints (api-contract.md › Time entries)."""

from decimal import Decimal

from app.core.dto import parse
from app.core.paging import parse_page
from app.http import Request, Response, created, no_content, ok
from app.time_entries import service
from app.time_entries.schemas import CreateTimeEntryRequest, UpdateTimeEntryRequest


def _name(user: dict) -> str:
    return f"{user['firstName']} {user['lastName']}"


def _hours(value) -> str:
    """7.50 -> "7.5", 8.00 -> "8"."""
    return f"{Decimal(value).normalize():f}"


def list_entries(request: Request) -> Response:
    limit, offset = parse_page(request.query)
    return ok(
        service.list_entries(
            request.require_actor,
            request.path_params["id"],
            user_id=request.query.get("userId") or None,
            date_from=request.query.get("from") or None,
            date_to=request.query.get("to") or None,
            limit=limit,
            offset=offset,
        )
    )


def create_entry(request: Request) -> Response:
    dto = parse(CreateTimeEntryRequest, request.json())
    entry = service.create_entry(request.require_actor, request.path_params["id"], dto)
    return created(
        entry,
        audit_summary=f"{_name(entry['user'])} logged {_hours(entry['hours'])} h on {entry['entryDate']}",
        audit_entity_id=entry["id"],
        audit_project_id=entry["projectId"],
    )


def update_entry(request: Request) -> Response:
    dto = parse(UpdateTimeEntryRequest, request.json())
    entry = service.update_entry(request.require_actor, request.path_params["id"], dto)
    changed = ", ".join(sorted(dto.provided()))
    return ok(
        entry,
        audit_summary=(
            f"{_name(entry['user'])} changed a time entry ({changed}): "
            f"now {_hours(entry['hours'])} h on {entry['entryDate']}"
        ),
        audit_project_id=entry["projectId"],
    )


def delete_entry(request: Request) -> Response:
    entry = service.delete_entry(request.require_actor, request.path_params["id"])
    return no_content(
        audit_summary=(
            f"Deleted {_name(entry['user'])}'s time entry of {_hours(entry['hours'])} h on {entry['entryDate']}"
        ),
        audit_project_id=entry["projectId"],
    )
