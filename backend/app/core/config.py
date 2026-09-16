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
    ABDM_BASE_URL: str = "https://abhasbx.abdm.gov.in/abha/api"
    ABDM_GATEWAY_URL: str = "https://dev.abdm.gov.in/api/hiecm/gateway"

    # ── Bhashini (Translation) ────────────────────────────────────────────
    BHASHINI_API_KEY: str = ""
    BHASHINI_USER_ID: str = ""
    BHASHINI_PIPELINE_URL: str = "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline"
    BHASHINI_INFERENCE_URL: str = "https://dhruva-api.bhashini.gov.in/services/inference/pipeline"

    # ── Maps ──────────────────────────────────────────────────────────────
    MAPS_API_KEY: str = ""

    # ── Auth / JWT ────────────────────────────────────────────────────────
    JWT_SECRET_KEY: str = "dev-secret-change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440  # 24 hours

    # ── OTP ───────────────────────────────────────────────────────────────
    OTP_DEV_CODE: str = "123456"


settings = Settings()
