"""Auth request DTOs."""

from pydantic import Field, model_validator

from app.core.dto import RequestModel


class LoginRequest(RequestModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)


class ChangePasswordRequest(RequestModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)

    @model_validator(mode="after")
    def _different(self):
        if self.new_password == self.current_password:
            raise ValueError("newPassword must differ from the current password")
        return self
