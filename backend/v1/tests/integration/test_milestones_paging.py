"""A project's milestones page on the server in reading order, with the next-due id riding along (D28)."""

from tests.integration.helpers import call, login
from tests.integration.test_projects import create_project, make_user


def test_milestones_page_in_reading_order_with_next_due():
    admin, _ = login()
    mgr = make_user(admin, "mgr", "manager")
    token = login("mgr", "Password1!")[0]
    pid = create_project(admin, mgr["id"])["id"]
    mk = lambda name, start, due: call(  # noqa: E731
        "POST",
        f"/api/v1/projects/{pid}/milestones",
        {"name": name, "startDate": start, "dueDate": due, "assigneeIds": []},
        token=token,
    )[1]
    late = mk("Late", "2026-10-05", "2026-10-09")
    soon = mk("Soon", "2026-10-05", "2026-10-07")
    done = mk("Done", "2026-10-05", "2026-10-06")
    far = mk("Far", "2026-10-12", "2026-10-30")
    assert call("POST", f"/api/v1/milestones/{done['id']}/complete", token=token)[0] == 200

    status, body = call("GET", f"/api/v1/projects/{pid}/milestones", token=token)
    assert status == 200 and body["total"] == 4 and body["limit"] == 25 and body["offset"] == 0
    assert [m["name"] for m in body["items"]] == ["Soon", "Late", "Far", "Done"]  # open by due date, completed last
    assert body["nextDueId"] == soon["id"]

    status, body = call("GET", f"/api/v1/projects/{pid}/milestones?limit=2&offset=2", token=token)
    assert status == 200 and [m["name"] for m in body["items"]] == ["Far", "Done"] and body["total"] == 4
    assert body["nextDueId"] == soon["id"]  # the next due is reported even when it is not on this page
    assert call("GET", f"/api/v1/projects/{pid}/milestones?limit=101", token=token)[0] == 400
    assert late["id"] != far["id"]
