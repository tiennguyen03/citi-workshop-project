"""
Integration fixtures: a real local PostgreSQL database `tracker_test`, created on demand,
schema applied once per session, all tables truncated before each test.
"""

import os

import psycopg
import pytest

from app.core import db, schema
from app.core.config import get_settings

TEST_DB = os.environ.get("POSTGRES_NAME", "tracker_test")


def _admin_dsn() -> str:
    return (
        f"host={os.environ['POSTGRES_HOST']} port={os.environ['POSTGRES_PORT']} "
        f"user={os.environ['POSTGRES_USER']} password={os.environ['POSTGRES_PASS']} dbname=postgres"
    )


@pytest.fixture(scope="session", autouse=True)
def test_database():
    """Create the test database if missing and apply the schema."""
    try:
        with psycopg.connect(_admin_dsn(), autocommit=True) as conn:
            exists = conn.execute("SELECT 1 FROM pg_database WHERE datname = %s", (TEST_DB,)).fetchone()
            if not exists:
                conn.execute(f'CREATE DATABASE "{TEST_DB}"')
    except psycopg.OperationalError as exc:  # pragma: no cover
        pytest.skip(f"PostgreSQL not reachable for integration tests: {exc}")
    get_settings.cache_clear()
    db.reset()
    schema.reset_flag()
    schema.apply()
    yield
    db.reset()


@pytest.fixture(autouse=True)
def clean_tables(test_database):
    """Start every test from empty tables and a fresh bootstrap admin."""
    tables = ", ".join(schema.TABLES_IN_DEPENDENCY_ORDER)
    db.execute(f"TRUNCATE {tables} RESTART IDENTITY CASCADE")
    schema.reset_flag()
    schema.ensure()
    yield
