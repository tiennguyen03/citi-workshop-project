"""Milestone service rules against an in-memory repository: the M13a conflict rule and goal permissions."""

from datetime import date

import pytest

from app.core.actor import Actor
from app.core.dto import parse
from app.core.errors import Conflict, Forbidden, MilestoneConflict, ValidationError
from app.milestones import service
from app.milestones.schemas import UpdateGoalRequest

ADMIN = Actor("ADM001", "admin")
MGR = Actor("MGR001", "manager")
EMP = Actor("EMP001", "employee", manager_id="MGR001")
OTHER = Actor("EMP002", "employee", manager_id="MGR001")
PROJECT = {
    "id": "PRJ001",
    "manager_id": "MGR001",
    "archived": False,
    "status": "active",
    "start_date": date(2026, 10, 5),
    "end_date": date(2026, 10, 30),
}


class FakeRepo:
    def __init__(self):
        self.members = {"EMP001", "EMP002"}
        self.open = []  # (user_id, milestone_id, name)
        self.goal = {
            "id": "GOL001",
            "milestone_id": "MIL001",
            "project_id": "PRJ001",
            "milestone_status": "open",
            "title": "Export",
            "assignee_id": "EMP001",
            "is_done": False,
            "done_at": None,
            "assignee_first_name": "E",
            "assignee_last_name": "One",
            "assignee_email": "e@x.com",
            "assignee_job_title": "Eng",
            "assignee_role": "employee",
        }

    def active_member_ids(self, project_id):
        return set(self.members)

    def open_assignments(self, project_id, user_ids, exclude_milestone_id=None):
        return [
            {"user_id": u, "milestone_id": m, "milestone_name": n}
            for u, m, n in self.open
            if u in user_ids and m != exclude_milestone_id
        ]

    def find_goal(self, goal_id):
        return dict(self.goal) if goal_id == self.goal["id"] else None

    def assignee_ids(self, milestone_id):
        return ["EMP001"]

    def update_goal(self, goal_id, fields):
        self.goal.update(fields)


def test_dates_must_sit_inside_the_project():
    service._assert_dates_within_project(PROJECT, date(2026, 10, 5), date(2026, 10, 30))
    with pytest.raises(ValidationError) as exc:
        service._assert_dates_within_project(PROJECT, date(2026, 10, 1), date(2026, 10, 9))
    assert exc.value.details["field"] == "startDate"
    with pytest.raises(ValidationError) as exc:
        service._assert_dates_within_project(PROJECT, date(2026, 10, 9), date(2026, 11, 1))
    assert exc.value.details["field"] == "dueDate"
    with pytest.raises(ValidationError):
        service._assert_dates_within_project(PROJECT, date(2026, 10, 9), date(2026, 10, 8))


def test_conflict_rule_names_the_blocking_milestone():
    repo = FakeRepo()
    repo.open = [("EMP001", "MIL001", "Inventory")]
    service._assert_no_open_conflicts("PRJ001", ["EMP002"], repo)  # free person: fine
    service._assert_no_open_conflicts("PRJ001", ["EMP001"], repo, exclude="MIL001")  # same milestone: fine
    with pytest.raises(MilestoneConflict) as exc:
        service._assert_no_open_conflicts("PRJ001", ["EMP001", "EMP002"], repo)
    assert exc.value.details["userIds"] == ["EMP001"]
    assert exc.value.details["conflicts"] == [
        {"userId": "EMP001", "milestoneId": "MIL001", "milestoneName": "Inventory"}
    ]
    assert "Inventory" in exc.value.message


def test_assignees_must_be_active_members():
    repo = FakeRepo()
    service._assert_members("PRJ001", ["EMP001"], repo)
    with pytest.raises(ValidationError) as exc:
        service._assert_members("PRJ001", ["EMP001", "EMP999"], repo)
    assert exc.value.details == {"field": "assigneeIds", "userIds": ["EMP999"]}


def test_goal_update_permissions(monkeypatch):
    repo = FakeRepo()
    monkeypatch.setattr(service.projects, "load_project", lambda pid: dict(PROJECT))
    tick = parse(UpdateGoalRequest, {"isDone": True})
    rename = parse(UpdateGoalRequest, {"title": "New"})
    assert service.update_goal(EMP, "GOL001", tick, repo=repo)["isDone"] is True  # assignee may tick
    with pytest.raises(Forbidden):
        service.update_goal(OTHER, "GOL001", tick, repo=repo)  # someone else may not
    with pytest.raises(Forbidden):
        service.update_goal(EMP, "GOL001", rename, repo=repo)  # assignee may not rename
    assert service.update_goal(MGR, "GOL001", rename, repo=repo)["title"] == "New"
    assert service.update_goal(ADMIN, "GOL001", rename, repo=repo)["title"] == "New"
    with pytest.raises(ValidationError):
        service.update_goal(MGR, "GOL001", parse(UpdateGoalRequest, {"assigneeId": "EMP002"}), repo=repo)
    repo.goal["milestone_status"] = "complete"
    with pytest.raises(Conflict):
        service.update_goal(MGR, "GOL001", tick, repo=repo)
    monkeypatch.setattr(service.projects, "load_project", lambda pid: {**PROJECT, "archived": True})
    repo.goal["milestone_status"] = "open"
    with pytest.raises(Conflict):
        service.update_goal(MGR, "GOL001", tick, repo=repo)
