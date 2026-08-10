from __future__ import annotations

import os
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field, field_validator


class Settings(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    database_path: Path
    api_key: str = Field(min_length=32, max_length=256)
    environment: str = Field(default="development", min_length=1, max_length=32)
    rate_limit_per_minute: int = Field(default=60, ge=1, le=600)
    max_request_bytes: int = Field(default=16_384, ge=1_024, le=1_048_576)

    @field_validator("database_path")
    @classmethod
    def absolute_database_path(cls, value: Path) -> Path:
        return value.expanduser().resolve()

    @classmethod
    def from_environment(cls) -> Settings:
        database_path = os.getenv("HOUSING_DB_PATH")
        api_key = os.getenv("HOUSING_API_KEY")
        if not database_path or not api_key:
            raise RuntimeError(
                "HOUSING_DB_PATH and HOUSING_API_KEY must be configured"
            )
        return cls(
            database_path=Path(database_path),
            api_key=api_key,
            environment=os.getenv("HOUSING_ENV", "development"),
            rate_limit_per_minute=int(
                os.getenv("HOUSING_RATE_LIMIT_PER_MINUTE", "60")
            ),
            max_request_bytes=int(os.getenv("HOUSING_MAX_REQUEST_BYTES", "16384")),
        )
