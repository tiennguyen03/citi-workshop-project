"""Router: prefix stripping, matching, path params, auth gate, error envelope."""

import pytest

from app.core.errors import Conflict, Unauthenticated
from app.http import Request, Response
from app.router import Router, compile_pattern, normalise_path


def _req(method="GET", path="/", body="", headers=None):
    return Request(method=method, path=path, raw_body=body, headers=headers or {})


def test_normalise_path_strips_cloudfront_prefix():
    assert normalise_path("/api/v1/health") == "/health"
    assert normalise_path("/api/v1") == "/"
    assert normalise_path("/health") == "/health"
    assert normalise_path("/api/v10/x") == "/api/v10/x"


def test_compile_pattern_requires_six_char_ids():
    regex = compile_pattern("/projects/{id}/members/{userId}")
    assert regex.match("/projects/ABC123/members/XYZ789").groupdict() == {"id": "ABC123", "userId": "XYZ789"}
    assert regex.match("/projects/abc123/members/XYZ789") is None
    assert regex.match("/projects/ABC1234/members/XYZ789") is None


def test_dispatch_public_route_and_path_params():
    router = Router()
    router.add("GET", "/things/{id}", lambda r: Response(200, {"id": r.path_params["id"]}), auth=False)
    res = router.dispatch(_req("GET", "/api/v1/things/AAAAAA"))
    assert res.status == 200
    assert res.body == {"id": "AAAAAA"}


def test_unknown_path_is_404_and_wrong_method_is_405():
    router = Router()
    router.add("GET", "/things", lambda r: Response(200, []), auth=False)
    assert router.dispatch(_req("GET", "/nope")).status == 404
    res = router.dispatch(_req("POST", "/things"))
    assert res.status == 405
    assert res.body["error"]["code"] == "METHOD_NOT_ALLOWED"


def test_protected_route_without_authenticator_is_401():
    router = Router()
    router.add("GET", "/secret", lambda r: Response(200, {}))
    res = router.dispatch(_req("GET", "/secret"))
    assert res.status == 401
    assert res.body["error"]["code"] == "UNAUTHENTICATED"


def test_authenticator_failure_maps_to_401():
    def deny(_):
        raise Unauthenticated("bad token")

    router = Router(authenticator=deny)
    router.add("GET", "/secret", lambda r: Response(200, {}))
    res = router.dispatch(_req("GET", "/secret", headers={"authorization": "Bearer x"}))
    assert res.status == 401
    assert res.body["error"]["message"] == "bad token"


def test_app_error_envelope_includes_details():
    router = Router()

    def boom(_):
        raise Conflict("already there", {"field": "name"})

    router.add("GET", "/c", boom, auth=False)
    res = router.dispatch(_req("GET", "/c"))
    assert res.status == 409
    assert res.body == {"error": {"code": "CONFLICT", "message": "already there", "details": {"field": "name"}}}


def test_unexpected_exception_is_500_without_leaking_message():
    router = Router()

    def boom(_):
        raise RuntimeError("secret internals")

    router.add("GET", "/x", boom, auth=False)
    res = router.dispatch(_req("GET", "/x"))
    assert res.status == 500
    assert "secret" not in res.body["error"]["message"]


def test_mutating_route_uses_transaction_and_audit(monkeypatch):
    """A POST runs inside db.transaction() and records an audit row with the handler's summary."""
    calls = {}

    class FakeConn:
        pass

    class FakeTx:
        def __enter__(self):
            calls["tx"] = True
            return FakeConn()

        def __exit__(self, *exc):
            return False

    monkeypatch.setattr("app.router.db.transaction", lambda: FakeTx())

    def fake_record(conn, **kwargs):
        calls["audit"] = kwargs

    monkeypatch.setattr("app.router.audit.record", fake_record)

    router = Router()
    router.add(
        "POST",
        "/things/{id}",
        lambda r: Response(201, {"ok": True}, audit_summary="Made thing"),
        auth=False,
        audit="thing.create",
    )
    res = router.dispatch(_req("POST", "/things/AAAAAA", body='{"name": "n", "password": "p"}'))
    assert res.status == 201
    assert calls["tx"] is True
    assert calls["audit"]["action"] == "thing.create"
    assert calls["audit"]["entity_id"] == "AAAAAA"
    assert calls["audit"]["summary"] == "Made thing"
    assert calls["audit"]["details"] == {"name": "n", "password": "p"}  # sanitised inside audit.record


@pytest.mark.parametrize("path", ["/health", "/api/v1/health/"])
def test_trailing_slash_tolerated(path):
    router = Router()
    router.add("GET", "/health", lambda r: Response(200, {"status": "ok"}), auth=False)
    assert router.dispatch(_req("GET", path)).status == 200
