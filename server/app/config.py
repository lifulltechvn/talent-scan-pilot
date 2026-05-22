from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://talent:talent@db:5432/talentscan"
    SECRET_KEY: str = "change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    APP_VERSION: str = "1.0.0"

    # Email
    MAIL_PROVIDER: str = "smtp"  # smtp | ses
    MAIL_SERVER: str = ""
    MAIL_PORT: int = 2525
    MAIL_USERNAME: str = ""
    MAIL_PASSWORD: str = ""
    MAIL_USE_TLS: bool = True
    MAIL_FROM: str = "hr@lftalentscan.com"
    MAIL_FROM_NAME: str = "LF Talent Scan"

    model_config = {"env_file": ".env"}


settings = Settings()
