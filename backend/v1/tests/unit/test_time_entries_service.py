"""Time entry rules against an in-memory repository: who may log, edit and delete, and the date limits."""

from datetime import date
from decimal import Decimal

import pytest

from app.core.actor import Actor
from app.core.dto import parse
from app.core.errors import Conflict, Forbidden, NotFound, ValidationError
from app.time_entries import service
from app.time_entries.schemas import CreateTimeEntryRequest, UpdateTimeEntryRequest

ADMIN = Actor("ADM001", "admin")
MGR = Actor("MGR001", "manager")
EMP = Actor("EMP001", "employee", manager_id="MGR001")
OTHER = Actor("EMP002", "employee", manager_id="MGR001")
TODAY = date(2026, 10, 13)
PROJECT = {
    "id": "PRJ001",
    "manager_id": "MGR001",
    "archived": False,
    "status": "active",
    "start_date": date(2026, 10, 5),
    "end_date": date(2026, 10, 30),
}


def _row(entry_id="TIM001", user_id="EMP001", hours=Decimal("8")):
    return {
        "id": entry_id,
        "project_id": "PRJ001",
        "user_id": user_id,
        "entry_date": TODAY,
        "hours": hours,
        "note": "",
        "created_at": None,
        "first_name": "E",
        "last_name": "One",
        "email": "e@x.com",
        "job_title": "Eng",
        "role": "employee",
    }


class FakeRepo:
    def __init__(self, rows=()):
        self.rows = {r["id"]: dict(r) for r in rows}
        self.deleted = []

    def find_by_id(self, entry_id):
        return dict(self.rows[entry_id]) if entry_id in self.rows else None

    def insert(self, entry_id, project_id, user_id, entry_date, hours, note):
        self.rows[entry_id] = {**_row(entry_id, user_id, hours), "entry_date": entry_date, "note": note}

    def update(self, entry_id, fields):
        self.rows[entry_id].update(fields)

    def delete(self, entry_id):
        self.deleted.append(entry_id)
        del self.rows[entry_id]


class FakeMembers:
    def __init__(self, active):
        self.active = active

    def find_member(self, project_id, user_id):
        if user_id not in self.active:
            return None
        return {"is_active": self.active[user_id]}


@pytest.fixture
def project(monkeypatch):
    state = {"project": dict(PROJECT)}
    monkeypatch.setattr(service.projects, "require_visible", lambda actor, pid: dict(state["project"]))
    monkeypatch.setattr(service.projects, "load_project", lambda pid: dict(state["project"]))
    return state


def test_create_requires_active_membership_and_valid_date(project):
    repo = FakeRepo()
    members = FakeMembers({"EMP001": True, "EMP002": False})
    dto = parse(CreateTimeEntryRequest, {"entryDate": "2026-10-13", "hours": 6})
    entry = service.create_entry(EMP, "PRJ001", dto, repo=repo, members=members, today=TODAY)
    assert entry["hours"] == 6 and entry["user"]["id"] == "EMP001"
    with pytest.raises(Forbidden):
        service.create_entry(OTHER, "PRJ001", dto, repo=repo, members=members, today=TODAY)  # released
    with pytest.raises(Forbidden):
        service.create_entry(MGR, "PRJ001", dto, repo=repo, members=members, today=TODAY)  # not a member
    future = parse(CreateTimeEntryRequest, {"entryDate": "2026-10-14", "hours": 1})
    with pytest.raises(ValidationError) as exc:
        service.create_entry(EMP, "PRJ001", future, repo=repo, members=members, today=TODAY)
    assert exc.value.details["field"] == "entryDate"
    early = parse(CreateTimeEntryRequest, {"entryDate": "2026-10-01", "hours": 1})
    with pytest.raises(ValidationError):
        service.create_entry(EMP, "PRJ001", early, repo=repo, members=members, today=TODAY)
    project["project"]["status"] = "complete"
    with pytest.raises(Conflict):
        service.create_entry(EMP, "PRJ001", dto, repo=repo, members=members, today=TODAY)


def test_hours_limits_are_validated_at_the_edge():
    with pytest.raises(ValidationError):
        parse(CreateTimeEntryRequest, {"entryDate": "2026-10-13", "hours": 0})
    with pytest.raises(ValidationError):
        parse(CreateTimeEntryRequest, {"entryDate": "2026-10-13", "hours": 25})
    assert parse(CreateTimeEntryRequest, {"entryDate": "2026-10-13", "hours": 0.25}).hours == Decimal("0.25")


def test_update_is_author_only_and_delete_allows_manager(project):
    repo = FakeRepo([_row()])
    patch = parse(UpdateTimeEntryRequest, {"hours": 4})
    with pytest.raises(Forbidden):
        service.update_entry(MGR, "TIM001", patch, repo=repo, today=TODAY)
    with pytest.raises(Forbidden):
        service.update_entry(OTHER, "TIM001", patch, repo=repo, today=TODAY)
    assert service.update_entry(EMP, "TIM001", patch, repo=repo, today=TODAY)["hours"] == 4
    with pytest.raises(ValidationError):
        service.update_entry(EMP, "TIM001", parse(UpdateTimeEntryRequest, {}), repo=repo, today=TODAY)
    with pytest.raises(NotFound):
        service.update_entry(EMP, "NOPE01", patch, repo=repo, today=TODAY)
    with pytest.raises(Forbidden):
        service.delete_entry(OTHER, "TIM001", repo=repo)
    assert service.delete_entry(MGR, "TIM001", repo=repo)["id"] == "TIM001"
    assert repo.deleted == ["TIM001"]
    repo = FakeRepo([_row()])
    assert service.delete_entry(ADMIN, "TIM001", repo=repo)["id"] == "TIM001"
    repo = FakeRepo([_row()])
    project["project"]["archived"] = True
    with pytest.raises(Conflict):
        service.delete_entry(EMP, "TIM001", repo=repo)


def test_list_scopes_members_to_their_own_entries(project, monkeypatch):
    seen = {}

    class ListRepo(FakeRepo):
        def list_entries(self, project_id, *, user_id=None, date_from=None, date_to=None, limit=None, offset=0):
            seen.update(user_id=user_id, date_from=date_from, date_to=date_to)
            return [_row()]

        def count_entries(self, project_id, *, user_id=None, date_from=None, date_to=None):
            return 1

    repo = ListRepo()
    service.list_entries(EMP, "PRJ001", user_id="EMP002", date_from="2026-10-01", date_to=None, repo=repo)
    assert seen == {"user_id": "EMP001", "date_from": date(2026, 10, 1), "date_to": None}
    service.list_entries(MGR, "PRJ001", user_id="EMP002", date_from=None, date_to=None, repo=repo)
    assert seen["user_id"] == "EMP002"
    with pytest.raises(ValidationError):
        service.list_entries(MGR, "PRJ001", user_id=None, date_from="nope", date_to=None, repo=repo)
