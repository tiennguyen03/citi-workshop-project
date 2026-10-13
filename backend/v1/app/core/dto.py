"""
Request DTO base (pydantic). camelCase on the wire, snake_case in Python, unknown fields rejected
so a client can never smuggle in a field the role is not allowed to set (security.md).
"""

from typing import TypeVar

from pydantic import BaseModel, ConfigDict
from pydantic import ValidationError as PydanticValidationError
from pydantic.alias_generators import to_camel

from app.core.errors import ValidationError

T = TypeVar("T", bound=BaseModel)


class RequestModel(BaseModel):
    """Base class for all request bodies."""

    model_config = ConfigDict(
        extra="forbid",
        alias_generator=to_camel,
        populate_by_name=True,
        str_strip_whitespace=True,
    )


def parse(model: type[T], data: dict) -> T:
    """Validate `data` into `model`, converting pydantic errors into our 400 envelope."""
    try:
        return model.model_validate(data)
    except PydanticValidationError as exc:
        first = exc.errors()[0]
        field = ".".join(str(part) for part in first["loc"]) or None
        message = first["msg"]
        raise ValidationError(f"{field}: {message}" if field else message, field=field) from exc
