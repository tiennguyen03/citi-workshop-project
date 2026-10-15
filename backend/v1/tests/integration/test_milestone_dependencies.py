"""Dependencies through the API: set, see, gate, reopen, loop and cross-project refusals (D29)."""

from tests.integration.helpers import call, login
from tests.integration.test_projects import create_project, make_user


def test_chain_gates_completion_and_refuses_loops():
    admin, _ = login()
    mgr = make_user(admin, "mgr", "manager")
    token = login("mgr", "Password1!")[0]
    pid = create_project(admin, mgr["id"])["id"]
    other = create_project(admin, mgr["id"], name="Other")["id"]
    body = {"startDate": "2026-10-05", "dueDate": "2026-10-16", "assigneeIds": []}
    pack = call("POST", f"/api/v1/projects/{pid}/milestones", {**body, "name": "Pack"}, token=token)[1]
    status, move = call(
        "POST", f"/api/v1/projects/{pid}/milestones", {**body, "name": "Move", "blockedById": pack["id"]}, token=token
    )
    assert (
        status == 201
        and move["blockedBy"] == {"id": pack["id"], "name": "Pack", "status": "open"}
        and move["blocked"] is True
    )
    elsewhere = call("POST", f"/api/v1/projects/{other}/milestones", {**body, "name": "Elsewhere"}, token=token)[1]

    # cannot wait on another project's milestone, on itself, or close a loop
    assert call("PATCH", f"/api/v1/milestones/{move['id']}", {"blockedById": elsewhere["id"]}, token=token)[0] == 400
    assert call("PATCH", f"/api/v1/milestones/{move['id']}", {"blockedById": move["id"]}, token=token)[0] == 400
    status, err = call("PATCH", f"/api/v1/milestones/{pack['id']}", {"blockedById": move["id"]}, token=token)
    assert status == 400 and err["error"]["message"] == "'Move' already waits on this milestone; that would be a loop"

    # the list shows the link and the gate refuses completion while Pack is open
    listed = {m["name"]: m for m in call("GET", f"/api/v1/projects/{pid}/milestones", token=token)[1]["items"]}
    assert (
        listed["Move"]["blockedBy"]["name"] == "Pack"
        and listed["Move"]["blocked"] is True
        and listed["Pack"]["blockedBy"] is None
    )
    status, err = call("POST", f"/api/v1/milestones/{move['id']}/complete", token=token)
    assert (
        status == 409
        and err["error"]["code"] == "MILESTONE_BLOCKED"
        and err["error"]["details"]["blockedBy"]["name"] == "Pack"
    )
    assert call("POST", f"/api/v1/milestones/{pack['id']}/complete", token=token)[0] == 200
    move_now = call("GET", f"/api/v1/milestones/{move['id']}", token=token)[1]
    assert move_now["blocked"] is False and move_now["blockedBy"]["status"] == "complete"
    assert call("POST", f"/api/v1/milestones/{move['id']}/complete", token=token)[0] == 200

    # clearing the link with an explicit null
    status, cleared = call("PATCH", f"/api/v1/milestones/{move['id']}", {"blockedById": None}, token=token)
    assert status == 200 and cleared["blockedBy"] is None and cleared["blocked"] is False
