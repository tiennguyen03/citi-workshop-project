"""All SQL for `time_entries`. Returns plain dicts; never raises HTTP errors."""

from datetime import date
from decimal import Decimal
from typing import Any

from psycopg import sql

from app.core import db

ENTRY_SELECT = sql.SQL(
    """
    SELECT t.id, t.project_id, t.user_id, t.entry_date, t.hours, t.note, t.created_at,
           u.first_name, u.last_name, u.email, u.job_title, u.role
    FROM time_entries t JOIN users u ON u.id = t.user_id
    {where}
    ORDER BY t.entry_date DESC, t.created_at DESC
    {limit}
    """
)
UPDATABLE_COLUMNS = frozenset({"entry_date", "hours", "note"})


def list_entries(
    project_id: str,
    *,
    user_id: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int | None = None,
    conn=None,
) -> list[dict[str, Any]]:
    clauses = [sql.SQL("t.project_id = %(pid)s")]
    params: dict[str, Any] = {"pid": project_id}
    if user_id:
        clauses.append(sql.SQL("t.user_id = %(uid)s"))
        params["uid"] = user_id
    if date_from:
        clauses.append(sql.SQL("t.entry_date >= %(date_from)s"))
        params["date_from"] = date_from
    if date_to:
        clauses.append(sql.SQL("t.entry_date <= %(date_to)s"))
        params["date_to"] = date_to
    where = sql.SQL("WHERE ") + sql.SQL(" AND ").join(clauses)
    limit_sql = sql.SQL("")
    if limit is not None:
        limit_sql = sql.SQL("LIMIT %(limit)s")
        params["limit"] = limit
    return db.query(ENTRY_SELECT.format(where=where, limit=limit_sql), params, conn=conn)


def find_by_id(entry_id: str, conn=None) -> dict[str, Any] | None:
    rows = db.query(
        ENTRY_SELECT.format(where=sql.SQL("WHERE t.id = %(id)s"), limit=sql.SQL("")), {"id": entry_id}, conn=conn
    )
    return rows[0] if rows else None


def insert(
    entry_id: str, project_id: str, user_id: str, entry_date: date, hours: Decimal, note: str, conn=None
) -> None:
    db.execute(
        "INSERT INTO time_entries (id, project_id, user_id, entry_date, hours, note) VALUES (%s, %s, %s, %s, %s, %s)",
        (entry_id, project_id, user_id, entry_date, hours, note),
        conn=conn,
    )


def update(entry_id: str, fields: dict[str, Any], conn=None) -> None:
    unknown = set(fields) - UPDATABLE_COLUMNS
    if unknown:
        raise ValueError(f"Not updatable: {sorted(unknown)}")
    if not fields:
        return
    assignments = sql.SQL(", ").join(sql.SQL("{} = {}").format(sql.Identifier(c), sql.Placeholder(c)) for c in fields)
    db.execute(
        sql.SQL("UPDATE time_entries SET {a} WHERE id = %(id)s").format(a=assignments),
        {**fields, "id": entry_id},
        conn=conn,
    )


def delete(entry_id: str, conn=None) -> None:
    db.execute("DELETE FROM time_entries WHERE id = %s", (entry_id,), conn=conn)


def hours_in_range(user_ids: list[str], date_from: date, date_to: date, conn=None) -> dict[str, Decimal]:
    """Total hours per user between two dates (inclusive). Users without entries are absent."""
    if not user_ids:
        return {}
    rows = db.query(
        """
        SELECT user_id, COALESCE(SUM(hours), 0) AS hours FROM time_entries
        WHERE user_id = ANY(%s) AND entry_date BETWEEN %s AND %s GROUP BY user_id
        """,
        (user_ids, date_from, date_to),
        conn=conn,
    )
    return {r["user_id"]: r["hours"] for r in rows}
