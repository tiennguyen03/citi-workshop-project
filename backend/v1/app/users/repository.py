"""All SQL for the `users` table. Returns plain dicts; never raises HTTP errors."""

from typing import Any

from app.core import db

# Never SELECT * — password_hash is only fetched by find_credentials.
USER_COLUMNS = (
    "id, username, first_name, last_name, email, job_title, salary, role, manager_id, is_active, created_at, updated_at"
)


def find_by_id(user_id: str, conn=None) -> dict[str, Any] | None:
    return db.query_one(f"SELECT {USER_COLUMNS} FROM users WHERE id = %s", (user_id,), conn=conn)


def find_by_username(username: str, conn=None) -> dict[str, Any] | None:
    return db.query_one(f"SELECT {USER_COLUMNS} FROM users WHERE username = %s", (username,), conn=conn)


def find_credentials(username: str, conn=None) -> dict[str, Any] | None:
    """Login lookup — the only query that returns password_hash."""
    return db.query_one(
        f"SELECT {USER_COLUMNS}, password_hash FROM users WHERE username = %s",
        (username,),
        conn=conn,
    )
