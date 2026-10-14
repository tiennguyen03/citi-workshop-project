"""
PostgreSQL access. One module-level connection reused across Lambda invocations.

The connection runs in autocommit mode; multi-statement work must happen inside
`with transaction() as conn:` (nested calls become savepoints). The router opens one
transaction per mutating request so services and the audit insert commit together.
"""

import logging
import time
from collections.abc import Iterator, Sequence
from contextlib import contextmanager
from typing import Any

import psycopg
from psycopg.rows import dict_row

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_conn: psycopg.Connection | None = None


CONNECT_ATTEMPTS = 2  # a paused Aurora Serverless cluster can refuse the very first attempt while it wakes


def get_conn() -> psycopg.Connection:
    """Return the shared connection, (re)connecting if needed (one retry for a database that is still waking up)."""
    global _conn
    if _conn is None or _conn.closed:
        for attempt in range(1, CONNECT_ATTEMPTS + 1):
            try:
                _conn = psycopg.connect(get_settings().pg_dsn, autocommit=True, row_factory=dict_row)
                break
            except psycopg.OperationalError:
                if attempt == CONNECT_ATTEMPTS:
                    raise
                logger.warning("Database connection attempt %d failed; retrying once", attempt)
                time.sleep(2)
    return _conn


def reset() -> None:
    """Drop the cached connection (after an error, or between tests)."""
    global _conn
    if _conn is not None and not _conn.closed:
        try:
            _conn.close()
        except psycopg.Error:  # pragma: no cover - best effort
            logger.warning("Failed to close connection cleanly")
    _conn = None


@contextmanager
def transaction() -> Iterator[psycopg.Connection]:
    """Run the block atomically. Rolls back on any exception and resets a broken connection."""
    conn = get_conn()
    try:
        with conn.transaction():
            yield conn
    except psycopg.OperationalError:
        reset()
        raise


def query(
    sql: str, params: Sequence[Any] | dict[str, Any] = (), conn: psycopg.Connection | None = None
) -> list[dict[str, Any]]:
    """Execute a SELECT and return all rows as dicts."""
    with (conn or get_conn()).cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


def query_one(
    sql: str, params: Sequence[Any] | dict[str, Any] = (), conn: psycopg.Connection | None = None
) -> dict[str, Any] | None:
    """Execute a SELECT expected to return at most one row."""
    with (conn or get_conn()).cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchone()


def execute(sql: str, params: Sequence[Any] | dict[str, Any] = (), conn: psycopg.Connection | None = None) -> int:
    """Execute a statement and return the affected row count."""
    with (conn or get_conn()).cursor() as cur:
        cur.execute(sql, params)
        return cur.rowcount
