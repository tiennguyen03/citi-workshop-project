"""All SQL for `milestones`, `milestone_assignees` and `goals`. Returns plain dicts; never raises HTTP errors."""

from typing import Any

from psycopg import sql

from app.core import db

MILESTONE_SELECT = sql.SQL(
    """
    SELECT m.id, m.project_id, m.name, m.description, m.start_date, m.due_date, m.status, m.completed_at,
           m.sort_order, m.created_at, m.updated_at,
           m.blocked_by_id, b.name AS blocked_by_name, b.status AS blocked_by_status,
           (SELECT COUNT(*) FROM goals g WHERE g.milestone_id = m.id) AS goals_total,
           (SELECT COUNT(*) FROM goals g WHERE g.milestone_id = m.id AND g.is_done) AS goals_done
    FROM milestones m LEFT JOIN milestones b ON b.id = m.blocked_by_id
    {where}
    ORDER BY {order}
    {paging}
    """
)
# the reading order of a project's milestones (D23/D28): open ones first, soonest due first; completed ones after,
# most recently completed first. The same order the UI used to apply in memory, now applied where the page is cut.
PROJECT_ORDER = sql.SQL(
    "(m.status <> 'open'), CASE WHEN m.status = 'open' THEN m.due_date END, m.completed_at DESC, m.sort_order, m.name"
)
DEFAULT_ORDER = sql.SQL("m.sort_order, m.start_date, m.name")
NO_PAGING = sql.SQL("")
UPDATABLE_COLUMNS = frozenset({"name", "description", "start_date", "due_date", "blocked_by_id"})

USER_COLS = sql.SQL("u.id, u.first_name, u.last_name, u.email, u.job_title, u.role")


# ---- milestones -------------------------------------------------------------


def list_by_project(project_id: str, *, limit: int | None = None, offset: int = 0, conn=None) -> list[dict[str, Any]]:
    paging = sql.SQL("LIMIT %(limit)s OFFSET %(offset)s") if limit is not None else NO_PAGING
    return db.query(
        MILESTONE_SELECT.format(where=sql.SQL("WHERE m.project_id = %(pid)s"), order=PROJECT_ORDER, paging=paging),
        {"pid": project_id, "limit": limit, "offset": offset},
        conn=conn,
    )


def dependants(milestone_id: str, conn=None) -> list[dict[str, Any]]:
    """Milestones that wait on this one, with their state (D29)."""
    return db.query(
        "SELECT id, name, status FROM milestones WHERE blocked_by_id = %s ORDER BY due_date, name",
        (milestone_id,),
        conn=conn,
    )


def count_by_project(project_id: str, conn=None) -> int:
    return db.query_one("SELECT COUNT(*) AS n FROM milestones WHERE project_id = %s", (project_id,), conn=conn)["n"]


def next_due_id(project_id: str, conn=None) -> str | None:
    """The open milestone due soonest, whichever page it sits on."""
    row = db.query_one(
        "SELECT id FROM milestones WHERE project_id = %s AND status = 'open' "
        "ORDER BY due_date, sort_order, name LIMIT 1",
        (project_id,),
        conn=conn,
    )
    return row["id"] if row else None


def find_by_id(milestone_id: str, conn=None) -> dict[str, Any] | None:
    rows = db.query(
        MILESTONE_SELECT.format(where=sql.SQL("WHERE m.id = %(id)s"), order=DEFAULT_ORDER, paging=NO_PAGING),
        {"id": milestone_id},
        conn=conn,
    )
    return rows[0] if rows else None


def next_sort_order(project_id: str, conn=None) -> int:
    row = db.query_one(
        "SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM milestones WHERE project_id = %s", (project_id,), conn=conn
    )
    return int(row["n"])


def insert(row: dict[str, Any], conn=None) -> None:
    db.execute(
        """
        INSERT INTO milestones (id, project_id, name, description, start_date, due_date, sort_order, blocked_by_id)
        VALUES (%(id)s, %(project_id)s, %(name)s, %(description)s, %(start_date)s, %(due_date)s, %(sort_order)s,
                %(blocked_by_id)s)
        """,
        row,
        conn=conn,
    )


def update(milestone_id: str, fields: dict[str, Any], conn=None) -> None:
    unknown = set(fields) - UPDATABLE_COLUMNS
    if unknown:
        raise ValueError(f"Not updatable: {sorted(unknown)}")
    if not fields:
        return
    assignments = sql.SQL(", ").join(sql.SQL("{} = {}").format(sql.Identifier(c), sql.Placeholder(c)) for c in fields)
    db.execute(
        sql.SQL("UPDATE milestones SET {a}, updated_at = now() WHERE id = %(id)s").format(a=assignments),
        {**fields, "id": milestone_id},
        conn=conn,
    )


def set_status(milestone_id: str, status: str, conn=None) -> None:
    """Flip open/complete and keep `milestone_assignees.is_open` in sync (D14)."""
    is_open = status == "open"
    db.execute(
        """
        UPDATE milestones SET status = %s, completed_at = CASE WHEN %s THEN NULL ELSE now() END, updated_at = now()
         WHERE id = %s
        """,
        (status, is_open, milestone_id),
        conn=conn,
    )
    db.execute(
        "UPDATE milestone_assignees SET is_open = %s WHERE milestone_id = %s", (is_open, milestone_id), conn=conn
    )


# ---- assignees --------------------------------------------------------------


def assignees_for(milestone_ids: list[str], conn=None) -> dict[str, list[dict[str, Any]]]:
    """Assignee user rows grouped by milestone id."""
    grouped: dict[str, list[dict[str, Any]]] = {mid: [] for mid in milestone_ids}
    if not milestone_ids:
        return grouped
    rows = db.query(
        sql.SQL(
            """
            SELECT ma.milestone_id, {cols}
            FROM milestone_assignees ma JOIN users u ON u.id = ma.user_id
            WHERE ma.milestone_id = ANY(%s)
            ORDER BY u.last_name, u.first_name
            """
        ).format(cols=USER_COLS),
        (milestone_ids,),
        conn=conn,
    )
    for row in rows:
        grouped[row["milestone_id"]].append(row)
    return grouped


def assignee_ids(milestone_id: str, conn=None) -> list[str]:
    rows = db.query("SELECT user_id FROM milestone_assignees WHERE milestone_id = %s", (milestone_id,), conn=conn)
    return [r["user_id"] for r in rows]


def replace_assignees(milestone_id: str, project_id: str, user_ids: list[str], is_open: bool, conn=None) -> None:
    db.execute("DELETE FROM milestone_assignees WHERE milestone_id = %s", (milestone_id,), conn=conn)
    for user_id in user_ids:
        db.execute(
            "INSERT INTO milestone_assignees (milestone_id, user_id, project_id, is_open) VALUES (%s, %s, %s, %s)",
            (milestone_id, user_id, project_id, is_open),
            conn=conn,
        )


def open_assignments(
    project_id: str, user_ids: list[str], exclude_milestone_id: str | None = None, conn=None
) -> list[dict[str, Any]]:
    """Open-milestone assignments in this project for the given users (the M13a rule)."""
    if not user_ids:
        return []
    return db.query(
        """
        SELECT ma.user_id, ma.milestone_id, m.name AS milestone_name
        FROM milestone_assignees ma JOIN milestones m ON m.id = ma.milestone_id
        WHERE ma.project_id = %s AND ma.is_open AND ma.user_id = ANY(%s) AND ma.milestone_id <> COALESCE(%s, '')
        ORDER BY ma.user_id
        """,
        (project_id, user_ids, exclude_milestone_id),
        conn=conn,
    )


def open_assignments_for_users(user_ids: list[str], conn=None) -> dict[str, dict[str, Any]]:
    """The open milestone each user is on, across projects (at most one per user: D14 + D15)."""
    if not user_ids:
        return {}
    rows = db.query(
        """
        SELECT ma.user_id, ma.milestone_id, m.name AS milestone_name
        FROM milestone_assignees ma JOIN milestones m ON m.id = ma.milestone_id
        JOIN projects p ON p.id = ma.project_id
        WHERE ma.is_open AND ma.user_id = ANY(%s) AND NOT p.archived AND p.status = 'active'
        """,
        (user_ids,),
        conn=conn,
    )
    return {r["user_id"]: {"id": r["milestone_id"], "name": r["milestone_name"]} for r in rows}


def active_member_ids(project_id: str, conn=None) -> set[str]:
    rows = db.query("SELECT user_id FROM project_members WHERE project_id = %s AND is_active", (project_id,), conn=conn)
    return {r["user_id"] for r in rows}


def members_with_open_milestone(project_id: str, conn=None) -> list[dict[str, Any]]:
    """Every active member of the project with the open milestone they are on (if any)."""
    return db.query(
        sql.SQL(
            """
            SELECT {cols}, ma.milestone_id, m.name AS milestone_name
            FROM project_members pm
            JOIN users u ON u.id = pm.user_id
            LEFT JOIN milestone_assignees ma
                   ON ma.project_id = pm.project_id AND ma.user_id = pm.user_id AND ma.is_open
            LEFT JOIN milestones m ON m.id = ma.milestone_id
            WHERE pm.project_id = %s AND pm.is_active
            ORDER BY u.last_name, u.first_name
            """
        ).format(cols=USER_COLS),
        (project_id,),
        conn=conn,
    )


def unassign_goals(milestone_id: str, user_ids: list[str], conn=None) -> None:
    if not user_ids:
        return
    db.execute(
        "UPDATE goals SET assignee_id = NULL, updated_at = now() WHERE milestone_id = %s AND assignee_id = ANY(%s)",
        (milestone_id, user_ids),
        conn=conn,
    )


# ---- goals -----------------------------------------------------------------

GOAL_SELECT = sql.SQL(
    """
    SELECT g.id, g.milestone_id, g.title, g.is_done, g.done_at, g.created_at,
           m.project_id, m.status AS milestone_status,
           u.id AS assignee_id, u.first_name AS assignee_first_name, u.last_name AS assignee_last_name,
           u.email AS assignee_email, u.job_title AS assignee_job_title, u.role AS assignee_role
    FROM goals g
    JOIN milestones m ON m.id = g.milestone_id
    LEFT JOIN users u ON u.id = g.assignee_id
    {where}
    """
)


def goals_for(milestone_ids: list[str], conn=None) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = {mid: [] for mid in milestone_ids}
    if not milestone_ids:
        return grouped
    rows = db.query(
        GOAL_SELECT.format(where=sql.SQL("WHERE g.milestone_id = ANY(%s) ORDER BY g.created_at, g.id")),
        (milestone_ids,),
        conn=conn,
    )
    for row in rows:
        grouped[row["milestone_id"]].append(row)
    return grouped


def find_goal(goal_id: str, conn=None) -> dict[str, Any] | None:
    return db.query_one(GOAL_SELECT.format(where=sql.SQL("WHERE g.id = %s")), (goal_id,), conn=conn)


def insert_goal(goal_id: str, milestone_id: str, title: str, assignee_id: str | None, conn=None) -> None:
    db.execute(
        "INSERT INTO goals (id, milestone_id, title, assignee_id) VALUES (%s, %s, %s, %s)",
        (goal_id, milestone_id, title, assignee_id),
        conn=conn,
    )


def update_goal(goal_id: str, fields: dict[str, Any], conn=None) -> None:
    allowed = {"title", "assignee_id", "is_done"}
    unknown = set(fields) - allowed
    if unknown:
        raise ValueError(f"Not updatable: {sorted(unknown)}")
    if not fields:
        return
    parts = [sql.SQL("{} = {}").format(sql.Identifier(c), sql.Placeholder(c)) for c in fields]
    if "is_done" in fields:
        parts.append(sql.SQL("done_at = CASE WHEN %(is_done)s THEN COALESCE(done_at, now()) ELSE NULL END"))
    db.execute(
        sql.SQL("UPDATE goals SET {a}, updated_at = now() WHERE id = %(id)s").format(a=sql.SQL(", ").join(parts)),
        {**fields, "id": goal_id},
        conn=conn,
    )


def delete_goal(goal_id: str, conn=None) -> None:
    db.execute("DELETE FROM goals WHERE id = %s", (goal_id,), conn=conn)


def open_goal_count(milestone_id: str, conn=None) -> int:
    row = db.query_one(
        "SELECT COUNT(*) AS n FROM goals WHERE milestone_id = %s AND NOT is_done", (milestone_id,), conn=conn
    )
    return int(row["n"])
