import os
import sys
from dataclasses import dataclass, field
from typing import Optional

import requests


def _ollama_reachable(host: str) -> bool:
    try:
        r = requests.get(f"{host}/api/tags", timeout=2)
        return r.ok
    except requests.RequestException:
        return False


def _require_env(name: str) -> str:
    val = os.getenv(name, "")
    if name.startswith("SMTP_") and not val:
        print(f"[config] WARNING: {name} not set; email features will fail", file=sys.stderr)
        return ""
    return val


@dataclass
class Settings:
    openai_api_key: Optional[str] = field(
        default_factory=lambda: os.getenv("OPENAI_API_KEY", "")
    )
    openai_model: str = field(default="gpt-4o")

    ollama_host: str = field(default="http://127.0.0.1:11434")
    ollama_model: str = field(default="qwen2.5:0.5b")
    ollama_enabled: bool = field(default=False)

    server_host: str = field(default="0.0.0.0")
    server_port: int = field(default=8000)

    smtp_host: str = field(default_factory=lambda: _require_env("SMTP_HOST") or "smtp.gmail.com")
    smtp_port: int = field(default_factory=lambda: int(os.getenv("SMTP_PORT", "587")))
    smtp_username: str = field(default_factory=lambda: _require_env("SMTP_USERNAME"))
    smtp_password: str = field(default_factory=lambda: _require_env("SMTP_PASSWORD"))
    smtp_from_email: str = field(
        default_factory=lambda: os.getenv("SMTP_FROM_EMAIL", os.getenv("SMTP_USERNAME", ""))
    )

    def __post_init__(self):
        env = os.getenv("OLLAMA_ENABLED")
        if env is not None:
            self.ollama_enabled = env.lower() in ("1", "true", "yes")
        else:
            self.ollama_enabled = _ollama_reachable(self.ollama_host)

        missing = []
        if not self.smtp_username:
            missing.append("SMTP_USERNAME")
        if not self.smtp_password:
            missing.append("SMTP_PASSWORD")
        if missing:
            print(f"[config] WARNING: Missing env vars: {', '.join(missing)}. Email sending disabled.", file=sys.stderr)

    @property
    def has_openai_key(self) -> bool:
        return bool(self.openai_api_key)

    @property
    def smtp_configured(self) -> bool:
        return bool(self.smtp_username) and bool(self.smtp_password)


settings = Settings()
