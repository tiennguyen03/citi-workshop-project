"""Time entries end to end: membership gate, limits, author-only edits, hours/cost roll-up, audit."""

from datetime import date, timedelta

from app.core import db
from tests.integration.helpers import call, login
from tests.integration.test_projects import create_project, make_user

TODAY = date.today()


def setup_org():
    admin, _ = login()
    mgr = make_user(admin, "mgr", "manager")
    make_user(admin, "mgr2", "manager")
    emp1 = make_user(admin, "emp1", "employee", mgr["id"], salary=104000)  # 50 $/h at 2080 h
    emp2 = make_user(admin, "emp2", "employee", mgr["id"])
    mgr_token = login("mgr", "Password1!")[0]
    # project spanning last month .. next month so "today" is inside it
    project = create_project(
        admin,
        mgr["id"],
        startDate=(TODAY - timedelta(days=30)).isoformat(),
        endDate=(TODAY + timedelta(days=30)).isoformat(),
    )
    status, _ = call(
        "POST",
        f"/api/v1/projects/{project['id']}/members",
        {"userId": emp1["id"], "hoursAssigned": 100},
        token=mgr_token,
    )
    assert status == 201
    return {
        "admin": admin,
        "mgr": mgr,
        "mgr_token": mgr_token,
        "mgr2_token": login("mgr2", "Password1!")[0],
        "emp1": emp1,
        "emp1_token": login("emp1", "Password1!")[0],
        "emp2": emp2,
        "emp2_token": login("emp2", "Password1!")[0],
        "pid": project["id"],
        "project": project,
    }


def log(token, pid, **overrides):
    body = {"entryDate": TODAY.isoformat(), "hours": 8, "note": "Work", **overrides}
    return call("POST", f"/api/v1/projects/{pid}/time-entries", body, token=token)


def test_only_active_members_log_time_within_limits():
    org = setup_org()
    pid, e1 = org["pid"], org["emp1_token"]
    # non-member employee: cannot even see the project; manager: not a member either
    assert log(org["emp2_token"], pid)[0] == 403
    assert log(org["mgr_token"], pid)[0] == 403
    # limits
    assert log(e1, pid, hours=0)[0] == 400
    assert log(e1, pid, hours=24.5)[0] == 400
    status, body = log(e1, pid, entryDate=(TODAY + timedelta(days=1)).isoformat())
    assert status == 400 and body["error"]["details"]["field"] == "entryDate"
    status, body = log(e1, pid, entryDate=(TODAY - timedelta(days=60)).isoformat())
    assert status == 400 and body["error"]["details"]["field"] == "entryDate"
    # happy path
    status, entry = log(e1, pid, hours=7.5, note="Inventory export")
    assert status == 201, entry
    assert entry["user"]["id"] == org["emp1"]["id"] and entry["hours"] == 7.5 and entry["projectId"] == pid
    row = db.query_one(
        "SELECT entity_type, entity_id, project_id, summary FROM audit_log WHERE action = 'time_entry.create'"
    )
    assert row["entity_type"] == "time_entry" and row["entity_id"] == entry["id"] and row["project_id"] == pid
    assert "logged 7.5 h" in row["summary"]
    # it rolls up into hours completed and cost (7.5 h × 104000/2080 = 375)
    status, project = call("GET", f"/api/v1/projects/{pid}", token=org["mgr_token"])
    assert project["hoursCompleted"] == 7.5 and project["costConsumed"] == 375
    status, members = call("GET", f"/api/v1/projects/{pid}/members", token=org["mgr_token"])
    assert members["items"][0]["hoursCompleted"] == 7.5


def test_visibility_edit_and_delete_rules():
    org = setup_org()
    pid, e1, m = org["pid"], org["emp1_token"], org["mgr_token"]
    _, mine = log(e1, pid, hours=4)
    # a second member logs too
    assert call("POST", f"/api/v1/projects/{pid}/members", {"userId": org["emp2"]["id"]}, token=m)[0] == 201
    _, theirs = log(org["emp2_token"], pid, hours=2, note="Pairing")
    # members see only their own (userId is ignored); managers/admins see all and can filter
    status, body = call("GET", f"/api/v1/projects/{pid}/time-entries?userId={org['emp2']['id']}", token=e1)
    assert status == 200 and [e["id"] for e in body["items"]] == [mine["id"]]
    status, body = call("GET", f"/api/v1/projects/{pid}/time-entries", token=m)
    assert {e["id"] for e in body["items"]} == {mine["id"], theirs["id"]} and body["total"] == 2
    paged = call("GET", f"/api/v1/projects/{pid}/time-entries?limit=1&offset=1", token=m)[1]
    assert paged["total"] == 2 and len(paged["items"]) == 1 and paged["limit"] == 1 and paged["offset"] == 1
    status, body = call("GET", f"/api/v1/projects/{pid}/time-entries?userId={org['emp2']['id']}", token=org["admin"])
    assert [e["id"] for e in body["items"]] == [theirs["id"]]
    assert call("GET", f"/api/v1/projects/{pid}/time-entries?from=bad", token=m)[0] == 400
    assert call("GET", f"/api/v1/projects/{pid}/time-entries", token=org["mgr2_token"])[0] == 403
    # edit: author only (manager cannot edit someone's hours)
    assert call("PATCH", f"/api/v1/time-entries/{mine['id']}", {"hours": 5}, token=m)[0] == 403
    assert call("PATCH", f"/api/v1/time-entries/{mine['id']}", {}, token=e1)[0] == 400
    status, body = call("PATCH", f"/api/v1/time-entries/{mine['id']}", {"hours": 5, "note": "Fixed"}, token=e1)
    assert status == 200 and body["hours"] == 5 and body["note"] == "Fixed"
    status, body = call(
        "PATCH", f"/api/v1/time-entries/{mine['id']}", {"entryDate": (TODAY + timedelta(days=3)).isoformat()}, token=e1
    )
    assert status == 400
    # delete: author, manager or admin; not another member
    assert call("DELETE", f"/api/v1/time-entries/{theirs['id']}", token=e1)[0] == 403
    assert call("DELETE", f"/api/v1/time-entries/{theirs['id']}", token=m)[0] == 204
    assert call("DELETE", f"/api/v1/time-entries/{theirs['id']}", token=m)[0] == 404
    assert call("DELETE", f"/api/v1/time-entries/{mine['id']}", token=e1)[0] == 204
    rows = db.query("SELECT action FROM audit_log WHERE action LIKE %s ORDER BY id", ("time_entry.%",))
    assert [r["action"] for r in rows] == [
        "time_entry.create",
        "time_entry.create",
        "time_entry.update",
        "time_entry.delete",
        "time_entry.delete",
    ]


def test_frozen_projects_reject_time():
    org = setup_org()
    pid, e1 = org["pid"], org["emp1_token"]
    _, entry = log(e1, pid, hours=1)
    assert call("POST", f"/api/v1/projects/{pid}/archive", token=org["admin"])[0] == 200
    assert call("PATCH", f"/api/v1/time-entries/{entry['id']}", {"hours": 2}, token=e1)[0] == 409
    assert call("DELETE", f"/api/v1/time-entries/{entry['id']}", token=org["admin"])[0] == 409
    assert call("POST", f"/api/v1/projects/{pid}/unarchive", token=org["admin"])[0] == 200
    assert call("POST", f"/api/v1/projects/{pid}/complete", token=org["mgr_token"])[0] == 200
    assert log(e1, pid)[0] == 409  # emp1 was released on completion but still sees the project
    assert call("PATCH", f"/api/v1/time-entries/{entry['id']}", {"hours": 2}, token=e1)[0] == 409
