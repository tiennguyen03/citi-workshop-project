"""
All SQL for the `users` table. Returns plain dicts; never raises HTTP errors.

Dynamic parts (column lists, optional WHERE clauses, SET lists) are built with psycopg's
`sql` composition — never string formatting — so values are always parameterised.
"""

from typing import Any

from psycopg import sql

from app.core import db

# Never SELECT * — password_hash is only fetched by find_credentials.
USER_COLUMNS = (
    "id",
    "username",
    "first_name",
    "last_name",
    "email",
    "job_title",
    "salary",
    "role",
    "manager_id",
    "is_active",
    "created_at",
    "updated_at",
)
COLS = sql.SQL(", ").join(sql.Identifier(c) for c in USER_COLUMNS)
UPDATABLE_COLUMNS = frozenset(
    {"first_name", "last_name", "email", "job_title", "salary", "role", "manager_id", "is_active", "password_hash"}
)


def find_by_id(user_id: str, conn=None) -> dict[str, Any] | None:
    query = sql.SQL("SELECT {cols} FROM users WHERE id = %s").format(cols=COLS)
    return db.query_one(query, (user_id,), conn=conn)


def find_by_username(username: str, conn=None) -> dict[str, Any] | None:
    query = sql.SQL("SELECT {cols} FROM users WHERE username = %s").format(cols=COLS)
    return db.query_one(query, (username,), conn=conn)


def find_credentials_by_id(user_id: str, conn=None) -> dict[str, Any] | None:
    """Password-change lookup — returns password_hash for one user by id."""
    query = sql.SQL("SELECT {cols}, password_hash FROM users WHERE id = %s").format(cols=COLS)
    return db.query_one(query, (user_id,), conn=conn)


def update_password(user_id: str, password_hash: str, conn=None) -> None:
    db.execute(
        "UPDATE users SET password_hash = %s, updated_at = now() WHERE id = %s", (password_hash, user_id), conn=conn
    )


def find_credentials(username: str, conn=None) -> dict[str, Any] | None:
    """Login lookup — the only query that returns password_hash."""
    query = sql.SQL("SELECT {cols}, password_hash FROM users WHERE username = %s").format(cols=COLS)
    return db.query_one(query, (username,), conn=conn)


def list_users(*, role: str | None = None, manager_id: str | None = None, conn=None) -> list[dict[str, Any]]:
    clauses, params = [], []
    if role:
        clauses.append(sql.SQL("role = %s"))
        params.append(role)
    if manager_id:
        clauses.append(sql.SQL("manager_id = %s"))
        params.append(manager_id)
    where = sql.SQL("WHERE ") + sql.SQL(" AND ").join(clauses) if clauses else sql.SQL("")
    query = sql.SQL("SELECT {cols} FROM users {where} ORDER BY last_name, first_name").format(cols=COLS, where=where)
    return db.query(query, params, conn=conn)


def list_reports(manager_id: str, *, active_only: bool = False, conn=None) -> list[dict[str, Any]]:
    extra = sql.SQL(" AND is_active") if active_only else sql.SQL("")
    query = sql.SQL("SELECT {cols} FROM users WHERE manager_id = %s{extra} ORDER BY last_name, first_name").format(
        cols=COLS, extra=extra
    )
    return db.query(query, (manager_id,), conn=conn)


def username_exists(username: str, conn=None) -> bool:
    return db.query_one("SELECT 1 AS x FROM users WHERE username = %s", (username,), conn=conn) is not None


def email_exists(email: str, exclude_id: str | None = None, conn=None) -> bool:
    row = db.query_one(
        "SELECT 1 AS x FROM users WHERE email = %s AND id <> COALESCE(%s, '')", (email, exclude_id), conn=conn
    )
    return row is not None


def insert(row: dict[str, Any], conn=None) -> dict[str, Any]:
    query = sql.SQL(
        """
        INSERT INTO users
            (id, username, password_hash, first_name, last_name, email, job_title, salary, role, manager_id)
        VALUES (%(id)s, %(username)s, %(password_hash)s, %(first_name)s, %(last_name)s, %(email)s,
                %(job_title)s, %(salary)s, %(role)s, %(manager_id)s)
        RETURNING {cols}
        """
    ).format(cols=COLS)
    return db.query_one(query, row, conn=conn)


def update(user_id: str, fields: dict[str, Any], conn=None) -> dict[str, Any] | None:
    """Update whitelisted columns only. Caller guarantees `fields` is non-empty."""
    unknown = set(fields) - UPDATABLE_COLUMNS
    if unknown:
        raise ValueError(f"Not updatable: {sorted(unknown)}")
    assignments = sql.SQL(", ").join(
        sql.SQL("{} = {}").format(sql.Identifier(col), sql.Placeholder(col)) for col in fields
    )
    query = sql.SQL("UPDATE users SET {assignments}, updated_at = now() WHERE id = %(id)s RETURNING {cols}").format(
        assignments=assignments, cols=COLS
    )
    return db.query_one(query, {**fields, "id": user_id}, conn=conn)


def count_active_admins(conn=None) -> int:
    return db.query_one("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND is_active", conn=conn)["n"]


def count_managed_projects(user_id: str, conn=None) -> int:
    return db.query_one(
        "SELECT COUNT(*) AS n FROM projects WHERE manager_id = %s AND NOT archived", (user_id,), conn=conn
    )["n"]


def count_reports(manager_id: str, conn=None) -> int:
    return db.query_one("SELECT COUNT(*) AS n FROM users WHERE manager_id = %s", (manager_id,), conn=conn)["n"]


def current_projects(user_ids: list[str], conn=None) -> dict[str, dict[str, str]]:
    """user_id -> {id, name} of the one active project each user is on (M8), if any."""
    if not user_ids:
        return {}
    rows = db.query(
        """
        SELECT pm.user_id, p.id, p.name
        FROM project_members pm JOIN projects p ON p.id = pm.project_id
        WHERE pm.is_active AND pm.user_id = ANY(%s)
        """,
        (user_ids,),
        conn=conn,
    )
    return {r["user_id"]: {"id": r["id"], "name": r["name"]} for r in rows}
