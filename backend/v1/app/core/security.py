"""Password hashing and JWT issuing/verification (security.md)."""

from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import jwt

from app.core.config import get_settings
from app.core.errors import Unauthenticated

ALGORITHM = "HS256"


def hash_password(plain: str) -> str:
    """Hash a password with bcrypt using the configured cost."""
    rounds = get_settings().bcrypt_rounds
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt(rounds=rounds)).decode()


def verify_password(plain: str, hashed: str) -> bool:
    """Constant-time check of a plaintext password against a bcrypt hash."""
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except ValueError:
        return False


def issue_token(user_id: str, role: str, now: datetime | None = None) -> tuple[str, datetime]:
    """Create a signed JWT for `user_id`. Returns (token, expiry)."""
    settings = get_settings()
    issued_at = now or datetime.now(UTC)
    expires_at = issued_at + timedelta(seconds=settings.jwt_ttl_seconds)
    payload = {"sub": user_id, "role": role, "iat": issued_at, "exp": expires_at}
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM), expires_at


def decode_token(token: str) -> dict[str, Any]:
    """Validate a JWT and return its claims. Raises Unauthenticated on any problem."""
    try:
        return jwt.decode(token, get_settings().jwt_secret, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError as exc:
        raise Unauthenticated("Session expired, please log in again") from exc
    except jwt.InvalidTokenError as exc:
        raise Unauthenticated("Invalid authentication token") from exc


def bearer_token(headers: dict[str, str]) -> str | None:
    """Extract the token from an `Authorization: Bearer …` header (case-insensitive)."""
    value = headers.get("authorization") or headers.get("Authorization")
    if not value:
        return None
    scheme, _, token = value.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        return None
    return token.strip()
