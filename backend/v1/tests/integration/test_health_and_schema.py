"""Smoke: the Lambda handler answers /health and the schema + bootstrap admin exist."""

import function
from app.core import db


def _event(method: str, path: str) -> dict:
    return {"rawPath": path, "requestContext": {"http": {"method": method}}}


def test_health_via_lambda_handler():
    out = function.handler(_event("GET", "/api/v1/health"))
    assert out["statusCode"] == 200
    assert '"db": "ok"' in out["body"]


def test_schema_tables_and_indexes_exist():
    names = {r["tablename"] for r in db.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")}
    assert {
        "users",
        "projects",
        "project_members",
        "milestones",
        "milestone_assignees",
        "goals",
        "time_entries",
        "audit_log",
    } <= names
    idx = {r["indexname"] for r in db.query("SELECT indexname FROM pg_indexes WHERE schemaname = 'public'")}
    assert {"one_active_project_per_employee", "one_open_milestone_per_user_per_project"} <= idx


def test_bootstrap_admin_created_once():
    rows = db.query("SELECT username, role FROM users")
    assert rows == [{"username": "admin", "role": "admin"}]
    # ensure() is idempotent — running again must not create a second admin
    from app.core import schema

    schema.reset_flag()
    schema.ensure()
    assert db.query_one("SELECT COUNT(*) AS n FROM users")["n"] == 1


def test_partial_unique_index_blocks_second_active_project():
    """D15 backstop: the database itself refuses two active memberships for one employee."""
    import psycopg

    admin = db.query_one("SELECT id FROM users WHERE username = 'admin'")["id"]
    db.execute(
        "INSERT INTO users "
        "(id, username, password_hash, first_name, last_name, email, job_title, salary, role, manager_id) "
        "VALUES ('MGR001', 'm', 'x', 'M', 'M', 'm@x.com', 'Mgr', 1, 'manager', NULL), "
        "('EMP001', 'e', 'x', 'E', 'E', 'e@x.com', 'Eng', 1, 'employee', 'MGR001')"
    )
    db.execute(
        "INSERT INTO projects (id, name, budget, start_date, end_date, manager_id) VALUES "
        "('PRJ001', 'A', 1, '2026-01-01', '2026-02-01', 'MGR001'), "
        "('PRJ002', 'B', 1, '2026-01-01', '2026-02-01', 'MGR001')"
    )
    db.execute("INSERT INTO project_members (project_id, user_id) VALUES ('PRJ001', 'EMP001')")
    try:
        db.execute("INSERT INTO project_members (project_id, user_id) VALUES ('PRJ002', 'EMP001')")
        raise AssertionError("second active membership should have been rejected")
    except psycopg.errors.UniqueViolation:
        pass
    assert admin
