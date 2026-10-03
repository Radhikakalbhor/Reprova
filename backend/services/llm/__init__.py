"""
LLM Provider Package for Reprova.
Exposes OpenRouterProvider and GroqProvider, with OpenRouter as the primary default.
"""
import os
from typing import Union
from .openrouter_provider import (
    OpenRouterProvider,
    get_openrouter_provider,
    OpenRouterProviderError,
    OpenRouterNotConfiguredError,
    OpenRouterAPIError,
    OpenRouterJSONError,
    OpenRouterRateLimitError,
)
from .groq_provider import (
    GroqProvider,
    GroqProviderError,
    GroqNotConfiguredError,
    GroqAPIError,
    GroqJSONError,
)

# Unified LLM Provider Exception Aliases
LLMProviderError = OpenRouterProviderError
LLMNotConfiguredError = OpenRouterNotConfiguredError
LLMAPIError = OpenRouterAPIError
LLMJSONError = OpenRouterJSONError


def get_llm_provider() -> Union[OpenRouterProvider, GroqProvider]:
    """
    Factory function for the active LLM provider.
    Defaults to OpenRouter unless LLM_PROVIDER is explicitly set to 'groq'.
    """
    provider_name = os.getenv("LLM_PROVIDER", "openrouter").strip().lower()
    if provider_name == "groq":
        from .groq_provider import get_groq_provider as _get_groq
        return _get_groq()
    return get_openrouter_provider()


# Legacy aliases to maintain full backwards compatibility without breaking any callers
get_groq_provider = get_llm_provider


__all__ = [
    "OpenRouterProvider",
    "get_openrouter_provider",
    "OpenRouterProviderError",
    "OpenRouterNotConfiguredError",
    "OpenRouterAPIError",
    "OpenRouterJSONError",
    "OpenRouterRateLimitError",
    "GroqProvider",
    "GroqProviderError",
    "GroqNotConfiguredError",
    "GroqAPIError",
    "GroqJSONError",
    "get_llm_provider",
    "get_groq_provider",
    "LLMProviderError",
    "LLMNotConfiguredError",
    "LLMAPIError",
    "LLMJSONError",
]
