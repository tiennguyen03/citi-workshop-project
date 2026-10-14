"""Audit log read rules: admin only, bounded page size."""

from typing import Any

from app.audit_log import repository as default_repo
from app.core import permissions
from app.core.actor import Actor
from app.core.errors import ValidationError

MAX_LIMIT = 200
DEFAULT_LIMIT = 50


def entry_shape(row: dict[str, Any]) -> dict[str, Any]:
    """AuditEntry wire shape from an audit_log row joined with the actor's user columns."""
    actor = None
    if row["actor_id"] and row["first_name"]:
        actor = {
            "id": row["actor_id"],
            "firstName": row["first_name"],
            "lastName": row["last_name"],
            "email": row["email"],
            "jobTitle": row["job_title"],
            "role": row["user_role"],
        }
    return {
        "id": row["id"],
        "occurredAt": row["occurred_at"],
        "actor": actor,
        "actorRole": row["actor_role"],
        "action": row["action"],
        "entityType": row["entity_type"],
        "entityId": row["entity_id"],
        "projectId": row["project_id"],
        "summary": row["summary"],
        "details": row["details"],
        "statusCode": row["status_code"],
    }


def _int_param(value: str | None, name: str, default: int, maximum: int | None = None) -> int:
    if value in (None, ""):
        return default
    try:
        number = int(value)
    except ValueError as exc:
        raise ValidationError(f"{name} must be an integer", field=name) from exc
    if number < 0 or (maximum is not None and number > maximum):
        raise ValidationError(f"{name} must be between 0 and {maximum}", field=name)
    return number


def list_entries(actor: Actor, query: dict[str, str], repo=default_repo) -> dict[str, Any]:
    permissions.assert_can_view_audit_log(actor)
    limit = _int_param(query.get("limit"), "limit", DEFAULT_LIMIT, MAX_LIMIT) or DEFAULT_LIMIT
    offset = _int_param(query.get("offset"), "offset", 0)
    filters = {
        "actor_id": query.get("actorId"),
        "entity_type": query.get("entityType"),
        "entity_id": query.get("entityId"),
        "project_id": query.get("projectId"),
        "action": query.get("action"),
        "from_date": query.get("from"),
        "to_date": query.get("to"),
    }
    rows, total = repo.list_entries(filters, limit=limit, offset=offset)
    return {"items": [entry_shape(r) for r in rows], "total": total, "limit": limit, "offset": offset}
