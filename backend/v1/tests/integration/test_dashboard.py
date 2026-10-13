"""The role-shaped dashboard payloads, built on the seeded-style office created through the API."""

from datetime import date, timedelta

from tests.integration.helpers import call, login
from tests.integration.test_projects import create_project, make_user

TODAY = date.today()


def setup_org():
    admin, _ = login()
    mgr = make_user(admin, "mgr", "manager")
    emp1 = make_user(admin, "emp1", "employee", mgr["id"], salary=208000)  # 100 $/h
    emp2 = make_user(admin, "emp2", "employee", mgr["id"])
    mgr_token = login("mgr", "Password1!")[0]
    emp1_token = login("emp1", "Password1!")[0]
    project = create_project(
        admin,
        mgr["id"],
        budget=500,
        startDate=(TODAY - timedelta(days=10)).isoformat(),
        endDate=(TODAY + timedelta(days=10)).isoformat(),
    )
    pid = project["id"]
    assert (
        call("POST", f"/api/v1/projects/{pid}/members", {"userId": emp1["id"], "hoursAssigned": 40}, token=mgr_token)[0]
        == 201
    )
    status, ms = call(
        "POST",
        f"/api/v1/projects/{pid}/milestones",
        {
            "name": "Phase 1",
            "startDate": project["startDate"],
            "dueDate": project["endDate"],
            "assigneeIds": [emp1["id"]],
        },
        token=mgr_token,
    )
    assert status == 201
    status, goal = call(
        "POST",
        f"/api/v1/milestones/{ms['id']}/goals",
        {"title": "Do the thing", "assigneeId": emp1["id"]},
        token=mgr_token,
    )
    assert status == 201
    # 6 h today → 600 $ consumed on a 500 $ budget → over budget
    assert (
        call(
            "POST",
            f"/api/v1/projects/{pid}/time-entries",
            {"entryDate": TODAY.isoformat(), "hours": 6},
            token=emp1_token,
        )[0]
        == 201
    )
    return {
        "admin": admin,
        "mgr": mgr,
        "mgr_token": mgr_token,
        "emp1": emp1,
        "emp1_token": emp1_token,
        "emp2": emp2,
        "pid": pid,
        "ms": ms,
        "goal": goal,
    }


def test_admin_dashboard():
    org = setup_org()
    status, body = call("GET", "/api/v1/dashboard", token=org["admin"])
    assert status == 200 and body["role"] == "admin"
    assert body["stats"] == {
        "activeProjects": 1,
        "completeProjects": 0,
        "archivedProjects": 0,
        "users": {"admin": 1, "manager": 1, "employee": 2},
        "availableEmployees": 1,
    }
    assert [a["id"] for a in body["attention"]] == [org["pid"]]
    assert body["attention"][0]["reasons"] == ["over_budget"] and body["attention"][0]["budgetRemaining"] == -100


def test_manager_dashboard():
    org = setup_org()
    status, body = call("GET", "/api/v1/dashboard", token=org["mgr_token"])
    assert status == 200 and body["role"] == "manager"
    (card,) = body["projects"]
    assert card["id"] == org["pid"] and card["hoursCompleted"] == 6 and card["budgetRemaining"] == -100
    assert card["milestoneCounts"] == {"open": 1, "complete": 0} and card["reasons"] == ["over_budget"]
    team = {t["user"]["id"]: t for t in body["team"]}
    assert (
        team[org["emp1"]["id"]]["currentProject"]["id"] == org["pid"] and team[org["emp1"]["id"]]["hoursThisWeek"] == 6
    )
    assert team[org["emp2"]["id"]]["currentProject"] is None and team[org["emp2"]["id"]]["hoursThisWeek"] == 0
    assert body["week"]["start"] <= TODAY.isoformat() <= body["week"]["end"]


def test_employee_dashboard():
    org = setup_org()
    status, body = call("GET", "/api/v1/dashboard", token=org["emp1_token"])
    assert status == 200 and body["role"] == "employee"
    current = body["currentProject"]
    assert current["id"] == org["pid"] and "budget" not in current
    assert current["myHoursAssigned"] == 40 and current["myHoursCompleted"] == 6
    assert current["currentMilestone"] == {"id": org["ms"]["id"], "name": "Phase 1"}
    assert [g["id"] for g in body["openGoals"]] == [org["goal"]["id"]]
    assert (
        body["openGoals"][0]["milestone"]["name"] == "Phase 1" and body["openGoals"][0]["project"]["id"] == org["pid"]
    )
    assert body["hoursThisWeek"] == 6 and body["pastProjects"] == []
    # ticking the goal removes it; completing the project moves it to past projects
    assert call("PATCH", f"/api/v1/goals/{org['goal']['id']}", {"isDone": True}, token=org["emp1_token"])[0] == 200
    assert call("POST", f"/api/v1/milestones/{org['ms']['id']}/complete", token=org["mgr_token"])[0] == 200
    assert call("POST", f"/api/v1/projects/{org['pid']}/complete", token=org["mgr_token"])[0] == 200
    status, body = call("GET", "/api/v1/dashboard", token=org["emp1_token"])
    assert body["currentProject"] is None and body["openGoals"] == []
    assert [p["id"] for p in body["pastProjects"]] == [org["pid"]] and body["pastProjects"][0]["status"] == "complete"
    # an employee with nothing at all
    status, body = call("GET", "/api/v1/dashboard", token=login("emp2", "Password1!")[0])
    assert body["currentProject"] is None and body["pastProjects"] == [] and body["hoursThisWeek"] == 0
