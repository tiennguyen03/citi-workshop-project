"""
Audit trail writer (requirements M19, decisions D13).

Only the router calls `record`. Services never log; routes declare `audit="entity.verb"`.
"""

import json
from typing import Any

import psycopg

from app.core.actor import Actor

# Dropped from stored request bodies: exact matches plus any key containing one of REDACT_SUBSTRINGS.
REDACT_KEYS = frozenset({"token", "authorization"})
REDACT_SUBSTRINGS = ("password", "secret")
MASK_KEYS = frozenset({"salary"})

# action prefix -> entity_type column value
ENTITY_TYPES = {
    "user": "user",
    "project": "project",
    "milestone": "milestone",
    "goal": "goal",
    "time_entry": "time_entry",
}


def sanitize(body: Any) -> Any:
    """Return a copy of a request body safe to store: secrets removed, salary masked."""
    if isinstance(body, dict):
        cleaned: dict[str, Any] = {}
        for key, value in body.items():
            if key in REDACT_KEYS or any(part in key.lower() for part in REDACT_SUBSTRINGS):
                continue
            if key in MASK_KEYS:
                cleaned[key] = "[redacted]"
            else:
                cleaned[key] = sanitize(value)
        return cleaned
    if isinstance(body, list):
        return [sanitize(item) for item in body]
    return body


def entity_type_for(action: str) -> str | None:
    """Derive the entity type from a dotted action name, e.g. `project.archive` -> `project`."""
    prefix = action.split(".", 1)[0]
    return ENTITY_TYPES.get(prefix)


def record(
    conn: psycopg.Connection,
    *,
    action: str,
    actor: Actor | None,
    status_code: int,
    summary: str,
    entity_id: str | None = None,
    project_id: str | None = None,
    details: Any = None,
) -> None:
    """Insert one append-only audit row using the caller's connection/transaction."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO audit_log
                (actor_id, actor_role, action, entity_type, entity_id, project_id, summary, details, status_code)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s)
            """,
            (
                actor.id if actor else None,
                actor.role if actor else None,
                action,
                entity_type_for(action),
                entity_id,
                project_id,
                summary,
                json.dumps(sanitize(details)) if details is not None else None,
                status_code,
            ),
        )
