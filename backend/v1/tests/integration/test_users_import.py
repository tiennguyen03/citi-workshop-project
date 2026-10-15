"""POST /users/import against the real database: preview writes nothing, commit writes all, audit once."""

from app.core import db
from tests.integration.helpers import call, login

HEADER = "username,firstName,lastName,email,jobTitle,salary,role,manager,password"


def test_preview_then_commit_then_duplicates():
    admin, _ = login()
    status, mgr = call(
        "POST",
        "/api/v1/users",
        {
            "username": "lead",
            "password": "Password1!",
            "firstName": "Lee",
            "lastName": "Ad",
            "email": "lead@example.com",
            "jobTitle": "Lead",
            "salary": 100000,
            "role": "manager",
        },
        token=admin,
    )
    assert status == 201
    text = "\n".join(
        [
            HEADER,
            "rosa.diaz,Rosa,Diaz,rosa@example.com,Analyst,70000,employee,lead,Password1!",
            "tom.ng,Tom,Ng,tom@example.com,Analyst,70000,employee,lead,",
        ]
    )
    status, preview = call("POST", "/api/v1/users/import", {"csv": text, "dryRun": True}, token=admin)
    assert status == 200 and preview["summary"] == {"total": 2, "valid": 2, "invalid": 0, "created": 0}
    assert db.query_one("SELECT COUNT(*) AS n FROM users WHERE username IN ('rosa.diaz', 'tom.ng')")["n"] == 0
    assert (
        db.query_one("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'user.import'")["n"] == 0
    )  # a preview leaves no trace

    status, report = call("POST", "/api/v1/users/import", {"csv": text}, token=admin)
    assert status == 200 and report["summary"]["created"] == 2
    tom = next(r for r in report["rows"] if r["username"] == "tom.ng")
    assert len(tom["generatedPassword"]) >= 8
    assert call("POST", "/api/v1/auth/login", {"username": "tom.ng", "password": tom["generatedPassword"]})[0] == 200
    rows = db.query(
        "SELECT username, manager_id FROM users WHERE username IN ('rosa.diaz', 'tom.ng') ORDER BY username"
    )
    assert [r["manager_id"] for r in rows] == [mgr["id"], mgr["id"]]
    entries = db.query("SELECT summary, details FROM audit_log WHERE action = 'user.import'")
    assert len(entries) == 1 and entries[0]["summary"] == "Imported 2 users from a CSV file"
    assert entries[0]["details"] == {
        "created": 2,
        "usernames": ["rosa.diaz", "tom.ng"],
    }  # never the CSV, never a password

    status, body = call("POST", "/api/v1/users/import", {"csv": text}, token=admin)
    assert status == 400 and body["error"]["details"]["summary"]["invalid"] == 2
    assert all("already" in e for r in body["error"]["details"]["rows"] for e in r["errors"][:1])
    assert db.query_one("SELECT COUNT(*) AS n FROM users WHERE username IN ('rosa.diaz', 'tom.ng')")["n"] == 2


def test_non_admins_are_refused_and_bad_files_are_400():
    admin, _ = login()
    call(
        "POST",
        "/api/v1/users",
        {
            "username": "mgr",
            "password": "Password1!",
            "firstName": "M",
            "lastName": "G",
            "email": "mgr@example.com",
            "jobTitle": "Lead",
            "salary": 1,
            "role": "manager",
        },
        token=admin,
    )
    mgr, _ = login("mgr", "Password1!")
    assert (
        call(
            "POST", "/api/v1/users/import", {"csv": HEADER + "\nx,A,B,x@example.com,T,1,manager,,Password1!"}, token=mgr
        )[0]
        == 403
    )
    status, body = call("POST", "/api/v1/users/import", {"csv": "username,firstName\na,b"}, token=admin)
    assert status == 400 and "Missing columns" in body["error"]["message"]
