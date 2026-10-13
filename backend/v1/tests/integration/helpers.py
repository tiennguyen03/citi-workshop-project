"""Call the real Lambda handler as HTTP, for integration tests."""

import json
from typing import Any

import function


def call(method: str, path: str, body: dict | None = None, token: str | None = None) -> tuple[int, Any]:
    """Invoke the handler with a Function-URL style event. Returns (status, parsed body)."""
    headers = {"content-type": "application/json"}
    if token:
        headers["authorization"] = f"Bearer {token}"
    event = {
        "rawPath": path,
        "rawQueryString": "",
        "headers": headers,
        "requestContext": {"http": {"method": method}},
        "body": json.dumps(body) if body is not None else "",
        "isBase64Encoded": False,
    }
    out = function.handler(event)
    parsed = json.loads(out["body"]) if out["body"] else None
    return out["statusCode"], parsed


def login(username: str = "admin", password: str = "Admin123!") -> tuple[str, dict]:
    status, body = call("POST", "/api/v1/auth/login", {"username": username, "password": password})
    assert status == 200, body
    return body["token"], body["user"]
