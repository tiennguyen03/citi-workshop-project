"""The authenticated caller, attached to every request after the auth middleware."""

from dataclasses import dataclass

ROLE_ADMIN = "admin"
ROLE_MANAGER = "manager"
ROLE_EMPLOYEE = "employee"
ROLES = (ROLE_ADMIN, ROLE_MANAGER, ROLE_EMPLOYEE)


@dataclass(frozen=True)
class Actor:
    """Minimal identity needed for permission decisions."""

    id: str
    role: str
    manager_id: str | None = None

    @property
    def is_admin(self) -> bool:
        return self.role == ROLE_ADMIN

    @property
    def is_manager(self) -> bool:
        return self.role == ROLE_MANAGER

    @property
    def is_employee(self) -> bool:
        return self.role == ROLE_EMPLOYEE
