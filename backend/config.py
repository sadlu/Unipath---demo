import os
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Settings:
    openai_api_key: Optional[str] = field(
        default_factory=lambda: os.getenv("OPENAI_API_KEY", "")
    )
    openai_model: str = field(default="gpt-4o")

    server_host: str = field(default="0.0.0.0")
    server_port: int = field(default=8000)

    smtp_host: str = field(default_factory=lambda: os.getenv("SMTP_HOST", "smtp.gmail.com"))
    smtp_port: int = field(default_factory=lambda: int(os.getenv("SMTP_PORT", "587")))
    smtp_username: str = field(default_factory=lambda: os.getenv("SMTP_USERNAME", ""))
    smtp_password: str = field(default_factory=lambda: os.getenv("SMTP_PASSWORD", ""))
    smtp_from_email: str = field(
        default_factory=lambda: os.getenv("SMTP_FROM_EMAIL", os.getenv("SMTP_USERNAME", ""))
    )

    @property
    def has_openai_key(self) -> bool:
        return bool(self.openai_api_key)

    @property
    def smtp_configured(self) -> bool:
        return bool(self.smtp_username) and bool(self.smtp_password)


settings = Settings()
