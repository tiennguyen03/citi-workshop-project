"""SQL for reading `audit_log`. There is deliberately no update or delete function."""

from typing import Any

from psycopg import sql

from app.core import db

# filter key -> parameterised clause; keys are fixed here, values always go through placeholders
FILTER_CLAUSES = {
    "actor_id": sql.SQL("a.actor_id = %(actor_id)s"),
    "entity_type": sql.SQL("a.entity_type = %(entity_type)s"),
    "entity_id": sql.SQL("a.entity_id = %(entity_id)s"),
    "project_id": sql.SQL("a.project_id = %(project_id)s"),
    "action": sql.SQL("a.action = %(action)s"),
    "from_date": sql.SQL("a.occurred_at >= %(from_date)s"),
    "to_date": sql.SQL("a.occurred_at < (%(to_date)s::date + 1)"),
}

SELECT = sql.SQL(
    """
    SELECT a.id, a.occurred_at, a.actor_id, a.actor_role, a.action, a.entity_type, a.entity_id,
           a.project_id, a.summary, a.details, a.status_code,
           u.first_name, u.last_name, u.email, u.job_title, u.role AS user_role
    FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
    {where}
    ORDER BY a.occurred_at DESC, a.id DESC
    LIMIT %(limit)s OFFSET %(offset)s
    """
)
COUNT = sql.SQL("SELECT COUNT(*) AS n FROM audit_log a {where}")


def list_entries(filters: dict[str, Any], *, limit: int, offset: int, conn=None) -> tuple[list[dict[str, Any]], int]:
    active = {k: v for k, v in filters.items() if v}
    clauses = [FILTER_CLAUSES[k] for k in active]
    where = sql.SQL("WHERE ") + sql.SQL(" AND ").join(clauses) if clauses else sql.SQL("")
    params = {**active, "limit": limit, "offset": offset}
    rows = db.query(SELECT.format(where=where), params, conn=conn)
    total = db.query_one(COUNT.format(where=where), params, conn=conn)["n"]
    return rows, total
