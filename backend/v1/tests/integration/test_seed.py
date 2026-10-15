"""Demo data: loads once, respects every invariant the services enforce, and is usable via the API."""

from app.core import db, seed
from tests.integration.helpers import call, login


def test_seed_loads_once_and_respects_invariants():
    assert seed.is_needed(db.get_conn())
    seed.load()
    assert not seed.is_needed(db.get_conn())

    assert db.query_one("SELECT COUNT(*) AS n FROM users")["n"] == 1 + len(seed.MANAGERS) + len(seed.EMPLOYEES)
    # D25: the demo carries the audit trail its facts imply, dated when they happened, with no sign-ins in it
    trail = db.query("SELECT action, actor_role, occurred_at FROM audit_log ORDER BY occurred_at")
    assert len(trail) == len(seed.PROJECTS) + len(seed.MEMBERS) + len(seed.MILESTONES) + sum(
        1 for m in seed.MILESTONES if m[6] == "complete"
    ) + len(seed.TIME_ENTRIES) + sum(1 for g in seed.GOALS if g[4] and g[3])
    assert {r["action"] for r in trail} >= {
        "project.create",
        "project.member_add",
        "milestone.create",
        "time_entry.create",
    }
    assert not any(r["action"].startswith("auth.") for r in trail)
    assert trail[0]["occurred_at"] < trail[-1]["occurred_at"]
    assert all(r["occurred_at"].timestamp() <= __import__("time").time() for r in trail)  # never dated in the future
    # M8: at most one active project per employee (the partial index would have refused otherwise)
    assert db.query_one("SELECT COUNT(*) AS n FROM project_members WHERE is_active")["n"] == 8
    # M13a: at most one open milestone per employee per project
    dup = db.query(
        "SELECT project_id, user_id FROM milestone_assignees WHERE is_open GROUP BY 1, 2 HAVING COUNT(*) > 1"
    )
    assert dup == []
    # assignees are (or were) members of the milestone's project
    orphan = db.query(
        """
        SELECT ma.user_id FROM milestone_assignees ma
        WHERE NOT EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = ma.project_id AND pm.user_id = ma.user_id)
        """
    )
    assert orphan == []
    # goal assignees are assignees of their milestone
    bad_goal = db.query(
        """
        SELECT g.id FROM goals g
        WHERE g.assignee_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM milestone_assignees ma WHERE ma.milestone_id = g.milestone_id AND ma.user_id = g.assignee_id)
        """
    )
    assert bad_goal == []
    # time entries are by members, within project dates
    bad_time = db.query(
        """
        SELECT t.id FROM time_entries t JOIN projects p ON p.id = t.project_id
        WHERE t.entry_date < p.start_date OR t.entry_date > p.end_date
           OR NOT EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = t.project_id AND pm.user_id = t.user_id)
        """
    )
    assert bad_time == []


def test_seeded_accounts_work_through_the_api():
    seed.load()
    token, user = login("priya.natarajan", seed.DEMO_PASSWORD)
    assert user["role"] == "manager"
    status, body = call("GET", "/api/v1/projects", token=token)
    assert status == 200 and [p["name"] for p in body["items"]] == ["Decommission 1,000 Servers"]
    project = body["items"][0]
    assert project["memberCount"] == 3 and project["hoursCompleted"] == 65.5
    assert (project["completedGoals"], project["totalGoals"], project["progressPercent"]) == (4, 9, 44)  # D27
    status, body = call("GET", f"/api/v1/projects/{project['id']}/available-members", token=token)
    assert [u["firstName"] for u in body["items"]] == ["Grace"]

    token, _ = login("john.doe", seed.DEMO_PASSWORD)
    status, body = call("GET", "/api/v1/auth/me", token=token)
    assert status == 200 and body["email"] == "john.doe@example.com"

    admin, _ = login()
    status, body = call("GET", "/api/v1/projects", token=admin)
    vpn = next(p for p in body["items"] if p["name"] == "Legacy VPN Retirement")
    assert vpn["status"] == "complete" and vpn["archived"] is False
    assert vpn["memberCount"] == 2  # completed members still count
    # it waits on the admin's board; Marcus sees it among his cards too (no health word there: the chip says Complete)
    body = call("GET", "/api/v1/dashboard", token=admin)[1]
    assert body["summary"]["projects"]["toClose"] == 1
    assert next(p for p in body["projects"] if p["id"] == vpn["id"])["health"] == "to_close"
    marcus = login("marcus.bell", seed.DEMO_PASSWORD)[0]
    body = call("GET", "/api/v1/dashboard", token=marcus)[1]
    assert {p["id"]: p["health"] for p in body["projects"]}[vpn["id"]] == "to_close" and len(body["projects"]) == 2
