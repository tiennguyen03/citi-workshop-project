"""Milestones & goals end to end: visibility, the one-open-milestone rule (M13a/D14), lifecycle, goals, audit."""

from app.core import db
from tests.integration.helpers import call, login
from tests.integration.test_projects import create_project, make_user

MILESTONE = {
    "name": "Inventory",
    "description": "Catalogue every server",
    "startDate": "2026-10-05",
    "dueDate": "2026-10-16",
}


def setup_org():
    admin, _ = login()
    mgr = make_user(admin, "mgr", "manager")
    make_user(admin, "mgr2", "manager")
    emp1 = make_user(admin, "emp1", "employee", mgr["id"])
    emp2 = make_user(admin, "emp2", "employee", mgr["id"])
    emp3 = make_user(admin, "emp3", "employee", mgr["id"])
    mgr_token = login("mgr", "Password1!")[0]
    project = create_project(admin, mgr["id"])
    for emp in (emp1, emp2):
        status, _ = call(
            "POST",
            f"/api/v1/projects/{project['id']}/members",
            {"userId": emp["id"], "hoursAssigned": 80},
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
        "emp3": emp3,  # not on the project
        "pid": project["id"],
    }


def create_milestone(token, pid, **overrides):
    status, body = call("POST", f"/api/v1/projects/{pid}/milestones", {**MILESTONE, **overrides}, token=token)
    assert status == 201, body
    return body


def test_members_list_shows_each_persons_open_milestone():
    org = setup_org()
    ms = create_milestone(org["mgr_token"], org["pid"], assigneeIds=[org["emp1"]["id"]])
    status, body = call("GET", f"/api/v1/projects/{org['pid']}/members", token=org["mgr_token"])
    assert status == 200
    by_user = {m["user"]["id"]: m for m in body["items"]}
    assert by_user[org["emp1"]["id"]]["currentMilestone"] == {"id": ms["id"], "name": ms["name"]}
    assert by_user[org["emp2"]["id"]]["currentMilestone"] is None
    # completing it frees the person again
    assert call("POST", f"/api/v1/milestones/{ms['id']}/complete", token=org["mgr_token"])[0] == 200
    status, body = call("GET", f"/api/v1/projects/{org['pid']}/members", token=org["emp1_token"])
    assert all(m["currentMilestone"] is None for m in body["items"])


def test_create_validation_and_permissions():
    org = setup_org()
    pid, m = org["pid"], org["mgr_token"]
    assert call("POST", f"/api/v1/projects/{pid}/milestones", MILESTONE, token=org["mgr2_token"])[0] == 403
    assert call("POST", f"/api/v1/projects/{pid}/milestones", MILESTONE, token=org["emp1_token"])[0] == 403
    # dates must sit inside the project (2026-10-05 .. 2026-10-30)
    status, body = call("POST", f"/api/v1/projects/{pid}/milestones", {**MILESTONE, "startDate": "2026-10-01"}, token=m)
    assert status == 400 and body["error"]["details"]["field"] == "startDate"
    status, body = call("POST", f"/api/v1/projects/{pid}/milestones", {**MILESTONE, "dueDate": "2026-11-02"}, token=m)
    assert status == 400 and body["error"]["details"]["field"] == "dueDate"
    status, body = call("POST", f"/api/v1/projects/{pid}/milestones", {**MILESTONE, "dueDate": "2026-10-01"}, token=m)
    assert status == 400
    # assignees must be active members
    status, body = call(
        "POST", f"/api/v1/projects/{pid}/milestones", {**MILESTONE, "assigneeIds": [org["emp3"]["id"]]}, token=m
    )
    assert status == 400 and body["error"]["details"]["field"] == "assigneeIds"
    assert body["error"]["details"]["userIds"] == [org["emp3"]["id"]]
    # happy path
    ms = create_milestone(m, pid, assigneeIds=[org["emp1"]["id"], org["emp1"]["id"]])
    assert ms["status"] == "open" and ms["sortOrder"] == 1 and ms["goalsTotal"] == 0
    assert [a["id"] for a in ms["assignees"]] == [org["emp1"]["id"]]
    row = db.query_one("SELECT entity_type, entity_id, project_id FROM audit_log WHERE action = 'milestone.create'")
    assert row == {"entity_type": "milestone", "entity_id": ms["id"], "project_id": pid}
    # the project now counts one open milestone and cannot be completed
    status, project = call("GET", f"/api/v1/projects/{pid}", token=m)
    assert project["milestoneCounts"] == {"open": 1, "complete": 0}
    assert call("POST", f"/api/v1/projects/{pid}/complete", token=m)[0] == 409


def test_one_open_milestone_per_employee_per_project():
    org = setup_org()
    pid, m, e1 = org["pid"], org["mgr_token"], org["emp1"]["id"]
    first = create_milestone(m, pid, assigneeIds=[e1])
    # second open milestone with the same person -> 409 naming the blocker
    status, body = call(
        "POST", f"/api/v1/projects/{pid}/milestones", {**MILESTONE, "name": "Second", "assigneeIds": [e1]}, token=m
    )
    assert status == 409 and body["error"]["code"] == "MILESTONE_CONFLICT"
    assert body["error"]["details"]["userIds"] == [e1] and body["error"]["details"]["milestoneId"] == first["id"]
    assert body["error"]["details"]["conflicts"][0]["milestoneName"] == "Inventory"
    # available-assignees: emp1 busy (with the milestone that holds them), emp2 free
    status, body = call("GET", f"/api/v1/projects/{pid}/available-assignees", token=m)
    assert status == 200 and [u["id"] for u in body["items"]] == [org["emp2"]["id"]]
    assert body["busy"] == [{"user": body["busy"][0]["user"], "milestone": {"id": first["id"], "name": "Inventory"}}]
    # ...unless asking for the milestone they are already on
    status, body = call("GET", f"/api/v1/projects/{pid}/available-assignees?milestoneId={first['id']}", token=m)
    assert {u["id"] for u in body["items"]} == {e1, org["emp2"]["id"]} and body["busy"] == []
    assert call("GET", f"/api/v1/projects/{pid}/available-assignees", token=org["emp1_token"])[0] == 403
    # PATCH adding a busy person also conflicts; PATCH keeping existing assignees does not
    second = create_milestone(m, pid, name="Second")
    status, body = call("PATCH", f"/api/v1/milestones/{second['id']}", {"assigneeIds": [e1]}, token=m)
    assert status == 409 and body["error"]["code"] == "MILESTONE_CONFLICT"
    status, body = call(
        "PATCH", f"/api/v1/milestones/{first['id']}", {"assigneeIds": [e1], "name": "Inventory v2"}, token=m
    )
    assert status == 200 and body["name"] == "Inventory v2"
    # completing the first frees emp1 for the second
    status, body = call("POST", f"/api/v1/milestones/{first['id']}/complete", token=m)
    assert (
        status == 200 and body["status"] == "complete" and body["completedAt"] and body["details"] == {"openGoals": 0}
    )
    status, body = call("PATCH", f"/api/v1/milestones/{second['id']}", {"assigneeIds": [e1]}, token=m)
    assert status == 200 and [a["id"] for a in body["assignees"]] == [e1]
    # the partial index agrees: only one open row for emp1 in this project
    rows = db.query("SELECT milestone_id, is_open FROM milestone_assignees WHERE user_id = %s ORDER BY is_open", (e1,))
    assert [(r["milestone_id"], r["is_open"]) for r in rows] == [(first["id"], False), (second["id"], True)]
    # reopening the first now clashes (emp1 is on the second)
    status, body = call("POST", f"/api/v1/milestones/{first['id']}/reopen", token=m)
    assert status == 409 and body["error"]["code"] == "MILESTONE_CONFLICT"
    assert call("POST", f"/api/v1/milestones/{second['id']}/complete", token=m)[0] == 200
    status, body = call("POST", f"/api/v1/milestones/{first['id']}/reopen", token=m)
    assert status == 200 and body["status"] == "open" and body["completedAt"] is None
    assert call("POST", f"/api/v1/milestones/{first['id']}/reopen", token=m)[0] == 409  # already open
    assert call("POST", f"/api/v1/milestones/{second['id']}/complete", token=m)[0] == 409  # already complete


def test_goals_permissions_and_lifecycle():
    org = setup_org()
    pid, m, e1, e2 = org["pid"], org["mgr_token"], org["emp1"]["id"], org["emp2"]["id"]
    ms = create_milestone(m, pid, assigneeIds=[e1])
    url = f"/api/v1/milestones/{ms['id']}/goals"
    # only manager/admin add goals; assignee must be on the milestone
    assert call("POST", url, {"title": "Export"}, token=org["emp1_token"])[0] == 403
    status, body = call("POST", url, {"title": "Export", "assigneeId": e2}, token=m)
    assert status == 400 and body["error"]["details"]["field"] == "assigneeId"
    status, g1 = call("POST", url, {"title": "Export CMDB", "assigneeId": e1}, token=m)
    assert status == 201 and g1["assignee"]["id"] == e1 and g1["isDone"] is False
    status, g2 = call("POST", url, {"title": "Tag servers"}, token=org["admin"])
    assert status == 201 and g2["assignee"] is None
    # the milestone reports its goals
    status, body = call("GET", f"/api/v1/milestones/{ms['id']}", token=org["emp1_token"])
    assert status == 200 and body["goalsTotal"] == 2 and body["goalsDone"] == 0 and len(body["goals"]) == 2
    assert call("GET", f"/api/v1/milestones/{ms['id']}", token=org["mgr2_token"])[0] == 403
    assert call("GET", "/api/v1/milestones/NOPE01", token=m)[0] == 404
    # ticking: assignee yes, other employee no, manager yes; renaming: assignee no
    status, body = call("PATCH", f"/api/v1/goals/{g1['id']}", {"isDone": True}, token=org["emp1_token"])
    assert status == 200 and body["isDone"] is True and body["doneAt"]
    assert call("PATCH", f"/api/v1/goals/{g2['id']}", {"isDone": True}, token=org["emp2_token"])[0] == 403
    assert call("PATCH", f"/api/v1/goals/{g1['id']}", {"title": "Renamed"}, token=org["emp1_token"])[0] == 403
    status, body = call("PATCH", f"/api/v1/goals/{g1['id']}", {"title": "Renamed", "isDone": False}, token=m)
    assert status == 200 and body["title"] == "Renamed" and body["isDone"] is False and body["doneAt"] is None
    assert call("PATCH", f"/api/v1/goals/{g1['id']}", {}, token=m)[0] == 400
    # completing with open goals warns but succeeds
    status, body = call("POST", f"/api/v1/milestones/{ms['id']}/complete", token=m)
    assert status == 200 and body["details"] == {"openGoals": 2}
    row = db.query_one("SELECT summary FROM audit_log WHERE action = 'milestone.complete'")
    assert "2 open goals" in row["summary"]
    # a complete milestone's goals are frozen until reopened
    assert call("PATCH", f"/api/v1/goals/{g1['id']}", {"isDone": True}, token=m)[0] == 409
    assert call("POST", url, {"title": "Late"}, token=m)[0] == 409
    assert call("DELETE", f"/api/v1/goals/{g2['id']}", token=m)[0] == 409
    assert call("POST", f"/api/v1/milestones/{ms['id']}/reopen", token=m)[0] == 200
    # delete: manager only; audit row carries the project
    assert call("DELETE", f"/api/v1/goals/{g2['id']}", token=org["emp1_token"])[0] == 403
    assert call("DELETE", f"/api/v1/goals/{g2['id']}", token=m)[0] == 204
    assert call("DELETE", f"/api/v1/goals/{g2['id']}", token=m)[0] == 404
    rows = db.query("SELECT action, project_id FROM audit_log WHERE action LIKE %s ORDER BY id", ("goal.%",))
    assert [r["action"] for r in rows] == ["goal.create", "goal.create", "goal.update", "goal.update", "goal.delete"]
    assert {r["project_id"] for r in rows} == {pid}


def test_removing_assignees_and_releasing_members_cascade():
    org = setup_org()
    pid, m, e1, e2 = org["pid"], org["mgr_token"], org["emp1"]["id"], org["emp2"]["id"]
    ms = create_milestone(m, pid, assigneeIds=[e1, e2])
    status, g1 = call("POST", f"/api/v1/milestones/{ms['id']}/goals", {"title": "A", "assigneeId": e1}, token=m)
    status, g2 = call("POST", f"/api/v1/milestones/{ms['id']}/goals", {"title": "B", "assigneeId": e2}, token=m)
    # dropping emp2 from the milestone unassigns their goal (M15)
    status, body = call("PATCH", f"/api/v1/milestones/{ms['id']}", {"assigneeIds": [e1]}, token=m)
    assert status == 200 and [a["id"] for a in body["assignees"]] == [e1]
    assert {g["id"]: g["assignee"] and g["assignee"]["id"] for g in body["goals"]} == {g1["id"]: e1, g2["id"]: None}
    # releasing emp1 from the project drops them from the milestone and their goals (M15)
    assert call("DELETE", f"/api/v1/projects/{pid}/members/{e1}", token=m)[0] == 204
    status, body = call("GET", f"/api/v1/milestones/{ms['id']}", token=m)
    assert body["assignees"] == [] and all(g["assignee"] is None for g in body["goals"])
    # list endpoint, ordering and employee visibility (emp2 is still a member)
    create_milestone(m, pid, name="Second")
    status, body = call("GET", f"/api/v1/projects/{pid}/milestones", token=org["emp2_token"])
    assert status == 200 and [x["name"] for x in body["items"]] == ["Inventory", "Second"]
    assert call("GET", f"/api/v1/projects/{pid}/milestones", token=org["mgr2_token"])[0] == 403


def test_frozen_projects_reject_writes():
    org = setup_org()
    pid, m = org["pid"], org["mgr_token"]
    ms = create_milestone(m, pid)
    status, goal = call("POST", f"/api/v1/milestones/{ms['id']}/goals", {"title": "A"}, token=m)
    assert call("POST", f"/api/v1/projects/{pid}/archive", token=org["admin"])[0] == 200
    assert call("POST", f"/api/v1/projects/{pid}/milestones", MILESTONE, token=m)[0] == 409
    assert call("PATCH", f"/api/v1/milestones/{ms['id']}", {"name": "x"}, token=org["admin"])[0] == 409
    assert call("POST", f"/api/v1/milestones/{ms['id']}/complete", token=org["admin"])[0] == 409
    assert call("PATCH", f"/api/v1/goals/{goal['id']}", {"isDone": True}, token=org["admin"])[0] == 409
    assert call("DELETE", f"/api/v1/goals/{goal['id']}", token=org["admin"])[0] == 409
    # archived projects are invisible to non-admins (404) — their milestones too
    assert call("GET", f"/api/v1/milestones/{ms['id']}", token=m)[0] == 404
    assert call("GET", f"/api/v1/milestones/{ms['id']}", token=org["admin"])[0] == 200
    assert call("POST", f"/api/v1/projects/{pid}/unarchive", token=org["admin"])[0] == 200
    # complete the milestone, then the project: nothing can be reopened afterwards
    assert call("POST", f"/api/v1/milestones/{ms['id']}/complete", token=m)[0] == 200
    assert call("POST", f"/api/v1/projects/{pid}/complete", token=m)[0] == 200
    status, body = call("POST", f"/api/v1/milestones/{ms['id']}/reopen", token=m)
    assert status == 409 and "complete" in body["error"]["message"]
    assert call("POST", f"/api/v1/projects/{pid}/milestones", MILESTONE, token=m)[0] == 409
