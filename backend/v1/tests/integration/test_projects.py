"""Projects end to end: scoping, lifecycle, membership rules (M8/D15), capacity math, audit rows."""

from decimal import Decimal

import pytest

from app.core import db
from tests.integration.helpers import call, login

PROJECT = {
    "name": "Decommission 1,000 Servers",
    "description": "Phase out the legacy fleet",
    "budget": 250000,
    "startDate": "2026-10-05",  # Monday
    "endDate": "2026-10-30",  # Friday -> 20 working days -> 160 h per member
    "managerId": None,
}


def make_user(token, username, role, manager_id=None, salary=104000):
    status, body = call(
        "POST",
        "/api/v1/users",
        {
            "username": username,
            "password": "Password1!",
            "firstName": username.title(),
            "lastName": "Test",
            "email": f"{username}@example.com",
            "jobTitle": role.title(),
            "salary": salary,
            "role": role,
            **({"managerId": manager_id} if manager_id else {}),
        },
        token=token,
    )
    assert status == 201, body
    return body


@pytest.fixture
def org():
    admin, _ = login()
    mgr = make_user(admin, "mgr", "manager")
    mgr2 = make_user(admin, "mgr2", "manager")
    emp1 = make_user(admin, "emp1", "employee", mgr["id"])
    emp2 = make_user(admin, "emp2", "employee", mgr["id"])
    emp3 = make_user(admin, "emp3", "employee", mgr2["id"])
    return {
        "admin": admin,
        "mgr": mgr,
        "mgr2": mgr2,
        "emp1": emp1,
        "emp2": emp2,
        "emp3": emp3,
        "mgr_token": login("mgr", "Password1!")[0],
        "mgr2_token": login("mgr2", "Password1!")[0],
        "emp1_token": login("emp1", "Password1!")[0],
    }


def create_project(token, manager_id, **overrides):
    status, body = call("POST", "/api/v1/projects", {**PROJECT, "managerId": manager_id, **overrides}, token=token)
    assert status == 201, body
    return body


def test_create_requires_admin_and_valid_input(org):
    assert (
        call("POST", "/api/v1/projects", {**PROJECT, "managerId": org["mgr"]["id"]}, token=org["mgr_token"])[0] == 403
    )
    status, body = call("POST", "/api/v1/projects", {**PROJECT, "managerId": org["emp1"]["id"]}, token=org["admin"])
    assert status == 400 and body["error"]["details"]["field"] == "managerId"
    status, body = call(
        "POST",
        "/api/v1/projects",
        {**PROJECT, "managerId": org["mgr"]["id"], "endDate": "2026-01-01"},
        token=org["admin"],
    )
    assert status == 400
    project = create_project(org["admin"], org["mgr"]["id"])
    assert project["capacityHours"] == 0 and project["memberCount"] == 0
    assert project["budget"] == 250000 and project["budgetRemaining"] == 250000
    status, body = call("POST", "/api/v1/projects", {**PROJECT, "managerId": org["mgr"]["id"]}, token=org["admin"])
    assert status == 409 and body["error"]["details"]["field"] == "name"
    row = db.query_one("SELECT action, project_id, entity_id FROM audit_log WHERE action = 'project.create'")
    assert row["project_id"] == project["id"] == row["entity_id"]


def test_visibility_and_cost_hiding(org):
    project = create_project(org["admin"], org["mgr"]["id"])
    pid = project["id"]
    # manager sees costs; other manager cannot see it; employee not on it cannot see it
    status, body = call("GET", f"/api/v1/projects/{pid}", token=org["mgr_token"])
    assert status == 200 and "budget" in body
    assert call("GET", f"/api/v1/projects/{pid}", token=org["mgr2_token"])[0] == 403
    assert call("GET", f"/api/v1/projects/{pid}", token=org["emp1_token"])[0] == 403
    # add emp1 -> visible, no money
    status, member = call(
        "POST",
        f"/api/v1/projects/{pid}/members",
        {"userId": org["emp1"]["id"], "hoursAssigned": 100},
        token=org["mgr_token"],
    )
    assert status == 201, member
    status, body = call("GET", f"/api/v1/projects/{pid}", token=org["emp1_token"])
    assert status == 200 and "budget" not in body and "costConsumed" not in body
    assert body["myMembership"]["isActive"] is True and body["myMembership"]["hoursAssigned"] == 100
    assert body["capacityHours"] == 160 and body["hoursAssigned"] == 100
    status, body = call("GET", "/api/v1/projects", token=org["emp1_token"])
    assert status == 200 and [p["id"] for p in body["items"]] == [pid]
    status, body = call("GET", "/api/v1/projects", token=org["mgr2_token"])
    assert body["items"] == []


def test_project_list_pages_and_searches(org):
    for name in ("Alpha migration", "Beta portal", "Gamma cleanup"):
        create_project(org["admin"], org["mgr"]["id"], name=name)
    first = call("GET", "/api/v1/projects?limit=2", token=org["admin"])[1]
    assert first["total"] == 3 and len(first["items"]) == 2 and first["limit"] == 2 and first["offset"] == 0
    second = call("GET", "/api/v1/projects?limit=2&offset=2", token=org["admin"])[1]
    assert len(second["items"]) == 1 and {p["name"] for p in first["items"] + second["items"]} == {
        "Alpha migration",
        "Beta portal",
        "Gamma cleanup",
    }
    assert [p["name"] for p in call("GET", "/api/v1/projects?q=portal", token=org["admin"])[1]["items"]] == [
        "Beta portal"
    ]
    # the manager's name is searchable too, and the manager only ever sees their own projects
    by_manager = call("GET", f"/api/v1/projects?q={org['mgr']['lastName'].lower()}", token=org["mgr_token"])[1]
    assert by_manager["total"] == 3
    assert call("GET", "/api/v1/projects?q=portal", token=org["mgr2_token"])[1]["total"] == 0
    assert call("GET", "/api/v1/projects?limit=0", token=org["admin"])[1]["limit"] == 25


def test_member_rules(org):
    pid = create_project(org["admin"], org["mgr"]["id"])["id"]
    other = create_project(org["admin"], org["mgr2"]["id"], name="Other")["id"]
    m = org["mgr_token"]
    # manager can only add own reports; admin can add anyone
    status, body = call("POST", f"/api/v1/projects/{pid}/members", {"userId": org["emp3"]["id"]}, token=m)
    assert status == 403
    status, body = call("POST", f"/api/v1/projects/{pid}/members", {"userId": org["emp3"]["id"]}, token=org["admin"])
    assert status == 201
    # hours above capacity per member
    status, body = call(
        "POST", f"/api/v1/projects/{pid}/members", {"userId": org["emp1"]["id"], "hoursAssigned": 161}, token=m
    )
    assert status == 400 and body["error"]["details"]["field"] == "hoursAssigned"
    assert (
        call("POST", f"/api/v1/projects/{pid}/members", {"userId": org["emp1"]["id"], "hoursAssigned": 160}, token=m)[0]
        == 201
    )
    # already a member
    assert call("POST", f"/api/v1/projects/{pid}/members", {"userId": org["emp1"]["id"]}, token=m)[0] == 409
    # one active project per employee
    status, body = call(
        "POST", f"/api/v1/projects/{other}/members", {"userId": org["emp1"]["id"]}, token=org["mgr2_token"]
    )
    assert status == 403  # not mgr2's report
    status, body = call("POST", f"/api/v1/projects/{other}/members", {"userId": org["emp1"]["id"]}, token=org["admin"])
    assert (
        status == 409 and body["error"]["code"] == "PROJECT_CONFLICT" and body["error"]["details"]["projectId"] == pid
    )
    # available members: emp2 only for mgr (emp1 busy, emp3 not a report)
    status, body = call("GET", f"/api/v1/projects/{pid}/available-members", token=m)
    assert [u["id"] for u in body["items"]] == [org["emp2"]["id"]]
    status, body = call("GET", f"/api/v1/projects/{other}/available-members", token=org["admin"])
    assert [u["id"] for u in body["items"]] == [org["emp2"]["id"]]
    # release emp1 -> row kept, now available, re-addable elsewhere
    assert call("DELETE", f"/api/v1/projects/{pid}/members/{org['emp1']['id']}", token=m)[0] == 204
    status, body = call("GET", f"/api/v1/projects/{pid}/members?includeReleased=true", token=m)
    released = next(x for x in body["items"] if x["user"]["id"] == org["emp1"]["id"])
    assert released["isActive"] is False and released["releasedReason"] == "removed"
    status, body = call("GET", f"/api/v1/projects/{pid}/members", token=m)
    assert org["emp1"]["id"] not in {x["user"]["id"] for x in body["items"]}
    assert (
        call("POST", f"/api/v1/projects/{other}/members", {"userId": org["emp1"]["id"]}, token=org["admin"])[0] == 201
    )
    # emp1 still sees the project they were released from (read-only), with release info
    status, body = call("GET", f"/api/v1/projects/{pid}", token=org["emp1_token"])
    assert status == 200 and body["myMembership"]["isActive"] is False
    # update hours; unknown field rejected
    status, body = call(
        "PATCH", f"/api/v1/projects/{pid}/members/{org['emp3']['id']}", {"hoursAssigned": 40}, token=org["admin"]
    )
    assert status == 200 and body["hoursAssigned"] == 40
    assert (
        call("PATCH", f"/api/v1/projects/{pid}/members/{org['emp3']['id']}", {"salary": 1}, token=org["admin"])[0]
        == 400
    )
    actions = [r["action"] for r in db.query("SELECT action FROM audit_log WHERE project_id = %s ORDER BY id", (pid,))]
    assert actions == [
        "project.create",
        "project.member_add",
        "project.member_add",
        "project.member_remove",
        "project.member_update",
    ]


def test_update_rules(org):
    pid = create_project(org["admin"], org["mgr"]["id"])["id"]
    m = org["mgr_token"]
    status, body = call("PATCH", f"/api/v1/projects/{pid}", {"budget": 300000, "description": "x"}, token=m)
    assert status == 200 and body["budget"] == 300000
    assert call("PATCH", f"/api/v1/projects/{pid}", {"managerId": org["mgr2"]["id"]}, token=m)[0] == 403
    status, body = call("PATCH", f"/api/v1/projects/{pid}", {"managerId": org["mgr2"]["id"]}, token=org["admin"])
    assert status == 200 and body["manager"]["id"] == org["mgr2"]["id"]
    assert call("PATCH", f"/api/v1/projects/{pid}", {"budget": 1}, token=m)[0] == 403  # no longer their project
    status, body = call("PATCH", f"/api/v1/projects/{pid}", {"endDate": "2026-01-01"}, token=org["admin"])
    assert status == 400 and body["error"]["details"]["field"] == "endDate"
    assert call("PATCH", f"/api/v1/projects/{pid}", {"status": "complete"}, token=org["admin"])[0] == 400


def test_lifecycle_complete_archive_unarchive(org):
    pid = create_project(org["admin"], org["mgr"]["id"])["id"]
    m, a = org["mgr_token"], org["admin"]
    assert (
        call("POST", f"/api/v1/projects/{pid}/members", {"userId": org["emp1"]["id"], "hoursAssigned": 80}, token=m)[0]
        == 201
    )
    # open milestone blocks completion
    db.execute(
        "INSERT INTO milestones (id, project_id, name, start_date, due_date) VALUES ('MS0001', %s, 'M1', '2026-10-05', '2026-10-09')",
        (pid,),
    )
    status, body = call("POST", f"/api/v1/projects/{pid}/complete", token=m)
    assert status == 409 and body["error"]["details"]["openMilestones"] == 1
    db.execute("UPDATE milestones SET status = 'complete' WHERE id = 'MS0001'")

    # archive (admin only) releases members; non-admins can no longer see it
    assert call("POST", f"/api/v1/projects/{pid}/archive", token=m)[0] == 403
    status, body = call("POST", f"/api/v1/projects/{pid}/archive", token=a)
    assert status == 200 and body["archived"] is True
    assert call("GET", f"/api/v1/projects/{pid}", token=m)[0] == 404
    assert call("GET", f"/api/v1/projects/{pid}", token=org["emp1_token"])[0] == 404
    assert call("PATCH", f"/api/v1/projects/{pid}", {"budget": 1}, token=a)[0] == 409  # archived => read-only
    status, body = call("GET", "/api/v1/projects?archived=true", token=a)
    assert [p["id"] for p in body["items"]] == [pid]
    assert call("GET", "/api/v1/projects?archived=true", token=m)[0] == 403
    released = db.query_one("SELECT is_active, released_reason FROM project_members WHERE project_id = %s", (pid,))
    assert released["is_active"] is False and released["released_reason"] == "archived"

    # while archived, emp1 joins another project -> unarchive is blocked and names them
    other = create_project(a, org["mgr"]["id"], name="Other")["id"]
    assert call("POST", f"/api/v1/projects/{other}/members", {"userId": org["emp1"]["id"]}, token=m)[0] == 201
    status, body = call("POST", f"/api/v1/projects/{pid}/unarchive", token=a)
    assert (
        status == 409
        and body["error"]["code"] == "PROJECT_CONFLICT"
        and body["error"]["details"]["userIds"] == [org["emp1"]["id"]]
    )
    # free them up -> unarchive re-claims them
    assert call("DELETE", f"/api/v1/projects/{other}/members/{org['emp1']['id']}", token=m)[0] == 204
    status, body = call("POST", f"/api/v1/projects/{pid}/unarchive", token=a)
    assert status == 200 and body["archived"] is False and body["memberCount"] == 1

    # complete: members released with reason 'completed' but still counted in capacity
    status, body = call("POST", f"/api/v1/projects/{pid}/complete", token=m)
    assert status == 200 and body["status"] == "complete" and body["memberCount"] == 1 and body["capacityHours"] == 160
    assert call("POST", f"/api/v1/projects/{pid}/complete", token=m)[0] == 409
    assert call("POST", f"/api/v1/projects/{pid}/members", {"userId": org["emp2"]["id"]}, token=m)[0] == 409
    # emp1 is available again
    status, body = call("GET", f"/api/v1/projects/{other}/available-members", token=m)
    assert org["emp1"]["id"] in {u["id"] for u in body["items"]}


def test_stats_and_cost_math(org):
    pid = create_project(org["admin"], org["mgr"]["id"])["id"]
    assert (
        call(
            "POST",
            f"/api/v1/projects/{pid}/members",
            {"userId": org["emp1"]["id"], "hoursAssigned": 120},
            token=org["mgr_token"],
        )[0]
        == 201
    )
    # emp1 salary 104000 -> $50/h ; log 10 h directly (time entry endpoints arrive in slice 5)
    db.execute(
        "INSERT INTO time_entries (id, project_id, user_id, entry_date, hours) VALUES ('TE0001', %s, %s, '2026-10-06', 10)",
        (pid, org["emp1"]["id"]),
    )
    status, body = call("GET", f"/api/v1/projects/{pid}/stats", token=org["mgr_token"])
    assert status == 200
    assert body["capacityHours"] == 160 and body["hoursAssigned"] == 120 and body["hoursCompleted"] == 10
    assert Decimal(str(body["costConsumed"])) == Decimal("500") and Decimal(str(body["budgetRemaining"])) == Decimal(
        "249500"
    )
    member = body["perMember"][0]
    assert member["hoursCompleted"] == 10 and Decimal(str(member["costConsumed"])) == Decimal("500")
    status, body = call("GET", f"/api/v1/projects/{pid}/stats", token=org["emp1_token"])
    assert status == 200 and "budget" not in body and "costConsumed" not in body["perMember"][0]
