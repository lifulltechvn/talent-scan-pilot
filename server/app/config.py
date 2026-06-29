from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://talent:talent@db:5432/talentscan"
    SECRET_KEY: str = "change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # AWS Bedrock
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "us-east-1"
    BEDROCK_MODEL_SONNET: str = "us.anthropic.claude-sonnet-4-5-20250929-v1:0"
    BEDROCK_MODEL_HAIKU: str = "us.anthropic.claude-haiku-4-5-20251001-v1:0"
    BEDROCK_MODEL_EMBEDDING: str = "amazon.titan-embed-text-v2:0"

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

    ENVIRONMENT: str = "dev"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if self.SECRET_KEY == "change-me":
            if self.ENVIRONMENT != "dev":
                raise RuntimeError("SECRET_KEY must be changed from default 'change-me' in production!")
            import warnings
            warnings.warn("SECRET_KEY is using default value 'change-me'. Set a strong secret in .env for production!", stacklevel=2)


settings = Settings()
