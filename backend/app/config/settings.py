import json
import os

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Enterprise Workforce Analytics"
    ENVIRONMENT: str = "development"
    API_V1_STR: str = "/api/v1"

    # CORS Origins config
    BACKEND_CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: str | list[str]) -> list[str] | str:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            if isinstance(v, str):
                try:
                    return json.loads(v)
                except json.JSONDecodeError as e:
                    raise ValueError(f"Invalid BACKEND_CORS_ORIGINS JSON: {v!r}") from e
            return v
        raise ValueError(v)

    # Database Configuration (DATABASE_URL as primary)
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/workforce_analytics"

    # Security / JWT Configuration
    SECRET_KEY: str = "placeholder_key_please_change_in_env_file_for_security"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Account lockout after repeated failed logins
    LOGIN_MAX_FAILED_ATTEMPTS: int = 5
    LOGIN_LOCKOUT_MINUTES: int = 15

    @field_validator("SECRET_KEY")
    @classmethod
    def forbid_placeholder_secret_in_production(cls, v: str, info) -> str:
        environment = info.data.get("ENVIRONMENT", "development")
        if (
            environment == "production"
            and v == "placeholder_key_please_change_in_env_file_for_security"
        ):
            raise ValueError(
                "SECRET_KEY is still the default placeholder. Set a unique SECRET_KEY "
                "in the environment before running in production."
            )
        return v

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        # Standardize and explicitly set driver to psycopg (v3)
        url = self.DATABASE_URL
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+psycopg://", 1)
        elif url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+psycopg://", 1)
        return url

    # Load from root workspace directory .env (backend/app/config -> repo root)
    model_config = SettingsConfigDict(
        env_file=os.path.join(
            os.path.dirname(
                os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            ),
            ".env",
        ),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
