"""GET /audit-log: admin only, filters, pagination, actor join."""

from tests.integration.helpers import call, login


def test_audit_log_admin_only_with_filters_and_paging():
    admin_token, admin = login()
    call("POST", "/api/v1/auth/login", {"username": "admin", "password": "bad"})
    status, mgr = call(
        "POST",
        "/api/v1/users",
        {
            "username": "mgr",
            "password": "Password1!",
            "firstName": "M",
            "lastName": "G",
            "email": "m@example.com",
            "jobTitle": "Mgr",
            "salary": 1,
            "role": "manager",
        },
        token=admin_token,
    )
    assert status == 201
    mgr_token, _ = login("mgr", "Password1!")

    assert call("GET", "/api/v1/audit-log", token=mgr_token)[0] == 403

    status, body = call("GET", "/api/v1/audit-log", token=admin_token)
    assert status == 200
    actions = [e["action"] for e in body["items"]]
    assert actions == ["auth.login", "user.create", "auth.login_failed", "auth.login"]  # newest first
    assert body["total"] == 4 and body["limit"] == 50 and body["offset"] == 0
    created = next(e for e in body["items"] if e["action"] == "user.create")
    assert created["actor"]["id"] == admin["id"] and created["actor"]["role"] == "admin"
    assert created["entityType"] == "user" and created["entityId"] == mgr["id"]
    failed = next(e for e in body["items"] if e["action"] == "auth.login_failed")
    assert failed["actor"] is None and failed["statusCode"] == 401

    status, body = call("GET", "/api/v1/audit-log?action=user.create", token=admin_token)
    assert status == 200 and body["total"] == 1
    status, body = call("GET", f"/api/v1/audit-log?actorId={mgr['id']}", token=admin_token)
    assert body["total"] == 1 and body["items"][0]["action"] == "auth.login"
    status, body = call("GET", "/api/v1/audit-log?limit=2&offset=2", token=admin_token)
    assert len(body["items"]) == 2 and body["total"] == 4
    status, body = call("GET", "/api/v1/audit-log?limit=999", token=admin_token)
    assert status == 400 and body["error"]["details"]["field"] == "limit"
