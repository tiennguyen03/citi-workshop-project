"""
All SQL for `projects` and `project_members`. Returns plain dicts; never raises HTTP errors.

Aggregates (member counts, hours, cost) are computed in SQL so list and detail stay cheap.
"""

from datetime import date
from decimal import Decimal
from typing import Any

from psycopg import sql

from app.core import db
from app.projects.capacity import HOURS_PER_YEAR

PROJECT_COLUMNS = (
    "id",
    "name",
    "description",
    "budget",
    "start_date",
    "end_date",
    "manager_id",
    "status",
    "archived",
    "created_at",
    "updated_at",
)
UPDATABLE_COLUMNS = frozenset({"name", "description", "budget", "start_date", "end_date", "manager_id"})
PCOLS = sql.SQL(", ").join(sql.SQL("p.") + sql.Identifier(c) for c in PROJECT_COLUMNS)

# Members that count towards capacity: active ones, or everyone who was on it when it completed.
COUNTED_MEMBER = sql.SQL("(pm.is_active OR pm.released_reason = 'completed')")

SUMMARY_SELECT = sql.SQL(
    """
    SELECT {pcols},
           u.first_name AS manager_first_name, u.last_name AS manager_last_name,
           u.email AS manager_email, u.job_title AS manager_job_title,
           (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id AND {counted}) AS member_count,
           (SELECT COALESCE(SUM(pm.hours_assigned), 0) FROM project_members pm
             WHERE pm.project_id = p.id AND {counted}) AS hours_assigned,
           (SELECT COALESCE(SUM(t.hours), 0) FROM time_entries t WHERE t.project_id = p.id) AS hours_completed,
           (SELECT COALESCE(SUM(t.hours * tu.salary / {hours_per_year}), 0)
              FROM time_entries t JOIN users tu ON tu.id = t.user_id
             WHERE t.project_id = p.id) AS cost_consumed,
           (SELECT COUNT(*) FROM milestones m WHERE m.project_id = p.id AND m.status = 'open') AS milestones_open,
           (SELECT COUNT(*) FROM milestones m
             WHERE m.project_id = p.id AND m.status = 'complete') AS milestones_complete,
           (SELECT MIN(m.due_date) FROM milestones m
             WHERE m.project_id = p.id AND m.status = 'open') AS next_due_date,
           (SELECT COUNT(*) FROM goals g JOIN milestones m ON m.id = g.milestone_id
             WHERE m.project_id = p.id) AS goals_total,
           (SELECT COUNT(*) FROM goals g JOIN milestones m ON m.id = g.milestone_id
             WHERE m.project_id = p.id AND g.is_done) AS goals_done
    FROM projects p JOIN users u ON u.id = p.manager_id
    {where}
    ORDER BY p.archived, p.status, p.start_date DESC, p.name
    {paging}
    """
)


NO_PAGING = sql.SQL("")


def _select(where: sql.Composable, paging: sql.Composable = NO_PAGING) -> sql.Composed:
    return SUMMARY_SELECT.format(
        pcols=PCOLS, counted=COUNTED_MEMBER, hours_per_year=sql.Literal(HOURS_PER_YEAR), where=where, paging=paging
    )


def _filters(
    *,
    archived: bool | None,
    status: str | None,
    manager_id: str | None,
    member_user_id: str | None,
    q: str | None,
) -> tuple[sql.Composable, dict[str, Any]]:
    clauses: list[sql.Composable] = []
    params: dict[str, Any] = {}
    if archived is not None:
        clauses.append(sql.SQL("p.archived = %(archived)s"))
        params["archived"] = archived
    if status:
        clauses.append(sql.SQL("p.status = %(status)s"))
        params["status"] = status
    if manager_id:
        clauses.append(sql.SQL("p.manager_id = %(manager_id)s"))
        params["manager_id"] = manager_id
    if member_user_id:
        clauses.append(
            sql.SQL("EXISTS (SELECT 1 FROM project_members x WHERE x.project_id = p.id AND x.user_id = %(member)s)")
        )
        params["member"] = member_user_id
    if q:
        clauses.append(sql.SQL("(lower(p.name) LIKE %(q)s OR lower(u.first_name || ' ' || u.last_name) LIKE %(q)s)"))
        params["q"] = f"%{q.strip().lower()}%"
    where = sql.SQL("WHERE ") + sql.SQL(" AND ").join(clauses) if clauses else sql.SQL("")
    return where, params


def find_by_id(project_id: str, conn=None) -> dict[str, Any] | None:
    """Bare project row (no aggregates) — for permission checks and updates."""
    cols = sql.SQL(", ").join(sql.Identifier(c) for c in PROJECT_COLUMNS)
    return db.query_one(
        sql.SQL("SELECT {cols} FROM projects WHERE id = %s").format(cols=cols), (project_id,), conn=conn
    )


def find_summary(project_id: str, conn=None) -> dict[str, Any] | None:
    rows = db.query(_select(sql.SQL("WHERE p.id = %(id)s")), {"id": project_id}, conn=conn)
    return rows[0] if rows else None


def list_summaries(
    *,
    archived: bool | None,
    status: str | None,
    manager_id: str | None = None,
    member_user_id: str | None = None,
    q: str | None = None,
    limit: int | None = None,
    offset: int = 0,
    conn=None,
) -> list[dict[str, Any]]:
    """Project summaries, optionally one page of them. `q` searches the name and the manager's name."""
    where, params = _filters(
        archived=archived, status=status, manager_id=manager_id, member_user_id=member_user_id, q=q
    )
    paging = sql.SQL("")
    if limit is not None:
        paging = sql.SQL("LIMIT %(limit)s OFFSET %(offset)s")
        params.update(limit=limit, offset=offset)
    return db.query(_select(where, paging), params, conn=conn)


def count_summaries(
    *,
    archived: bool | None,
    status: str | None,
    manager_id: str | None = None,
    member_user_id: str | None = None,
    q: str | None = None,
    conn=None,
) -> int:
    where, params = _filters(
        archived=archived, status=status, manager_id=manager_id, member_user_id=member_user_id, q=q
    )
    row = db.query_one(
        sql.SQL("SELECT COUNT(*) AS n FROM projects p JOIN users u ON u.id = p.manager_id {where}").format(where=where),
        params,
        conn=conn,
    )
    return int(row["n"])


def name_exists(name: str, exclude_id: str | None = None, conn=None) -> bool:
    row = db.query_one(
        "SELECT 1 AS x FROM projects WHERE lower(name) = lower(%s) AND NOT archived AND id <> COALESCE(%s, '')",
        (name, exclude_id),
        conn=conn,
    )
    return row is not None


def insert(row: dict[str, Any], conn=None) -> None:
    db.execute(
        """
        INSERT INTO projects (id, name, description, budget, start_date, end_date, manager_id)
        VALUES (%(id)s, %(name)s, %(description)s, %(budget)s, %(start_date)s, %(end_date)s, %(manager_id)s)
        """,
        row,
        conn=conn,
    )


def update(project_id: str, fields: dict[str, Any], conn=None) -> None:
    unknown = set(fields) - UPDATABLE_COLUMNS
    if unknown:
        raise ValueError(f"Not updatable: {sorted(unknown)}")
    assignments = sql.SQL(", ").join(sql.SQL("{} = {}").format(sql.Identifier(c), sql.Placeholder(c)) for c in fields)
    db.execute(
        sql.SQL("UPDATE projects SET {a}, updated_at = now() WHERE id = %(id)s").format(a=assignments),
        {**fields, "id": project_id},
        conn=conn,
    )


def set_status(project_id: str, status: str, conn=None) -> None:
    db.execute("UPDATE projects SET status = %s, updated_at = now() WHERE id = %s", (status, project_id), conn=conn)


def set_archived(project_id: str, archived: bool, conn=None) -> None:
    db.execute("UPDATE projects SET archived = %s, updated_at = now() WHERE id = %s", (archived, project_id), conn=conn)


# ---- members ---------------------------------------------------------------

MEMBER_SELECT = sql.SQL(
    """
    SELECT pm.project_id, pm.user_id AS id, pm.hours_assigned, pm.is_active, pm.added_at, pm.released_at,
           pm.released_reason,
           u.first_name, u.last_name, u.email, u.job_title, u.role, u.salary,
           COALESCE((SELECT SUM(t.hours) FROM time_entries t
                      WHERE t.project_id = pm.project_id AND t.user_id = pm.user_id), 0) AS hours_completed,
           COALESCE((SELECT SUM(t.hours) FROM time_entries t
                      WHERE t.project_id = pm.project_id AND t.user_id = pm.user_id), 0)
               * u.salary / {hpy} AS cost_consumed
    FROM project_members pm JOIN users u ON u.id = pm.user_id
    {where}
    ORDER BY pm.is_active DESC, u.last_name, u.first_name
    """
)


def list_members(project_id: str, *, include_released: bool, conn=None) -> list[dict[str, Any]]:
    where = sql.SQL("WHERE pm.project_id = %(pid)s") + (
        sql.SQL("") if include_released else sql.SQL(" AND pm.is_active")
    )
    query = MEMBER_SELECT.format(hpy=sql.Literal(HOURS_PER_YEAR), where=where)
    return db.query(query, {"pid": project_id}, conn=conn)


def find_member(project_id: str, user_id: str, conn=None) -> dict[str, Any] | None:
    where = sql.SQL("WHERE pm.project_id = %(pid)s AND pm.user_id = %(uid)s")
    rows = db.query(
        MEMBER_SELECT.format(hpy=sql.Literal(HOURS_PER_YEAR), where=where),
        {"pid": project_id, "uid": user_id},
        conn=conn,
    )
    return rows[0] if rows else None


def has_any_membership(project_id: str, user_id: str, conn=None) -> bool:
    row = db.query_one(
        "SELECT 1 AS x FROM project_members WHERE project_id = %s AND user_id = %s", (project_id, user_id), conn=conn
    )
    return row is not None


def active_membership(user_id: str, conn=None) -> dict[str, Any] | None:
    """The one active project a user is on, if any (M8)."""
    return db.query_one(
        """
        SELECT p.id, p.name FROM project_members pm JOIN projects p ON p.id = pm.project_id
        WHERE pm.user_id = %s AND pm.is_active
        """,
        (user_id,),
        conn=conn,
    )


def insert_member(project_id: str, user_id: str, hours_assigned: Decimal, conn=None) -> None:
    db.execute(
        "INSERT INTO project_members (project_id, user_id, hours_assigned) VALUES (%s, %s, %s)",
        (project_id, user_id, hours_assigned),
        conn=conn,
    )


def reactivate_member(project_id: str, user_id: str, hours_assigned: Decimal, conn=None) -> None:
    db.execute(
        """
        UPDATE project_members
           SET is_active = TRUE, released_at = NULL, released_reason = NULL, hours_assigned = %s, added_at = now()
         WHERE project_id = %s AND user_id = %s
        """,
        (hours_assigned, project_id, user_id),
        conn=conn,
    )


def update_member_hours(project_id: str, user_id: str, hours_assigned: Decimal, conn=None) -> None:
    db.execute(
        "UPDATE project_members SET hours_assigned = %s WHERE project_id = %s AND user_id = %s",
        (hours_assigned, project_id, user_id),
        conn=conn,
    )


def release_member(project_id: str, user_id: str, reason: str, conn=None) -> None:
    """Release one member and drop them from the project's milestones/goals (M15)."""
    db.execute(
        """
        UPDATE project_members SET is_active = FALSE, released_at = now(), released_reason = %s
         WHERE project_id = %s AND user_id = %s AND is_active
        """,
        (reason, project_id, user_id),
        conn=conn,
    )
    db.execute(
        """
        UPDATE goals SET assignee_id = NULL, updated_at = now()
         WHERE assignee_id = %s AND milestone_id IN (SELECT id FROM milestones WHERE project_id = %s)
        """,
        (user_id, project_id),
        conn=conn,
    )
    db.execute(
        "DELETE FROM milestone_assignees WHERE project_id = %s AND user_id = %s", (project_id, user_id), conn=conn
    )


def release_all(project_id: str, reason: str, conn=None) -> None:
    db.execute(
        """
        UPDATE project_members SET is_active = FALSE, released_at = now(), released_reason = %s
         WHERE project_id = %s AND is_active
        """,
        (reason, project_id),
        conn=conn,
    )


def members_released_by(project_id: str, reason: str, conn=None) -> list[str]:
    rows = db.query(
        "SELECT user_id FROM project_members WHERE project_id = %s AND released_reason = %s",
        (project_id, reason),
        conn=conn,
    )
    return [r["user_id"] for r in rows]


def reactivate_released_by(project_id: str, reason: str, conn=None) -> None:
    db.execute(
        """
        UPDATE project_members SET is_active = TRUE, released_at = NULL, released_reason = NULL
         WHERE project_id = %s AND released_reason = %s
        """,
        (project_id, reason),
        conn=conn,
    )


def available_employees(*, manager_id: str | None, conn=None) -> list[dict[str, Any]]:
    """Active employees with no active project membership, optionally limited to one manager's reports."""
    clauses = [
        sql.SQL("u.role = 'employee'"),
        sql.SQL("u.is_active"),
        sql.SQL("NOT EXISTS (SELECT 1 FROM project_members pm WHERE pm.user_id = u.id AND pm.is_active)"),
    ]
    params: dict[str, Any] = {}
    if manager_id:
        clauses.append(sql.SQL("u.manager_id = %(manager_id)s"))
        params["manager_id"] = manager_id
    query = sql.SQL(
        "SELECT u.id, u.first_name, u.last_name, u.email, u.job_title, u.role, u.manager_id "
        "FROM users u WHERE {w} ORDER BY u.last_name, u.first_name"
    ).format(w=sql.SQL(" AND ").join(clauses))
    return db.query(query, params, conn=conn)


def capacity_inputs(project_id: str, conn=None) -> tuple[date, date] | None:
    row = db.query_one("SELECT start_date, end_date FROM projects WHERE id = %s", (project_id,), conn=conn)
    return (row["start_date"], row["end_date"]) if row else None
