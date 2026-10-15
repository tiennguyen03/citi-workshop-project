"""
Database schema (data-model.md) — the only place table and column names are declared.

Idempotent DDL applied once per Lambda container (decisions.md D4). Column additions after
first deploy go in `MIGRATIONS` as `ALTER TABLE … ADD COLUMN IF NOT EXISTS`; never drops.
"""

import logging

from app.core import db
from app.core.config import get_settings
from app.core.ids import new_id
from app.core.security import hash_password

logger = logging.getLogger(__name__)

_ensured = False

DDL = """
CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    first_name    TEXT NOT NULL,
    last_name     TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    job_title     TEXT NOT NULL,
    salary        NUMERIC(12,2) NOT NULL CHECK (salary >= 0),
    role          TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'employee')),
    manager_id    TEXT NULL REFERENCES users(id),
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT users_manager_required CHECK (
        (role = 'employee' AND manager_id IS NOT NULL) OR (role <> 'employee' AND manager_id IS NULL)
    )
);
CREATE INDEX IF NOT EXISTS users_manager_idx ON users (manager_id);

CREATE TABLE IF NOT EXISTS projects (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    budget      NUMERIC(12,2) NOT NULL CHECK (budget >= 0),
    start_date  DATE NOT NULL,
    end_date    DATE NOT NULL,
    manager_id  TEXT NOT NULL REFERENCES users(id),
    status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'complete')),
    archived    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT projects_dates CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS projects_manager_idx ON projects (manager_id);

CREATE TABLE IF NOT EXISTS project_members (
    project_id     TEXT NOT NULL REFERENCES projects(id),
    user_id        TEXT NOT NULL REFERENCES users(id),
    hours_assigned NUMERIC(7,2) NOT NULL DEFAULT 0 CHECK (hours_assigned >= 0),
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    added_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    released_at    TIMESTAMPTZ NULL,
    released_reason TEXT NULL CHECK (released_reason IN ('removed', 'completed', 'archived')),
    PRIMARY KEY (project_id, user_id)
);
-- M8 / D15: one active project per employee
CREATE UNIQUE INDEX IF NOT EXISTS one_active_project_per_employee
    ON project_members (user_id) WHERE is_active;

CREATE TABLE IF NOT EXISTS milestones (
    id           TEXT PRIMARY KEY,
    project_id   TEXT NOT NULL REFERENCES projects(id),
    name         TEXT NOT NULL,
    description  TEXT NOT NULL DEFAULT '',
    start_date   DATE NOT NULL,
    due_date     DATE NOT NULL,
    status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'complete')),
    completed_at TIMESTAMPTZ NULL,
    sort_order   INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT milestones_dates CHECK (due_date >= start_date)
);
CREATE INDEX IF NOT EXISTS milestones_project_idx ON milestones (project_id);

CREATE TABLE IF NOT EXISTS milestone_assignees (
    milestone_id TEXT NOT NULL REFERENCES milestones(id),
    user_id      TEXT NOT NULL REFERENCES users(id),
    project_id   TEXT NOT NULL REFERENCES projects(id),
    is_open      BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (milestone_id, user_id)
);
-- M13a / D14: one open milestone per employee per project
CREATE UNIQUE INDEX IF NOT EXISTS one_open_milestone_per_user_per_project
    ON milestone_assignees (project_id, user_id) WHERE is_open;

CREATE TABLE IF NOT EXISTS goals (
    id           TEXT PRIMARY KEY,
    milestone_id TEXT NOT NULL REFERENCES milestones(id),
    title        TEXT NOT NULL,
    assignee_id  TEXT NULL REFERENCES users(id),
    is_done      BOOLEAN NOT NULL DEFAULT FALSE,
    done_at      TIMESTAMPTZ NULL,
    rag_status   TEXT NULL CHECK (rag_status IN ('red', 'amber', 'green')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS goals_milestone_idx ON goals (milestone_id);
CREATE INDEX IF NOT EXISTS goals_assignee_idx ON goals (assignee_id);

CREATE TABLE IF NOT EXISTS time_entries (
    id         TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    user_id    TEXT NOT NULL REFERENCES users(id),
    entry_date DATE NOT NULL,
    hours      NUMERIC(5,2) NOT NULL CHECK (hours >= 0.25 AND hours <= 24),
    note       TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS time_entries_project_user_idx ON time_entries (project_id, user_id, entry_date);

CREATE TABLE IF NOT EXISTS audit_log (
    id          BIGSERIAL PRIMARY KEY,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor_id    TEXT NULL REFERENCES users(id),
    actor_role  TEXT NULL,
    action      TEXT NOT NULL,
    entity_type TEXT NULL,
    entity_id   TEXT NULL,
    project_id  TEXT NULL,
    summary     TEXT NOT NULL,
    details     JSONB NULL,
    status_code SMALLINT NOT NULL
);
CREATE INDEX IF NOT EXISTS audit_log_occurred_idx ON audit_log (occurred_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx ON audit_log (actor_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON audit_log (entity_type, entity_id);
"""

# Additive changes after first deploy. Each statement must be idempotent.
MIGRATIONS: list[str] = [
    # slice 3: why a membership ended, so un-archiving can re-claim exactly the people archiving released
    "ALTER TABLE project_members ADD COLUMN IF NOT EXISTS released_reason TEXT "
    "CHECK (released_reason IN ('removed', 'completed', 'archived'))",
    # slice 18 (D29): a milestone may wait on one other milestone of the same project
    "ALTER TABLE milestones ADD COLUMN IF NOT EXISTS blocked_by_id TEXT NULL REFERENCES milestones(id)",
]

TABLES_IN_DEPENDENCY_ORDER = (
    "audit_log",
    "time_entries",
    "goals",
    "milestone_assignees",
    "milestones",
    "project_members",
    "projects",
    "users",
)


def apply(conn=None) -> None:
    """Create any missing tables/indexes and run additive migrations."""
    connection = conn or db.get_conn()
    with connection.transaction():
        db.execute(DDL, conn=connection)
        for statement in MIGRATIONS:
            db.execute(statement, conn=connection)


def ensure_bootstrap_admin(conn=None) -> None:
    """Create the first admin when the users table is empty so someone can log in."""
    connection = conn or db.get_conn()
    row = db.query_one("SELECT COUNT(*) AS n FROM users", conn=connection)
    if row and row["n"] > 0:
        return
    settings = get_settings()
    db.execute(
        """
        INSERT INTO users (id, username, password_hash, first_name, last_name, email, job_title, salary, role)
        VALUES (%s, 'admin', %s, 'System', 'Admin', 'admin@example.com', 'Administrator', 0, 'admin')
        """,
        (new_id(), hash_password(settings.bootstrap_admin_password)),
        conn=connection,
    )
    logger.info("Bootstrap admin user created (username: admin)")


def ensure() -> None:
    """Apply the schema once per process. Safe to call on every request."""
    global _ensured
    if _ensured:
        return
    apply()
    ensure_bootstrap_admin()
    # Imported here: seed depends on db + security, schema must stay importable by both.
    from app.core import seed

    seed.ensure_demo_data()
    _ensured = True


def reset_flag() -> None:
    """Testing hook: force `ensure()` to run again."""
    global _ensured
    _ensured = False
