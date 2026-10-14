"""User service rules against an in-memory repository — the permission matrix and invariants."""

from datetime import UTC, datetime
from decimal import Decimal

import pytest

from app.core.actor import Actor
from app.core.dto import parse
from app.core.errors import Conflict, Forbidden, NotFound, ValidationError
from app.users import service
from app.users.schemas import CreateUserRequest, UpdateUserRequest


class FakeRepo:
    def __init__(self, rows):
        self.rows = {r["id"]: dict(r) for r in rows}
        self.managed_projects = {}
        self.active_projects = {}

    def find_by_id(self, user_id):
        return dict(self.rows[user_id]) if user_id in self.rows else None

    def list_users(self, role=None, manager_id=None):
        rows = self.rows.values()
        if role:
            rows = [r for r in rows if r["role"] == role]
        if manager_id:
            rows = [r for r in rows if r["manager_id"] == manager_id]
        return [dict(r) for r in rows]

    def list_reports(self, manager_id, active_only=False):
        return [
            dict(r) for r in self.rows.values() if r["manager_id"] == manager_id and (r["is_active"] or not active_only)
        ]

    def username_exists(self, username):
        return any(r["username"] == username for r in self.rows.values())

    def email_exists(self, email, exclude_id=None):
        return any(r["email"] == email and r["id"] != exclude_id for r in self.rows.values())

    def insert(self, row):
        stored = {**row, "is_active": True, "created_at": datetime.now(UTC), "updated_at": datetime.now(UTC)}
        self.rows[row["id"]] = stored
        return dict(stored)

    def update(self, user_id, fields):
        self.rows[user_id].update(fields)
        return dict(self.rows[user_id])

    def count_active_admins(self):
        return sum(1 for r in self.rows.values() if r["role"] == "admin" and r["is_active"])

    def count_managed_projects(self, user_id):
        return self.managed_projects.get(user_id, 0)

    def count_reports(self, manager_id):
        return sum(1 for r in self.rows.values() if r["manager_id"] == manager_id)

    def current_projects(self, user_ids):
        return {uid: self.active_projects[uid] for uid in user_ids if uid in self.active_projects}

    def membership_history(self, user_id):
        return [dict(h) for h in getattr(self, "history", {}).get(user_id, [])]


def row(id, role, username, manager_id=None, **extra):
    base = {
        "id": id,
        "username": username,
        "first_name": username.title(),
        "last_name": "Test",
        "email": f"{username}@x.com",
        "job_title": role.title(),
        "salary": Decimal("50000"),
        "role": role,
        "manager_id": manager_id,
        "is_active": True,
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC),
    }
    return {**base, **extra}


ADMIN = Actor("ADM001", "admin")
MGR1 = Actor("MGR001", "manager")
MGR2 = Actor("MGR002", "manager")
EMP1 = Actor("EMP001", "employee", manager_id="MGR001")


@pytest.fixture
def repo():
    return FakeRepo(
        [
            row("ADM001", "admin", "admin"),
            row("MGR001", "manager", "mgr1"),
            row("MGR002", "manager", "mgr2"),
            row("EMP001", "employee", "emp1", "MGR001"),
            row("EMP002", "employee", "emp2", "MGR001"),
            row("EMP003", "employee", "emp3", "MGR002"),
        ]
    )


# ---- list / get -------------------------------------------------------------


def test_list_scoping(repo):
    assert {u["id"] for u in service.list_users(ADMIN, repo=repo)} == set(repo.rows)
    assert {u["id"] for u in service.list_users(MGR1, repo=repo)} == {"MGR001", "EMP001", "EMP002"}
    assert {u["id"] for u in service.list_users(ADMIN, role="manager", repo=repo)} == {"MGR001", "MGR002"}
    with pytest.raises(Forbidden):
        service.list_users(EMP1, repo=repo)


def test_salary_visibility(repo):
    repo.active_projects["EMP001"] = {"id": "PRJ001", "name": "Decom"}
    by_id = {u["id"]: u for u in service.list_users(MGR1, repo=repo)}
    assert "salary" in by_id["EMP001"] and "salary" in by_id["MGR001"]
    assert by_id["EMP001"]["currentProject"] == {"id": "PRJ001", "name": "Decom"}
    assert by_id["EMP002"]["currentProject"] is None

    assert "salary" in service.get_user(EMP1, "EMP001", repo=repo)  # own
    assert "salary" not in service.get_user(EMP1, "EMP002", repo=repo)  # teammate
    assert "salary" not in service.get_user(EMP1, "MGR001", repo=repo)  # own manager


def test_get_user_adds_manager_and_history_hiding_archived_from_non_admins(repo):
    repo.history = {
        "EMP001": [
            {
                "id": "PRJ001",
                "name": "Live",
                "status": "active",
                "archived": False,
                "manager_id": "MGR001",
                "hours_assigned": Decimal("40"),
                "hours_completed": Decimal("6"),
                "is_active": True,
                "released_reason": None,
                "added_at": None,
                "released_at": None,
            },
            {
                "id": "PRJ000",
                "name": "Gone",
                "status": "complete",
                "archived": True,
                "manager_id": "MGR001",
                "hours_assigned": Decimal("10"),
                "hours_completed": Decimal("10"),
                "is_active": False,
                "released_reason": "archived",
                "added_at": None,
                "released_at": None,
            },
        ]
    }
    as_manager = service.get_user(MGR1, "EMP001", repo=repo)
    assert as_manager["manager"] == {"id": "MGR001", "firstName": "Mgr1", "lastName": "Test"}
    assert [p["id"] for p in as_manager["projects"]] == ["PRJ001"]
    assert as_manager["projects"][0] == {
        "id": "PRJ001",
        "name": "Live",
        "status": "active",
        "archived": False,
        "hoursAssigned": Decimal("40"),
        "hoursCompleted": Decimal("6"),
        "isActive": True,
        "releasedReason": None,
        "addedAt": None,
        "releasedAt": None,
    }
    assert [p["id"] for p in service.get_user(ADMIN, "EMP001", repo=repo)["projects"]] == ["PRJ001", "PRJ000"]
    assert service.get_user(ADMIN, "MGR001", repo=repo)["manager"] is None
    assert service.get_user(ADMIN, "MGR001", repo=repo)["projects"] == []


def test_get_user_visibility_rules(repo):
    with pytest.raises(Forbidden):
        service.get_user(EMP1, "EMP003", repo=repo)  # other team
    with pytest.raises(Forbidden):
        service.get_user(MGR1, "EMP003", repo=repo)  # not my report
    with pytest.raises(NotFound):
        service.get_user(ADMIN, "NOPE00", repo=repo)


# ---- create -----------------------------------------------------------------


def create_dto(**overrides):
    base = {
        "username": "New.User",
        "password": "Password1!",
        "firstName": "New",
        "lastName": "User",
        "email": "New@X.com",
        "jobTitle": "Analyst",
        "salary": 42000,
        "role": "employee",
        "managerId": "MGR001",
    }
    return parse(CreateUserRequest, {**base, **overrides})


def test_create_user_normalises_and_hashes(repo):
    user = service.create_user(ADMIN, create_dto(), repo=repo)
    assert user["username"] == "new.user" and user["email"] == "new@x.com"
    assert len(user["id"]) == 6 and user["salary"] == Decimal("42000")
    stored = repo.rows[user["id"]]
    assert stored["password_hash"] != "Password1!" and stored["password_hash"].startswith("$2")


def test_create_user_requires_admin_and_valid_manager(repo):
    with pytest.raises(Forbidden):
        service.create_user(MGR1, create_dto(), repo=repo)
    with pytest.raises(ValidationError) as exc:
        service.create_user(ADMIN, create_dto(managerId=None), repo=repo)
    assert exc.value.details["field"] == "managerId"
    with pytest.raises(ValidationError):
        service.create_user(ADMIN, create_dto(managerId="EMP001"), repo=repo)  # not a manager
    with pytest.raises(ValidationError):
        service.create_user(ADMIN, create_dto(role="manager", managerId="MGR001"), repo=repo)


def test_create_user_uniqueness(repo):
    with pytest.raises(Conflict) as exc:
        service.create_user(ADMIN, create_dto(username="emp1"), repo=repo)
    assert exc.value.details["field"] == "username"
    with pytest.raises(Conflict) as exc:
        service.create_user(ADMIN, create_dto(email="emp1@x.com"), repo=repo)
    assert exc.value.details["field"] == "email"


def test_create_dto_validation():
    with pytest.raises(ValidationError):
        create_dto(username="ab")
    with pytest.raises(ValidationError):
        create_dto(password="short")
    with pytest.raises(ValidationError):
        create_dto(email="nope")
    with pytest.raises(ValidationError):
        create_dto(role="king")
    with pytest.raises(ValidationError):
        create_dto(salary=-1)


# ---- update -----------------------------------------------------------------


def update(actor, user_id, repo, **fields):
    return service.update_user(actor, user_id, parse(UpdateUserRequest, fields), repo=repo)


def test_self_and_manager_can_edit_name_email_only(repo):
    assert update(EMP1, "EMP001", repo, firstName="Jane")["firstName"] == "Jane"
    assert update(MGR1, "EMP001", repo, email="JANE@x.com")["email"] == "jane@x.com"
    with pytest.raises(Forbidden):
        update(EMP1, "EMP001", repo, salary=1)
    with pytest.raises(Forbidden):
        update(EMP1, "EMP002", repo, firstName="X")  # teammate
    with pytest.raises(Forbidden):
        update(MGR1, "EMP003", repo, firstName="X")  # not my report
    with pytest.raises(Forbidden):
        update(MGR1, "EMP001", repo, jobTitle="Boss")
    with pytest.raises(ValidationError):
        update(EMP1, "EMP001", repo)  # nothing to update
    with pytest.raises(ValidationError):
        update(EMP1, "EMP001", repo, hacker=True)  # unknown field -> 400, not silently ignored


def test_admin_reassigns_manager_and_promotes(repo):
    assert update(ADMIN, "EMP001", repo, managerId="MGR002")["managerId"] == "MGR002"
    promoted = update(ADMIN, "EMP002", repo, role="manager")
    assert promoted["role"] == "manager" and promoted["managerId"] is None
    with pytest.raises(ValidationError):
        update(ADMIN, "EMP003", repo, managerId="EMP001")  # not a manager


def test_cannot_demote_manager_with_projects_or_reports(repo):
    with pytest.raises(Conflict):
        update(ADMIN, "MGR001", repo, role="employee", managerId="MGR002")  # has reports
    repo.managed_projects["MGR002"] = 2
    with pytest.raises(Conflict):
        update(ADMIN, "MGR002", repo, role="admin")  # EMP003 reports + projects
    with pytest.raises(Conflict):
        update(ADMIN, "MGR002", repo, isActive=False)


def test_admin_self_and_last_admin_protection(repo):
    with pytest.raises(Conflict):
        update(ADMIN, "ADM001", repo, isActive=False)
    with pytest.raises(Conflict):
        update(ADMIN, "ADM001", repo, role="manager")
    repo.rows["ADM002"] = row("ADM002", "admin", "admin2")
    assert update(ADMIN, "ADM002", repo, isActive=False)["isActive"] is False


def test_email_uniqueness_on_update(repo):
    with pytest.raises(Conflict):
        update(EMP1, "EMP001", repo, email="emp2@x.com")
    assert update(EMP1, "EMP001", repo, email="emp1@x.com")["email"] == "emp1@x.com"  # own email ok


# ---- team -------------------------------------------------------------------


def test_team_views(repo):
    repo.rows["EMP002"]["is_active"] = False
    team = service.get_team(EMP1, "EMP001", repo=repo)
    assert team["manager"]["id"] == "MGR001"
    assert [m["id"] for m in team["members"]] == ["EMP001"]  # inactive teammate hidden
    assert service.get_team(MGR1, "MGR001", repo=repo)["manager"]["id"] == "MGR001"
    assert service.get_team(ADMIN, "EMP003", repo=repo)["manager"]["id"] == "MGR002"
    with pytest.raises(Forbidden):
        service.get_team(EMP1, "EMP003", repo=repo)
    with pytest.raises(ValidationError):
        service.get_team(ADMIN, "ADM001", repo=repo)
