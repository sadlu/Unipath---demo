import os
import sys
import logging
from dataclasses import dataclass, field
from typing import Optional

import requests

logger = logging.getLogger(__name__)


def _ollama_reachable(host: str) -> bool:
    try:
        r = requests.get(f"{host}/api/tags", timeout=2)
        return r.ok
    except requests.RequestException:
        return False


def _get_env(name: str, default: str = "") -> str:
    val = os.getenv(name, default)
    if not val and not name.startswith("SMTP_") and not name.startswith("OPENAI_") and not name == "PORT":
        if name not in ("CORS_ORIGINS", "DATABASE_URL", "OLLAMA_HOST", "PORT"):
            pass
    return val


def _check_key(prefix: str, name: str) -> bool:
    val = os.getenv(name, "")
    if val and len(val) > 8:
        return True
    return False


@dataclass
class Settings:
    openai_api_key: Optional[str] = field(
        default_factory=lambda: _get_env("OPENAI_API_KEY")
    )
    openai_model: str = field(default="gpt-4o")

    ollama_host: str = field(default="http://127.0.0.1:11434")
    ollama_model: str = field(default_factory=lambda: os.getenv("OLLAMA_MODEL", "qwen2.5:0.5b"))
    ollama_enabled: bool = field(default=False)

    groq_api_key: str = field(default_factory=lambda: _get_env("GROQ_API_KEY"))
    groq_model: str = field(default="llama-3.3-70b-versatile")

    gemini_api_key: str = field(default_factory=lambda: _get_env("GEMINI_API_KEY"))
    gemini_model: str = field(default="gemini-2.5-flash")

    nvidia_api_key: str = field(default_factory=lambda: _get_env("NVIDIA_API_KEY"))
    nvidia_model: str = field(default="meta/llama-3.3-70b-instruct")

    openrouter_api_key: str = field(default_factory=lambda: _get_env("OPENROUTER_API_KEY"))
    openrouter_model: str = field(default="nvidia/llama-3.3-nemotron-super-49b-v1:free")

    huggingface_api_key: str = field(default_factory=lambda: _get_env("HUGGINGFACE_API_KEY"))
    huggingface_model: str = field(default="mistralai/Mistral-7B-Instruct-v0.3")

    cloudflare_api_key: str = field(default_factory=lambda: _get_env("CLOUDFLARE_API_KEY"))
    cloudflare_account_id: str = field(default_factory=lambda: _get_env("CLOUDFLARE_ACCOUNT_ID"))
    cloudflare_model: str = field(default="@cf/meta/llama-3.1-8b-instruct")

    together_api_key: str = field(default_factory=lambda: _get_env("TOGETHER_API_KEY"))
    together_model: str = field(default="mistralai/Mixtral-8x7B-Instruct-v0.1")

    server_host: str = field(default="0.0.0.0")
    server_port: int = field(default_factory=lambda: int(os.getenv("PORT", "8080")))

    smtp_host: str = field(default_factory=lambda: os.getenv("SMTP_HOST", "smtp.gmail.com"))
    smtp_port: int = field(default_factory=lambda: int(os.getenv("SMTP_PORT", "587")))
    smtp_username: str = field(default_factory=lambda: _get_env("SMTP_USERNAME"))
    smtp_password: str = field(default_factory=lambda: _get_env("SMTP_PASSWORD"))
    smtp_from_email: str = field(
        default_factory=lambda: os.getenv("SMTP_FROM_EMAIL", os.getenv("SMTP_USERNAME", ""))
    )

    def __post_init__(self):
        env = os.getenv("OLLAMA_ENABLED")
        if env is not None:
            self.ollama_enabled = env.lower() in ("1", "true", "yes")
        else:
            self.ollama_enabled = _ollama_reachable(self.ollama_host)

        if not self.smtp_username or not self.smtp_password:
            logger.warning("SMTP not configured — email features disabled")

    @property
    def has_openai_key(self) -> bool:
        return _check_key("sk-", "OPENAI_API_KEY")

    @property
    def has_groq_key(self) -> bool:
        return _check_key("gsk_", "GROQ_API_KEY")

    @property
    def has_gemini_key(self) -> bool:
        return _check_key("AIza", "GEMINI_API_KEY")

    @property
    def has_nvidia_key(self) -> bool:
        return _check_key("nvapi-", "NVIDIA_API_KEY")

    @property
    def has_openrouter_key(self) -> bool:
        return _check_key("sk-or-", "OPENROUTER_API_KEY")

    @property
    def has_huggingface_key(self) -> bool:
        return _check_key("hf_", "HUGGINGFACE_API_KEY")

    @property
    def has_cloudflare_key(self) -> bool:
        return bool(self.cloudflare_api_key) and bool(self.cloudflare_account_id)

    @property
    def has_together_key(self) -> bool:
        return _check_key("", "TOGETHER_API_KEY")

    @property
    def smtp_configured(self) -> bool:
        return bool(self.smtp_username) and bool(self.smtp_password)


settings = Settings()
