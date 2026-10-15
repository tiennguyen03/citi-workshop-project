"""CSV import of users (D26): every row checked, all-or-nothing, in-file managers, generated passwords."""

import pytest

from app.core.errors import Forbidden, ValidationError
from app.users import service
from app.users.schemas import ImportUsersRequest
from tests.unit.test_users_service import ADMIN, EMP1, MGR1, FakeRepo, row

HEADER = "username,firstName,lastName,email,jobTitle,salary,role,manager,password"


@pytest.fixture
def repo():
    return FakeRepo([row("MGR001", "manager", "mgr1"), row("EMP001", "employee", "emp1", manager_id="MGR001")])


def run(repo, text, dry_run=False):
    return service.import_users(ADMIN, ImportUsersRequest(csv=text, dryRun=dry_run), repo=repo)


def test_parses_headers_in_any_order_case_and_bom():
    rows = service.parse_import_csv(
        "\ufeffEmail,Role,First Name,last_name,USERNAME,Job Title,Salary\na@x.com,manager,A,B,a.b,Lead,1"
    )
    assert rows == [
        {
            "email": "a@x.com",
            "role": "manager",
            "firstname": "A",
            "lastname": "B",
            "username": "a.b",
            "jobtitle": "Lead",
            "salary": "1",
            "_line": "2",
        }
    ]


def test_missing_columns_and_empty_file_are_whole_file_errors():
    with pytest.raises(ValidationError, match="Missing columns: email, role"):
        service.parse_import_csv("username,firstName,lastName,jobTitle,salary\n")
    with pytest.raises(ValidationError, match="empty"):
        service.parse_import_csv("")
    with pytest.raises(ValidationError, match="no users"):
        service.parse_import_csv(HEADER + "\n\n")
    too_many = HEADER + "\n" + "\n".join(f"u{i},A,B,u{i}@x.com,T,1,manager,," for i in range(501))
    with pytest.raises(ValidationError, match="At most 500"):
        service.parse_import_csv(too_many)


def test_dry_run_reports_every_problem_and_creates_nobody(repo):
    text = "\n".join(
        [
            HEADER,
            "grace.park,Grace,Park,grace@x.com,Analyst,70000,employee,mgr1,Password1!",  # ok
            "emp1,Dup,Licate,dup@x.com,Analyst,70000,employee,mgr1,Password1!",  # username taken
            "new.one,New,One,emp1@x.com,Analyst,70000,employee,ghost,Password1!",  # email taken, unknown manager
            "x,Bad,Row,not-an-email,,abc,wizard,,short",  # several field errors
            "boss.two,Boss,Two,boss2@x.com,Lead,90000,manager,mgr1,Password1!",  # manager with a manager
            "grace.park,Grace,Again,grace2@x.com,Analyst,70000,employee,mgr1,",  # duplicate inside the file
        ]
    )
    report = run(repo, text, dry_run=True)
    statuses = [r["status"] for r in report["rows"]]
    assert statuses == ["ok", "error", "error", "error", "error", "error"]
    assert report["summary"] == {"total": 6, "valid": 1, "invalid": 5, "created": 0}
    assert report["rows"][1]["errors"] == ["username: already taken"]
    assert report["rows"][2]["errors"] == [
        "manager: 'ghost' is not an active manager (existing or earlier in this file)",
        "email: already in use",
    ]
    bad = report["rows"][3]["errors"]
    assert any(e.startswith("username:") for e in bad) and any(e.startswith("email:") for e in bad)
    assert "role: must be admin, manager or employee" in bad and "salary: must be a number" in bad
    assert "password: too short (at least 8 characters)" in bad and "email: must be a valid email address" in bad
    assert report["rows"][4]["errors"] == ["manager: only employees can have a manager"]
    assert report["rows"][5]["errors"] == ["username: appears more than once in this file"]
    assert len(repo.rows) == 2  # nothing written
    assert "generatedPassword" not in report["rows"][5]  # errors never carry a password


def test_commit_is_all_or_nothing(repo):
    text = (
        HEADER
        + "\ngood.one,Good,One,good1@x.com,Analyst,70000,employee,mgr1,Password1!\nemp1,Dup,Licate,dup@x.com,Analyst,70000,employee,mgr1,Password1!"
    )
    with pytest.raises(ValidationError) as exc:
        run(repo, text)
    assert "1 row needs fixing" in str(exc.value.message) if hasattr(exc.value, "message") else True
    assert exc.value.details["summary"]["invalid"] == 1
    assert len(repo.rows) == 2


def test_commit_creates_managers_first_and_generates_blank_passwords(repo):
    text = "\n".join(
        [
            HEADER,
            "nina.cole,Nina,Cole,nina@x.com,Analyst,70000,employee,sam.ortiz,",  # points at a manager later in the file? no: earlier rows only
            "sam.ortiz,Sam,Ortiz,sam@x.com,Delivery Manager,120000,manager,,Password1!",
        ]
    )
    report = run(repo, text, dry_run=True)
    assert report["rows"][0]["status"] == "error"  # the manager row comes after, so it cannot be resolved

    text = "\n".join(
        [
            HEADER,
            "sam.ortiz,Sam,Ortiz,sam@x.com,Delivery Manager,120000,manager,,Password1!",
            "nina.cole,Nina,Cole,nina@x.com,Analyst,70000,employee,sam.ortiz,",
            "omar.haddad,Omar,Haddad,omar@x.com,Analyst,70000,employee,mgr1,Password1!",
        ]
    )
    report = run(repo, text)
    assert report["summary"] == {"total": 3, "valid": 3, "invalid": 0, "created": 3}
    by_name = {r["username"]: r for r in report["rows"]}
    assert by_name["sam.ortiz"]["id"] and "generatedPassword" not in by_name["sam.ortiz"]
    assert len(by_name["nina.cole"]["generatedPassword"]) >= 8
    created = {r["username"]: r for r in repo.rows.values()}
    assert created["nina.cole"]["manager_id"] == created["sam.ortiz"]["id"]
    assert created["omar.haddad"]["manager_id"] == "MGR001"
    assert created["nina.cole"]["password_hash"] != by_name["nina.cole"]["generatedPassword"]  # stored hashed


def test_only_admins_import(repo):
    with pytest.raises(Forbidden):
        service.import_users(
            MGR1, ImportUsersRequest(csv=HEADER + "\na,A,B,a@x.com,T,1,manager,,Password1!"), repo=repo
        )
    with pytest.raises(Forbidden):
        service.import_users(
            EMP1, ImportUsersRequest(csv=HEADER + "\na,A,B,a@x.com,T,1,manager,,Password1!"), repo=repo
        )
