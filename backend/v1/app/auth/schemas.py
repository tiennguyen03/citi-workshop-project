"""Auth request DTOs."""

from pydantic import Field

from app.core.dto import RequestModel


class LoginRequest(RequestModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)
