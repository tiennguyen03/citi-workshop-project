"""Request parsing from the Lambda event and Response serialisation."""

import base64
from datetime import date
from decimal import Decimal

import pytest

from app.core.errors import ValidationError
from app.http import Request, Response, created, no_content, ok


def test_request_from_function_url_event():
    event = {
        "rawPath": "/api/v1/projects",
        "rawQueryString": "archived=true&status=",
        "headers": {"Authorization": "Bearer abc", "Content-Type": "application/json"},
        "requestContext": {"http": {"method": "post"}},
        "body": '{"name": "x"}',
        "isBase64Encoded": False,
    }
    req = Request.from_lambda_event(event)
    assert req.method == "POST"
    assert req.path == "/api/v1/projects"
    assert req.query == {"archived": "true", "status": ""}
    assert req.headers["authorization"] == "Bearer abc"
    assert req.json() == {"name": "x"}


def test_request_decodes_base64_body():
    body = base64.b64encode(b'{"a": 1}').decode()
    req = Request.from_lambda_event({"body": body, "isBase64Encoded": True})
    assert req.json() == {"a": 1}


def test_request_json_errors():
    assert Request(method="POST", path="/", raw_body="   ").json() == {}
    with pytest.raises(ValidationError):
        Request(method="POST", path="/", raw_body="{bad").json()
    with pytest.raises(ValidationError):
        Request(method="POST", path="/", raw_body="[1]").json()


def test_response_serialises_decimal_and_date():
    res = Response(200, {"budget": Decimal("12.50"), "start": date(2026, 1, 2)})
    out = res.to_lambda()
    assert out["statusCode"] == 200
    assert out["headers"]["Content-Type"] == "application/json"
    assert out["body"] == '{"budget": 12.5, "start": "2026-01-02"}'


def test_no_content_has_empty_body():
    assert no_content().to_lambda() == {"statusCode": 204, "headers": {"Content-Type": "application/json"}, "body": ""}


def test_helpers_carry_audit_fields():
    res = created({"id": "A"}, audit_summary="made", audit_entity_id="AAAAAA")
    assert res.status == 201 and res.audit_summary == "made" and res.audit_entity_id == "AAAAAA"
    assert ok({}).status == 200
    with pytest.raises(TypeError):
        ok({}, nope="x")
