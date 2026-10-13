"""ids, security (bcrypt + JWT), audit sanitiser, permissions."""

from datetime import UTC, datetime, timedelta

import pytest

from app.core import audit, ids, permissions, security
from app.core.actor import Actor
from app.core.errors import Forbidden, Unauthenticated


def test_new_id_shape_and_uniqueness():
    generated = {ids.new_id() for _ in range(200)}
    assert len(generated) == 200
    assert all(ids.is_valid_id(v) for v in generated)
    assert not ids.is_valid_id("abc123") and not ids.is_valid_id("ABCDEFG") and not ids.is_valid_id(123)


def test_password_hash_roundtrip():
    hashed = security.hash_password("Secret123!")
    assert hashed != "Secret123!"
    assert security.verify_password("Secret123!", hashed)
    assert not security.verify_password("wrong", hashed)
    assert not security.verify_password("x", "not-a-hash")


def test_token_roundtrip_and_expiry():
    token, expires = security.issue_token("ABC123", "admin")
    claims = security.decode_token(token)
    assert claims["sub"] == "ABC123" and claims["role"] == "admin"
    assert expires > datetime.now(UTC)

    old, _ = security.issue_token("ABC123", "admin", now=datetime.now(UTC) - timedelta(days=2))
    with pytest.raises(Unauthenticated):
        security.decode_token(old)
    with pytest.raises(Unauthenticated):
        security.decode_token(token + "x")


def test_bearer_token_extraction():
    assert security.bearer_token({"authorization": "Bearer abc"}) == "abc"
    assert security.bearer_token({"Authorization": "bearer abc "}) == "abc"
    assert security.bearer_token({"authorization": "Basic abc"}) is None
    assert security.bearer_token({}) is None


def test_audit_sanitize_removes_secrets_and_masks_salary():
    body = {"username": "u", "password": "p", "salary": 100, "nested": {"token": "t", "ok": [1, {"password": "x"}]}}
    assert audit.sanitize(body) == {"username": "u", "salary": "[redacted]", "nested": {"ok": [1, {}]}}
    assert audit.entity_type_for("project.archive") == "project"
    assert audit.entity_type_for("auth.login") is None


ADMIN = Actor("ADMIN1", "admin")
MGR = Actor("MGR001", "manager")
EMP = Actor("EMP001", "employee", manager_id="MGR001")
PROJECT = {"id": "PRJ001", "manager_id": "MGR001", "archived": False}
OTHER_PROJECT = {"id": "PRJ002", "manager_id": "MGR999", "archived": False}


def test_project_permissions():
    assert permissions.manages_project(ADMIN, OTHER_PROJECT)
    assert permissions.manages_project(MGR, PROJECT)
    assert not permissions.manages_project(MGR, OTHER_PROJECT)
    with pytest.raises(Forbidden):
        permissions.assert_manages_project(EMP, PROJECT)

    assert permissions.can_view_project(EMP, PROJECT, is_member=True)
    assert not permissions.can_view_project(EMP, PROJECT, is_member=False)
    archived = {**PROJECT, "archived": True}
    assert permissions.can_view_project(ADMIN, archived, is_member=False)
    assert not permissions.can_view_project(MGR, archived, is_member=False)


def test_user_field_permissions():
    report = {"id": "EMP001", "manager_id": "MGR001"}
    stranger = {"id": "EMP002", "manager_id": "MGR999"}
    assert permissions.can_edit_user_fields(ADMIN, stranger, ["salary", "role"])
    assert permissions.can_edit_user_fields(MGR, report, ["first_name", "email"])
    assert not permissions.can_edit_user_fields(MGR, report, ["salary"])
    assert not permissions.can_edit_user_fields(MGR, stranger, ["first_name"])
    assert permissions.can_edit_user_fields(EMP, report, ["email"])
    assert not permissions.can_edit_user_fields(EMP, report, ["job_title"])
    assert permissions.can_view_salary(EMP, report)
    assert not permissions.can_view_salary(EMP, stranger)
    assert permissions.can_view_salary(MGR, report)
