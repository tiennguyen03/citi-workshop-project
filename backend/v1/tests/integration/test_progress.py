"""Goals measure work, hours measure time, salary × logged hours measures cost (D27), through the API."""

from decimal import Decimal

from tests.integration.helpers import call, login
from tests.integration.test_projects import create_project, make_user


def _org():
    admin, _ = login()
    mgr = make_user(admin, "mgr", "manager")
    emp = make_user(admin, "emp", "employee", mgr["id"])  # salary 104000 → $50/h
    return admin, mgr, emp, login("mgr", "Password1!")[0], login("emp", "Password1!")[0]


def _progress(body):
    return (body["completedGoals"], body["totalGoals"], body["progressPercent"])


def test_goal_progress_is_the_same_number_on_every_shape():
    admin, mgr, emp, mgr_token, emp_token = _org()
    pid = create_project(admin, mgr["id"])["id"]
    assert (
        call("POST", f"/api/v1/projects/{pid}/members", {"userId": emp["id"], "hoursAssigned": 120}, token=mgr_token)[0]
        == 201
    )

    # no goals yet: unconfigured, not 0 %
    listed = call("GET", "/api/v1/projects", token=mgr_token)[1]["items"][0]
    assert _progress(listed) == (0, 0, None)
    assert _progress(call("GET", f"/api/v1/projects/{pid}", token=mgr_token)[1]) == (0, 0, None)

    # two milestones, three goals, one done → 1 / 3 = 33 %
    ms1 = call(
        "POST",
        f"/api/v1/projects/{pid}/milestones",
        {"name": "Phase 1", "startDate": "2026-10-05", "dueDate": "2026-10-16", "assigneeIds": [emp["id"]]},
        token=mgr_token,
    )[1]
    ms2 = call(
        "POST",
        f"/api/v1/projects/{pid}/milestones",
        {"name": "Phase 2", "startDate": "2026-10-19", "dueDate": "2026-10-30", "assigneeIds": []},
        token=mgr_token,
    )[1]
    g1 = call(
        "POST",
        f"/api/v1/milestones/{ms1['id']}/goals",
        {"title": "Inventory", "assigneeId": emp["id"]},
        token=mgr_token,
    )[1]
    g2 = call("POST", f"/api/v1/milestones/{ms1['id']}/goals", {"title": "Tagging"}, token=mgr_token)[1]
    g3 = call("POST", f"/api/v1/milestones/{ms2['id']}/goals", {"title": "Power down"}, token=mgr_token)[1]
    assert call("PATCH", f"/api/v1/goals/{g1['id']}", {"isDone": True}, token=emp_token)[0] == 200
    shapes = [
        call("GET", "/api/v1/projects", token=mgr_token)[1]["items"][0],
        call("GET", f"/api/v1/projects/{pid}", token=mgr_token)[1],
        call("GET", f"/api/v1/projects/{pid}/stats", token=mgr_token)[1],
        call("GET", f"/api/v1/projects/{pid}", token=emp_token)[1],  # the employee sees the same number
    ]
    assert all(_progress(s) == (1, 3, 33) for s in shapes)

    # hours do not move it: logging 10 h changes capacity used and cost, not progress
    assert (
        call("POST", f"/api/v1/projects/{pid}/time-entries", {"entryDate": "2026-10-06", "hours": 10}, token=emp_token)[
            0
        ]
        == 201
    )
    detail = call("GET", f"/api/v1/projects/{pid}", token=mgr_token)[1]
    assert _progress(detail) == (1, 3, 33) and detail["hoursCompleted"] == 10 and detail["capacityHours"] == 160
    assert Decimal(str(detail["costConsumed"])) == Decimal("500")  # 10 h × 104000 / 2080

    # raising the allocation changes neither cost nor progress: cost is logged hours only
    assert (
        call("PATCH", f"/api/v1/projects/{pid}/members/{emp['id']}", {"hoursAssigned": 160}, token=mgr_token)[0] == 200
    )
    detail = call("GET", f"/api/v1/projects/{pid}", token=mgr_token)[1]
    assert (
        detail["hoursAssigned"] == 160
        and Decimal(str(detail["costConsumed"])) == Decimal("500")
        and _progress(detail) == (1, 3, 33)
    )

    # all goals done → 100 %, but an open milestone still blocks completing the project
    for g in (g2, g3):
        assert call("PATCH", f"/api/v1/goals/{g['id']}", {"isDone": True}, token=mgr_token)[0] == 200
    assert _progress(call("GET", f"/api/v1/projects/{pid}", token=mgr_token)[1]) == (3, 3, 100)
    status, body = call("POST", f"/api/v1/projects/{pid}/complete", token=mgr_token)
    assert status == 409 and body["error"]["details"]["openMilestones"] == 2
    assert call("GET", f"/api/v1/projects/{pid}", token=mgr_token)[1]["status"] == "active"
