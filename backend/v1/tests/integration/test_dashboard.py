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
    # a second, unassigned milestone due in two days → the manager's "due soon" list
    status, soon = call(
        "POST",
        f"/api/v1/projects/{pid}/milestones",
        {
            "name": "Phase 0",
            "startDate": project["startDate"],
            "dueDate": (TODAY + timedelta(days=2)).isoformat(),
            "assigneeIds": [],
        },
        token=mgr_token,
    )
    assert status == 201
    # an empty second project for the same manager → "no members" + "no milestones" attention
    empty = create_project(admin, mgr["id"], name="Empty shell", budget=1000)
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
        "soon": soon,
        "empty": empty,
        "goal": goal,
    }


def test_admin_dashboard():
    org = setup_org()
    status, body = call("GET", "/api/v1/dashboard", token=org["admin"])
    assert status == 200 and body["role"] == "admin"
    # every live project, worst first: the over-budget one is at risk, the empty one needs setup
    assert [p["id"] for p in body["projects"]] == [org["pid"], org["empty"]["id"]]
    risky, empty = body["projects"]
    assert risky["health"] == "at_risk" and risky["reasons"] == ["over_budget"] and risky["budgetRemaining"] == -100
    assert risky["nextDueDate"] == (TODAY + timedelta(days=2)).isoformat()
    # work completion rides on every card, identical to the project detail (D27); the empty project is unconfigured
    assert (risky["completedGoals"], risky["totalGoals"], risky["progressPercent"]) == (0, 1, 0)
    assert (empty["completedGoals"], empty["totalGoals"], empty["progressPercent"]) == (0, 0, None)
    assert risky["manager"] == {
        "id": org["mgr"]["id"],
        "firstName": org["mgr"]["firstName"],
        "lastName": org["mgr"]["lastName"],
    }
    assert empty["health"] == "needs_setup" and empty["reasons"] == ["no_members", "no_milestones"]
    assert empty["nextDueDate"] is None
    summary = body["summary"]
    assert summary["projects"] == {"late": 0, "atRisk": 1, "needsSetup": 1, "toClose": 0, "onTrack": 0}
    assert summary["budget"] == 1500 and summary["costConsumed"] == 600 and summary["hoursCompleted"] == 6
    assert summary["capacityHours"] == sum(p["capacityHours"] for p in body["projects"])  # weekday-dependent
    assert body["people"] == {"employees": 2, "onProject": 1, "available": 1}
    first = body
    # a finished project waits to be closed; archiving it takes it off the board and out of the sums
    done = create_project(org["admin"], org["mgr"]["id"], name="Done deal", budget=777)
    assert call("POST", f"/api/v1/projects/{done['id']}/complete", token=org["mgr_token"])[0] == 200
    body = call("GET", "/api/v1/dashboard", token=org["admin"])[1]
    assert [p["id"] for p in body["projects"]][-1] == done["id"]
    assert body["projects"][-1]["health"] == "to_close" and body["summary"]["projects"]["toClose"] == 1
    assert body["summary"]["budget"] == 1500
    assert call("POST", f"/api/v1/projects/{done['id']}/archive", token=org["admin"])[0] == 200
    body = call("GET", "/api/v1/dashboard", token=org["admin"])[1]
    assert done["id"] not in [p["id"] for p in body["projects"]] and body["summary"]["projects"]["toClose"] == 0
    # the admin sees what just happened, newest first, with the actor named
    recent = first["recentActivity"]
    assert 0 < len(recent) <= 8
    assert recent[0]["action"] == "time_entry.create" and recent[0]["actor"]["id"] == org["emp1"]["id"]
    assert [e["occurredAt"] for e in recent] == sorted((e["occurredAt"] for e in recent), reverse=True)
    assert "password" not in str(recent)


def test_manager_dashboard():
    org = setup_org()
    status, body = call("GET", "/api/v1/dashboard", token=org["mgr_token"])
    assert status == 200 and body["role"] == "manager"
    cards = {c["id"]: c for c in body["projects"]}
    card = cards[org["pid"]]
    assert card["hoursCompleted"] == 6 and card["budgetRemaining"] == -100
    assert card["totalGoals"] == 1 and card["progressPercent"] == 0  # hours logged, no goal done: 0 %, not 6 / 160
    assert card["milestoneCounts"] == {"open": 2, "complete": 0} and card["reasons"] == ["over_budget"]
    assert card["health"] == "at_risk"
    assert cards[org["empty"]["id"]]["reasons"] == ["no_members", "no_milestones"]
    assert cards[org["empty"]["id"]]["health"] == "needs_setup"
    team = {t["user"]["id"]: t for t in body["team"]}
    assert (
        team[org["emp1"]["id"]]["currentProject"]["id"] == org["pid"] and team[org["emp1"]["id"]]["hoursThisWeek"] == 6
    )
    assert team[org["emp1"]["id"]]["currentMilestone"] == {"id": org["ms"]["id"], "name": "Phase 1"}
    assert team[org["emp2"]["id"]]["currentProject"] is None and team[org["emp2"]["id"]]["hoursThisWeek"] == 0
    assert team[org["emp2"]["id"]]["currentMilestone"] is None
    assert body["week"]["start"] <= TODAY.isoformat() <= body["week"]["end"]
    # only Phase 0 (due in 2 days) is due soon; Phase 1 is due in 10 days
    (soon,) = body["dueSoon"]
    assert soon["id"] == org["soon"]["id"] and soon["project"] == {"id": org["pid"], "name": soon["project"]["name"]}
    assert soon["dueDate"] == (TODAY + timedelta(days=2)).isoformat() and soon["assignees"] == []
    # an overdue milestone is listed too, and flags the project
    late = (TODAY - timedelta(days=1)).isoformat()
    assert call("PATCH", f"/api/v1/milestones/{org['soon']['id']}", {"dueDate": late}, token=org["mgr_token"])[0] == 200
    status, body = call("GET", "/api/v1/dashboard", token=org["mgr_token"])
    assert [m["id"] for m in body["dueSoon"]] == [org["soon"]["id"]]
    assert {c["id"]: c["reasons"] for c in body["projects"]}[org["pid"]] == ["over_budget", "overdue_milestone"]


def test_employee_dashboard():
    org = setup_org()
    status, body = call("GET", "/api/v1/dashboard", token=org["emp1_token"])
    assert status == 200 and body["role"] == "employee"
    current = body["currentProject"]
    assert current["id"] == org["pid"] and "budget" not in current
    assert current["myHoursAssigned"] == 40 and current["myHoursCompleted"] == 6
    assert current["currentMilestone"]["id"] == org["ms"]["id"] and current["currentMilestone"]["name"] == "Phase 1"
    assert current["currentMilestone"]["dueDate"] == (TODAY + timedelta(days=10)).isoformat()
    assert [a["id"] for a in current["currentMilestone"]["assignees"]] == [org["emp1"]["id"]]
    assert [e["hours"] for e in body["recentEntries"]] == [6] and body["recentEntries"][0]["projectId"] == org["pid"]
    assert [g["id"] for g in body["openGoals"]] == [org["goal"]["id"]]
    assert (
        body["openGoals"][0]["milestone"]["name"] == "Phase 1" and body["openGoals"][0]["project"]["id"] == org["pid"]
    )
    assert body["hoursThisWeek"] == 6 and body["pastProjects"] == []
    assert body["currentProject"]["totalGoals"] == 1 and body["currentProject"]["progressPercent"] == 0
    # ticking the goal removes it; completing the project moves it to past projects
    assert call("PATCH", f"/api/v1/goals/{org['goal']['id']}", {"isDone": True}, token=org["emp1_token"])[0] == 200
    assert call("POST", f"/api/v1/milestones/{org['ms']['id']}/complete", token=org["mgr_token"])[0] == 200
    assert call("POST", f"/api/v1/milestones/{org['soon']['id']}/complete", token=org["mgr_token"])[0] == 200
    assert call("POST", f"/api/v1/projects/{org['pid']}/complete", token=org["mgr_token"])[0] == 200
    status, body = call("GET", "/api/v1/dashboard", token=org["emp1_token"])
    assert body["currentProject"] is None and body["openGoals"] == [] and body["recentEntries"] == []
    assert [p["id"] for p in body["pastProjects"]] == [org["pid"]] and body["pastProjects"][0]["status"] == "complete"
    # an employee with nothing at all
    status, body = call("GET", "/api/v1/dashboard", token=login("emp2", "Password1!")[0])
    assert body["currentProject"] is None and body["pastProjects"] == [] and body["hoursThisWeek"] == 0
