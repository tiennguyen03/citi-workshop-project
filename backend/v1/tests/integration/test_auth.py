"""Login, /auth/me and the audit rows they produce — end to end through the handler."""

from app.core import db
from tests.integration.helpers import call, login


def test_login_success_shape_and_audit_row():
    status, body = call("POST", "/api/v1/auth/login", {"username": "admin", "password": "Admin123!"})
    assert status == 200
    assert set(body) == {"token", "expiresAt", "user"}
    user = body["user"]
    assert user["username"] == "admin" and user["role"] == "admin"
    assert "passwordHash" not in user and "password_hash" not in user
    assert user["salary"] == 0  # own salary visible

    rows = db.query("SELECT actor_id, actor_role, action, entity_id, summary, details, status_code FROM audit_log")
    assert len(rows) == 1
    row = rows[0]
    assert row["action"] == "auth.login" and row["actor_id"] == user["id"] and row["actor_role"] == "admin"
    assert row["entity_id"] == user["id"] and row["status_code"] == 200
    assert "password" not in row["details"]  # sanitised


def test_login_failure_is_401_and_audited_without_password():
    status, body = call("POST", "/api/v1/auth/login", {"username": "admin", "password": "wrong"})
    assert status == 401
    assert body["error"]["code"] == "UNAUTHENTICATED"

    status, _ = call("POST", "/api/v1/auth/login", {"username": "ghost", "password": "x"})
    assert status == 401

    rows = db.query("SELECT actor_id, action, summary, details, status_code FROM audit_log ORDER BY id")
    assert [r["action"] for r in rows] == ["auth.login_failed", "auth.login_failed"]
    assert rows[0]["actor_id"] is None and rows[0]["status_code"] == 401
    assert "admin" in rows[0]["summary"] and "ghost" in rows[1]["summary"]
    assert all("password" not in r["details"] for r in rows)


def test_login_validation_errors():
    status, body = call("POST", "/api/v1/auth/login", {"username": "admin"})
    assert status == 400 and body["error"]["details"]["field"] == "password"
    status, body = call("POST", "/api/v1/auth/login", {"username": "admin", "password": "x", "extra": 1})
    assert status == 400 and body["error"]["details"]["field"] == "extra"
    assert db.query_one("SELECT COUNT(*) AS n FROM audit_log")["n"] == 0  # validation errors are not audited


def test_inactive_user_cannot_login_or_use_token():
    token, user = login()
    db.execute("UPDATE users SET is_active = FALSE WHERE id = %s", (user["id"],))
    status, body = call("GET", "/api/v1/auth/me", token=token)
    assert status == 401 and "active" in body["error"]["message"]
    status, body = call("POST", "/api/v1/auth/login", {"username": "admin", "password": "Admin123!"})
    assert status == 401 and "deactivated" in body["error"]["message"]


def test_me_requires_valid_token():
    assert call("GET", "/api/v1/auth/me")[0] == 401
    assert call("GET", "/api/v1/auth/me", token="not-a-jwt")[0] == 401
    token, user = login()
    status, body = call("GET", "/api/v1/auth/me", token=token)
    assert status == 200
    assert body["id"] == user["id"] and body["username"] == "admin" and "salary" in body
    assert db.query_one("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'auth.login'")["n"] == 1
