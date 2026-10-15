"""Users endpoints end to end: role scoping, field whitelist, invariants and audit rows."""

import pytest

from app.core import db
from tests.integration.helpers import call, login


def make_user(token, **overrides):
    base = {
        "username": "u.one",
        "password": "Password1!",
        "firstName": "U",
        "lastName": "One",
        "email": "u.one@example.com",
        "jobTitle": "Engineer",
        "salary": 80000,
        "role": "employee",
    }
    status, body = call("POST", "/api/v1/users", {**base, **overrides}, token=token)
    assert status == 201, body
    return body


@pytest.fixture
def org():
    """admin token, one manager, two employees under them, one employee elsewhere."""
    admin_token, _ = login()
    mgr = make_user(admin_token, username="mgr", email="mgr@example.com", role="manager")
    mgr2 = make_user(admin_token, username="mgr2", email="mgr2@example.com", role="manager")
    e1 = make_user(admin_token, username="emp1", email="e1@example.com", managerId=mgr["id"])
    e2 = make_user(admin_token, username="emp2", email="e2@example.com", managerId=mgr["id"])
    e3 = make_user(admin_token, username="emp3", email="e3@example.com", managerId=mgr2["id"])
    return {
        "admin": admin_token,
        "mgr": mgr,
        "mgr2": mgr2,
        "e1": e1,
        "e2": e2,
        "e3": e3,
        "mgr_token": login("mgr", "Password1!")[0],
        "e1_token": login("emp1", "Password1!")[0],
    }


def test_create_user_validation_and_audit():
    token, _ = login()
    status, body = call("POST", "/api/v1/users", {"username": "x"}, token=token)
    assert status == 400 and body["error"]["code"] == "VALIDATION_ERROR"
    user = make_user(token, role="manager")
    assert "password" not in user and "passwordHash" not in user
    status, body = call("POST", "/api/v1/users", {"username": "zzz"}, token=token)
    assert status == 400
    rows = db.query("SELECT action, entity_id, details FROM audit_log WHERE action = 'user.create'")
    assert len(rows) == 1 and rows[0]["entity_id"] == user["id"]
    assert "password" not in rows[0]["details"] and rows[0]["details"]["salary"] == "[redacted]"


def test_list_users_scoping(org):
    status, body = call("GET", "/api/v1/users", token=org["admin"])
    assert status == 200 and body["total"] == 6
    status, body = call("GET", "/api/v1/users", token=org["mgr_token"])
    assert status == 200 and {u["username"] for u in body["items"]} == {"emp1", "emp2"}  # reports only, not the manager
    assert call("GET", "/api/v1/users", token=org["e1_token"])[0] == 403


def test_users_paging_search_and_people_counts(org):
    admin = org["admin"]
    status, body = call("GET", "/api/v1/users?limit=2&offset=0", token=admin)
    assert status == 200 and len(body["items"]) == 2 and body["total"] == 6
    assert body["limit"] == 2 and body["offset"] == 0
    assert body["summary"] == {"admins": 1, "managers": 2, "employees": 3, "available": 3}
    rest = call("GET", "/api/v1/users?limit=2&offset=4", token=admin)[1]
    assert len(rest["items"]) == 2 and rest["total"] == 6
    assert call("GET", "/api/v1/users?limit=101", token=admin)[0] == 400
    assert call("GET", "/api/v1/users?offset=-1", token=admin)[0] == 400
    # search covers name, email and username; filters compose
    assert {u["username"] for u in call("GET", "/api/v1/users?q=emp", token=admin)[1]["items"]} == {
        "emp1",
        "emp2",
        "emp3",
    }
    assert [u["username"] for u in call("GET", "/api/v1/users?q=e3@example", token=admin)[1]["items"]] == ["emp3"]
    assert [
        u["username"]
        for u in call("GET", "/api/v1/users?q=EMP&role=employee&managerId=" + org["mgr2"]["id"], token=admin)[1][
            "items"
        ]
    ] == ["emp3"]
    assert call("GET", "/api/v1/users?available=true", token=admin)[1]["total"] == 3
    # deactivated people drop out unless asked for
    assert call("PATCH", f"/api/v1/users/{org['e3']['id']}", {"isActive": False}, token=admin)[0] == 200
    assert call("GET", "/api/v1/users", token=admin)[1]["total"] == 5
    assert call("GET", "/api/v1/users?inactive=true", token=admin)[1]["total"] == 6
    assert call("GET", "/api/v1/users", token=admin)[1]["summary"]["employees"] == 2
    # a manager's page is cut from their own people, with no office-wide counts
    mine = call("GET", "/api/v1/users?limit=2&offset=1", token=org["mgr_token"])[1]
    assert mine["total"] == 2 and len(mine["items"]) == 1 and mine["summary"] is None
    assert [u["username"] for u in call("GET", "/api/v1/users?q=emp2", token=org["mgr_token"])[1]["items"]] == ["emp2"]


def test_employee_edits_own_name_but_not_salary(org):
    e1 = org["e1"]["id"]
    status, body = call("PATCH", f"/api/v1/users/{e1}", {"firstName": "Renamed"}, token=org["e1_token"])
    assert status == 200 and body["firstName"] == "Renamed"
    status, body = call("PATCH", f"/api/v1/users/{e1}", {"salary": 1}, token=org["e1_token"])
    assert status == 403
    status, body = call("PATCH", f"/api/v1/users/{e1}", {"isAdmin": True}, token=org["e1_token"])
    assert status == 400 and body["error"]["details"]["field"] == "isAdmin"
    assert db.query_one("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'user.update'")["n"] == 1


def test_manager_edits_report_not_stranger(org):
    status, _ = call("PATCH", f"/api/v1/users/{org['e1']['id']}", {"email": "new@example.com"}, token=org["mgr_token"])
    assert status == 200
    status, _ = call("PATCH", f"/api/v1/users/{org['e3']['id']}", {"email": "x@example.com"}, token=org["mgr_token"])
    assert status == 403
    status, body = call(
        "PATCH", f"/api/v1/users/{org['e2']['id']}", {"email": "new@example.com"}, token=org["mgr_token"]
    )
    assert status == 409 and body["error"]["details"]["field"] == "email"


def test_admin_invariants(org):
    _, admin = call("GET", "/api/v1/auth/me", token=org["admin"])
    status, body = call("PATCH", f"/api/v1/users/{admin['id']}", {"isActive": False}, token=org["admin"])
    assert status == 409
    status, body = call("PATCH", f"/api/v1/users/{org['mgr']['id']}", {"role": "employee"}, token=org["admin"])
    assert status == 409  # still has reports
    status, body = call(
        "PATCH", f"/api/v1/users/{org['e1']['id']}", {"managerId": org["mgr2"]["id"]}, token=org["admin"]
    )
    assert status == 200 and body["managerId"] == org["mgr2"]["id"]


def test_team_and_visibility(org):
    status, body = call("GET", f"/api/v1/users/{org['e1']['id']}/team", token=org["e1_token"])
    assert status == 200 and body["manager"]["id"] == org["mgr"]["id"]
    assert {m["id"] for m in body["members"]} == {org["e1"]["id"], org["e2"]["id"]}
    assert all("salary" not in m for m in body["members"])
    assert call("GET", f"/api/v1/users/{org['e3']['id']}/team", token=org["e1_token"])[0] == 403
    status, body = call("GET", f"/api/v1/users/{org['e2']['id']}", token=org["e1_token"])
    assert status == 200 and "salary" not in body
    assert call("GET", f"/api/v1/users/{org['e3']['id']}", token=org["e1_token"])[0] == 403
    assert call("GET", "/api/v1/users/NOPE00", token=org["admin"])[0] == 404


def test_user_page_shows_manager_and_project_history(org):
    from tests.integration.test_projects import create_project

    project = create_project(org["admin"], org["mgr"]["id"])
    pid, uid = project["id"], org["e1"]["id"]
    assert (
        call("POST", f"/api/v1/projects/{pid}/members", {"userId": uid, "hoursAssigned": 40}, token=org["mgr_token"])[0]
        == 201
    )
    assert (
        call(
            "POST",
            f"/api/v1/projects/{pid}/time-entries",
            {"entryDate": project["startDate"], "hours": 6},
            token=org["e1_token"],
        )[0]
        == 201
    )
    status, body = call("GET", f"/api/v1/users/{uid}", token=org["mgr_token"])
    assert status == 200 and body["manager"] == {"id": org["mgr"]["id"], "firstName": "U", "lastName": "One"}
    (row,) = body["projects"]
    assert row["id"] == pid and row["isActive"] and row["hoursAssigned"] == 40 and row["hoursCompleted"] == 6
    assert row["releasedReason"] is None and row["releasedAt"] is None and row["addedAt"]

    assert call("DELETE", f"/api/v1/projects/{pid}/members/{uid}", token=org["mgr_token"])[0] == 204
    (row,) = call("GET", f"/api/v1/users/{uid}", token=org["e1_token"])[1]["projects"]  # self can see it too
    assert (
        not row["isActive"] and row["releasedReason"] == "removed" and row["releasedAt"] and row["hoursCompleted"] == 6
    )

    # archived projects drop out of the history for everyone but admins
    assert call("POST", f"/api/v1/projects/{pid}/archive", token=org["admin"])[0] == 200
    assert call("GET", f"/api/v1/users/{uid}", token=org["mgr_token"])[1]["projects"] == []
    (row,) = call("GET", f"/api/v1/users/{uid}", token=org["admin"])[1]["projects"]
    assert row["archived"] and row["releasedReason"] == "removed"
    # a manager has no manager and no memberships
    body = call("GET", f"/api/v1/users/{org['mgr']['id']}", token=org["admin"])[1]
    assert body["manager"] is None and body["projects"] == []


def test_deactivated_user_locked_out(org):
    status, _ = call("PATCH", f"/api/v1/users/{org['e1']['id']}", {"isActive": False}, token=org["admin"])
    assert status == 200
    assert call("GET", "/api/v1/auth/me", token=org["e1_token"])[0] == 401
