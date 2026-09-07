from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables / .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── Database ──────────────────────────────────────────────────────────
    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5432/rural_healthcare"

    # ── Supabase ──────────────────────────────────────────────────────────
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""

    # ── ABDM (Ayushman Bharat Digital Mission) ────────────────────────────
    ABDM_CLIENT_ID: str = ""
    ABDM_CLIENT_SECRET: str = ""

    # ── Bhashini (Translation) ────────────────────────────────────────────
    BHASHINI_API_KEY: str = ""
    BHASHINI_USER_ID: str = ""

    # ── Maps ──────────────────────────────────────────────────────────────
    MAPS_API_KEY: str = ""


settings = Settings()
