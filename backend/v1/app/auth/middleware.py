"""
Per-request authentication. Installed on the router; runs before every protected handler.

The role and manager come from the database, not the token, so role changes and
deactivation take effect on the next request (security.md).
"""

from app.core import security
from app.core.actor import Actor
from app.core.errors import Unauthenticated
from app.http import Request
from app.users import repository as users_repo


def authenticate(request: Request, repo=users_repo) -> Actor:
    token = security.bearer_token(request.headers)
    if not token:
        raise Unauthenticated("Missing bearer token")
    claims = security.decode_token(token)
    user = repo.find_by_id(str(claims.get("sub", "")))
    if user is None or not user["is_active"]:
        raise Unauthenticated("This account is no longer active")
    return Actor(id=user["id"], role=user["role"], manager_id=user["manager_id"])
