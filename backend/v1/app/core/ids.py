"""Public 6-character identifiers (decisions.md D6)."""

import re
import secrets

ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O/1/I to avoid misreads
ID_LENGTH = 6
ID_PATTERN = r"[A-Z0-9]{6}"
ID_RE = re.compile(f"^{ID_PATTERN}$")


def new_id() -> str:
    """Generate a cryptographically random 6-character ID."""
    return "".join(secrets.choice(ID_ALPHABET) for _ in range(ID_LENGTH))


def is_valid_id(value: object) -> bool:
    """True if `value` has the shape of a public ID."""
    return isinstance(value, str) and ID_RE.match(value) is not None
