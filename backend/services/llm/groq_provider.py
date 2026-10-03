"""
Groq LLM Provider Service.
Uses Groq's official Python SDK (`from groq import Groq`).
Handles configuration via GROQ_API_KEY and GROQ_MODEL (defaults to openai/gpt-oss-120b).
Enforces structured JSON output and safe error handling without secret leakage.
"""
import os
import json
import re
from typing import Dict, Any, Optional, Union, List
from dotenv import load_dotenv

# Ensure environment variables are loaded from .env
for env_path in [".env", "backend/.env", "/app/.env"]:
    if os.path.exists(env_path):
        load_dotenv(env_path)
        break


class GroqProviderError(Exception):
    """Base exception for Groq provider errors."""
    pass


class GroqNotConfiguredError(GroqProviderError):
    """Raised when GROQ_API_KEY is missing or empty."""
    pass


class GroqAPIError(GroqProviderError):
    """Raised when the Groq API request fails."""
    pass


class GroqJSONError(GroqProviderError):
    """Raised when Groq returns malformed or unparseable structured JSON."""
    pass


def _clean_json_str(content: str) -> str:
    """Defensively remove markdown code fences, comments, and whitespace."""
    if not content:
        return ""
    cleaned = content.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    return cleaned.strip()


class GroqProvider:
    """
    Encapsulated Groq Cloud LLM Provider.
    Manages API initialization, structured JSON generation, and error sanitation.
    """

    def __init__(self, api_key: Optional[str] = None, model_name: Optional[str] = None):
        self._api_key = api_key if api_key is not None else os.getenv("GROQ_API_KEY")
        self.model_name = model_name if model_name is not None else os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
        self._client = None

    @property
    def is_configured(self) -> bool:
        """Check if GROQ_API_KEY is configured without logging it."""
        return bool(self._api_key and len(self._api_key.strip()) > 0)

    def _get_client(self):
        """Lazily initialize official Groq client."""
        if not self.is_configured:
            raise GroqNotConfiguredError("Groq API key is not configured.")

        if self._client is None:
            from groq import Groq
            self._client = Groq(api_key=self._api_key)

        return self._client

    def generate_structured_json(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        timeout_seconds: int = 30,
        max_tokens: Optional[int] = 800
    ) -> Union[Dict[str, Any], List[Any]]:
        """
        Generate structured JSON response using Groq.
        Applies response_format={"type": "json_object"} and defensively parses JSON.
        """
        client = self._get_client()

        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        else:
            messages.append({
                "role": "system",
                "content": "You are a precise, evidence-grounded ML analysis assistant. Always respond with valid JSON."
            })
        messages.append({"role": "user", "content": prompt})

        kwargs: Dict[str, Any] = {
            "model": self.model_name,
            "messages": messages,
            "response_format": {"type": "json_object"},
            "temperature": 0.0,
            "timeout": timeout_seconds,
        }
        if max_tokens:
            kwargs["max_tokens"] = max_tokens

        try:
            chat_completion = client.chat.completions.create(**kwargs)
        except Exception as api_err:
            clean_msg = self._sanitize_error_message(api_err)
            raise GroqAPIError(f"Groq API request failed: {clean_msg}") from api_err

        if not chat_completion or not chat_completion.choices:
            raise GroqAPIError("Groq API request failed: empty response received from model.")

        choice = chat_completion.choices[0]
        raw_text = choice.message.content if choice.message else None

        if not raw_text:
            raise GroqAPIError("Groq API request failed: empty content received from model.")

        cleaned_text = _clean_json_str(raw_text)
        try:
            parsed = json.loads(cleaned_text)
            if not isinstance(parsed, (dict, list)):
                raise ValueError("Parsed JSON root is not an object or array.")
            return parsed
        except (json.JSONDecodeError, ValueError) as json_err:
            raise GroqJSONError(f"Groq returned invalid structured output: {str(json_err)}") from json_err

    def generate_text(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        timeout_seconds: int = 30
    ) -> str:
        """Generate text response using Groq."""
        client = self._get_client()

        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})

        try:
            chat_completion = client.chat.completions.create(
                model=self.model_name,
                messages=messages,
                temperature=0.0,
                timeout=timeout_seconds,
            )
        except Exception as api_err:
            clean_msg = self._sanitize_error_message(api_err)
            raise GroqAPIError(f"Groq API request failed: {clean_msg}") from api_err

        if not chat_completion or not chat_completion.choices:
            raise GroqAPIError("Groq API request failed: empty response received from model.")

        choice = chat_completion.choices[0]
        raw_text = choice.message.content if choice.message else None

        if not raw_text:
            raise GroqAPIError("Groq API request failed: empty content received from model.")

        return raw_text.strip()

    def _sanitize_error_message(self, exc: Exception) -> str:
        """Strip any API key, authorization token, or sensitive parameter from error messages."""
        msg = str(exc)
        if self._api_key:
            msg = msg.replace(self._api_key, "[REDACTED_GROQ_KEY]")
        # Redact generic gsk patterns or authorization headers
        msg = re.sub(r"gsk_[a-zA-Z0-9_-]+", "[REDACTED_GROQ_KEY]", msg)
        msg = re.sub(r"key=[a-zA-Z0-9_\-\.]+", "key=[REDACTED]", msg)
        msg = re.sub(r"Bearer\s+[a-zA-Z0-9_\-\.]+", "Bearer [REDACTED]", msg)
        return msg


# Module-level singleton
_provider_instance: Optional[GroqProvider] = None


def get_groq_provider() -> GroqProvider:
    """Get or create singleton GroqProvider instance."""
    global _provider_instance
    if _provider_instance is None:
        _provider_instance = GroqProvider()
    return _provider_instance
