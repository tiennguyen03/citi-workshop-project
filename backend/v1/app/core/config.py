"""
Runtime configuration. The only module allowed to read environment variables.

Values come from the env vars Terraform injects (POSTGRES_*, IS_LOCAL, APP_ID) plus the
optional JWT_SECRET (decisions.md D5).
"""

import hashlib
import os
from dataclasses import dataclass
from functools import lru_cache

JWT_TTL_SECONDS = 8 * 60 * 60

# Dev-only fallback used when IS_LOCAL=true and JWT_SECRET is not set. Never used in AWS,
# where a missing JWT_SECRET is derived from deployment secrets (D5) or fails loudly.
_DEV_JWT_SECRET = "dev-only-insecure-jwt-secret"  # nosec B105


@dataclass(frozen=True)
class Settings:
    """Immutable snapshot of configuration for this process."""

    is_local: bool
    pg_dsn: str
    jwt_secret: str
    jwt_ttl_seconds: int
    bcrypt_rounds: int
    bootstrap_admin_password: str


def _resolve_jwt_secret(is_local: bool) -> str:
    explicit = os.getenv("JWT_SECRET", "").strip()
    if explicit:
        return explicit
    if is_local:
        return _DEV_JWT_SECRET
    # D5 fallback: derive from values that are already secret and unique per deployment.
    pg_pass = os.getenv("POSTGRES_PASS", "")
    app_id = os.getenv("APP_ID", "")
    if not pg_pass:
        raise RuntimeError("JWT_SECRET is not set and no POSTGRES_PASS is available to derive one")
    return hashlib.sha256(f"{pg_pass}:{app_id}:jwt".encode()).hexdigest()


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Load settings once per process. Tests call `get_settings.cache_clear()` to re-read env."""
    is_local = os.getenv("IS_LOCAL", "false").lower() == "true"
    dsn = (
        f"host={os.getenv('POSTGRES_HOST', 'localhost')} "
        f"port={os.getenv('POSTGRES_PORT', '5432')} "
        f"user={os.getenv('POSTGRES_USER', 'postgres')} "
        f"password={os.getenv('POSTGRES_PASS', 'postgres123')} "
        f"dbname={os.getenv('POSTGRES_NAME', 'postgres')} "
        f"connect_timeout=10" + ("" if is_local else " sslmode=require")
    )
    return Settings(
        is_local=is_local,
        pg_dsn=dsn,
        jwt_secret=_resolve_jwt_secret(is_local),
        jwt_ttl_seconds=int(os.getenv("JWT_TTL_SECONDS", str(JWT_TTL_SECONDS))),
        bcrypt_rounds=int(os.getenv("BCRYPT_ROUNDS", "4" if is_local else "12")),
        bootstrap_admin_password=os.getenv("BOOTSTRAP_ADMIN_PASSWORD", "Admin123!"),
    )
