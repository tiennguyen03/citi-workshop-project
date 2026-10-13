"""Password change (self) and temporary-password reset (admin), end to end."""

from app.core import db
from tests.integration.helpers import call, login
from tests.integration.test_projects import make_user


def test_user_changes_own_password():
    admin, _ = login()
    make_user(admin, "emp1", "employee", make_user(admin, "mgr", "manager")["id"])
    token, me = login("emp1", "Password1!")
    url = "/api/v1/auth/change-password"
    # wrong current password -> field error; too short / same -> validation
    status, body = call("POST", url, {"currentPassword": "nope", "newPassword": "Brand-new-1"}, token=token)
    assert status == 400 and body["error"]["details"]["field"] == "currentPassword"
    assert call("POST", url, {"currentPassword": "Password1!", "newPassword": "short"}, token=token)[0] == 400
    assert call("POST", url, {"currentPassword": "Password1!", "newPassword": "Password1!"}, token=token)[0] == 400
    assert call("POST", url, {"currentPassword": "Password1!", "newPassword": "Brand-new-1"})[0] == 401  # no token
    # success: old password stops working, new one works, audit row has no password
    status, body = call("POST", url, {"currentPassword": "Password1!", "newPassword": "Brand-new-1"}, token=token)
    assert status == 200 and body == {"changed": True}
    assert call("POST", "/api/v1/auth/login", {"username": "emp1", "password": "Password1!"})[0] == 401
    assert login("emp1", "Brand-new-1")[1]["id"] == me["id"]
    row = db.query_one(
        "SELECT entity_id, actor_id, summary, details FROM audit_log WHERE action = 'auth.password_change'"
    )
    assert row["entity_id"] == me["id"] == row["actor_id"] and "changed their password" in row["summary"]
    assert "currentPassword" not in row["details"] and "newPassword" not in row["details"]
    assert "password" not in str(row["details"]).lower()


def test_admin_sets_temporary_password_others_cannot():
    admin, _ = login()
    mgr = make_user(admin, "mgr", "manager")
    emp = make_user(admin, "emp1", "employee", mgr["id"])
    mgr_token = login("mgr", "Password1!")[0]
    emp_token = login("emp1", "Password1!")[0]
    # manager (even for a report) and the user themself cannot use the admin reset
    assert call("PATCH", f"/api/v1/users/{emp['id']}", {"password": "Temp-pass-9"}, token=mgr_token)[0] == 403
    assert call("PATCH", f"/api/v1/users/{emp['id']}", {"password": "Temp-pass-9"}, token=emp_token)[0] == 403
    assert call("PATCH", f"/api/v1/users/{emp['id']}", {"password": "short"}, token=admin)[0] == 400
    status, body = call("PATCH", f"/api/v1/users/{emp['id']}", {"password": "Temp-pass-9"}, token=admin)
    assert status == 200 and "password" not in body and "passwordHash" not in body
    assert login("emp1", "Temp-pass-9")[1]["id"] == emp["id"]
    row = db.query_one("SELECT summary, details FROM audit_log WHERE action = 'user.update' ORDER BY id DESC LIMIT 1")
    assert "password" in row["summary"] and "Temp-pass-9" not in str(row["details"])
