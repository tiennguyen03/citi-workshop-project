"""The shared connection retries once, for an Aurora Serverless cluster that is still waking up."""

import psycopg
import pytest

from app.core import db


class FakeConn:
    closed = False


def test_get_conn_retries_once_then_succeeds(monkeypatch):
    attempts = []

    def connect(*_args, **_kwargs):
        attempts.append(1)
        if len(attempts) == 1:
            raise psycopg.OperationalError("connection timeout expired")
        return FakeConn()

    monkeypatch.setattr(db.psycopg, "connect", connect)
    monkeypatch.setattr(db.time, "sleep", lambda _s: None)
    db.reset()
    assert isinstance(db.get_conn(), FakeConn)
    assert len(attempts) == 2
    db._conn = None


def test_get_conn_gives_up_after_the_retry(monkeypatch):
    def connect(*_args, **_kwargs):
        raise psycopg.OperationalError("connection timeout expired")

    monkeypatch.setattr(db.psycopg, "connect", connect)
    monkeypatch.setattr(db.time, "sleep", lambda _s: None)
    db.reset()
    with pytest.raises(psycopg.OperationalError):
        db.get_conn()
    db._conn = None
