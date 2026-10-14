"""Dashboard-only SQL (counts and the employee's open-goal list). Everything else reuses other repositories."""

from datetime import date
from typing import Any

from app.core import db


def user_counts_by_role(conn=None) -> dict[str, int]:
    rows = db.query("SELECT role, COUNT(*) AS n FROM users WHERE is_active GROUP BY role", conn=conn)
    counts = {"admin": 0, "manager": 0, "employee": 0}
    for row in rows:
        counts[row["role"]] = int(row["n"])
    return counts


def available_employee_count(conn=None) -> int:
    row = db.query_one(
        """
        SELECT COUNT(*) AS n FROM users u
        WHERE u.role = 'employee' AND u.is_active
          AND NOT EXISTS (SELECT 1 FROM project_members pm WHERE pm.user_id = u.id AND pm.is_active)
        """,
        conn=conn,
    )
    return int(row["n"])


def due_soon_milestones(manager_id: str, until: date, conn=None) -> list[dict[str, Any]]:
    """Open milestones due on or before `until` (overdue included) on the manager's live projects, soonest first."""
    return db.query(
        """
        SELECT m.id, m.name, m.due_date, p.id AS project_id, p.name AS project_name
        FROM milestones m JOIN projects p ON p.id = m.project_id
        WHERE p.manager_id = %s AND NOT p.archived AND p.status = 'active'
          AND m.status = 'open' AND m.due_date <= %s
        ORDER BY m.due_date, p.name, m.name
        """,
        (manager_id, until),
        conn=conn,
    )


def open_goals_for(user_id: str, conn=None) -> list[dict[str, Any]]:
    """Unfinished goals assigned to the user on open milestones of their active project."""
    rows = db.query(
        """
        SELECT g.id, g.title, m.id AS milestone_id, m.name AS milestone_name, m.due_date,
               p.id AS project_id, p.name AS project_name
        FROM goals g
        JOIN milestones m ON m.id = g.milestone_id
        JOIN projects p ON p.id = m.project_id
        JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = g.assignee_id AND pm.is_active
        WHERE g.assignee_id = %s AND NOT g.is_done AND m.status = 'open' AND NOT p.archived AND p.status = 'active'
        ORDER BY m.due_date, g.created_at, g.id
        """,
        (user_id,),
        conn=conn,
    )
    return [
        {
            "id": r["id"],
            "title": r["title"],
            "milestone": {"id": r["milestone_id"], "name": r["milestone_name"], "dueDate": r["due_date"]},
            "project": {"id": r["project_id"], "name": r["project_name"]},
        }
        for r in rows
    ]
