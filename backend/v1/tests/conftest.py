"""Shared test configuration: force local settings before any app module loads."""

import os

os.environ.setdefault("IS_LOCAL", "true")
os.environ.setdefault("BCRYPT_ROUNDS", "4")
os.environ.setdefault("POSTGRES_HOST", "localhost")
os.environ.setdefault("POSTGRES_PORT", "5432")
os.environ.setdefault("POSTGRES_USER", "postgres")
os.environ.setdefault("POSTGRES_PASS", "postgres123")
os.environ.setdefault("POSTGRES_NAME", "tracker_test")
os.environ.setdefault("SEED_DEMO_DATA", "false")  # tests build their own fixtures; test_seed loads it explicitly
