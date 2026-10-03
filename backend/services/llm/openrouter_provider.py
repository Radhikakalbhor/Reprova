"""
OpenRouter LLM Provider Service for Reprova.
Uses OpenRouter's OpenAI-compatible HTTP API (https://openrouter.ai/api/v1).
Supports openrouter/free model routing and custom free models.
Enforces structured JSON output and safe error handling without secret leakage.
"""
import os
import json
import re
import time
from typing import Dict, Any, Optional, Union, List
import httpx
from dotenv import load_dotenv

# Ensure environment variables are loaded from .env
for env_path in [".env", "backend/.env", "/app/.env"]:
    if os.path.exists(env_path):
        load_dotenv(env_path)
        break


class OpenRouterProviderError(Exception):
    """Base exception for OpenRouter provider errors."""
    pass


class OpenRouterNotConfiguredError(OpenRouterProviderError):
    """Raised when OPENROUTER_API_KEY is missing or empty."""
    pass


class OpenRouterAPIError(OpenRouterProviderError):
    """Raised when the OpenRouter API request fails."""
    pass


class OpenRouterRateLimitError(OpenRouterAPIError):
    """Raised when OpenRouter returns HTTP 429 (Rate limit reached)."""
    pass


class OpenRouterJSONError(OpenRouterProviderError):
    """Raised when OpenRouter returns malformed or unparseable structured JSON."""
    pass


DEFAULT_FREE_MODEL = "liquid/lfm-2.5-2.6b:free"


def _extract_structured_json(raw_text: str) -> Union[Dict[str, Any], List[Any]]:
    """
    Safely and robustly extracts JSON object or array from LLM output.
    Supports:
    1. Raw JSON object or array.
    2. Markdown fenced code blocks (```json ... ``` or ``` ... ```).
    3. Surrounding text containing a valid JSON object or array using JSONDecoder().raw_decode().
    4. Regex boundary extraction fallback.
    Never uses unsafe eval() or invents fields.
    """
    if not raw_text or not raw_text.strip():
        raise OpenRouterJSONError("Cannot parse JSON from empty or whitespace content.")

    text = raw_text.strip()

    # Strategy 1: Strip markdown code fences if wrapping the entire string
    cleaned = text
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)
        cleaned = cleaned.strip()

    # Direct parse attempt
    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, (dict, list)):
            return parsed
    except (json.JSONDecodeError, ValueError):
        pass

    # Strategy 2: If code block was embedded inside explanatory text
    fence_match = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.DOTALL | re.IGNORECASE)
    if fence_match:
        block_text = fence_match.group(1).strip()
        try:
            parsed = json.loads(block_text)
            if isinstance(parsed, (dict, list)):
                return parsed
        except (json.JSONDecodeError, ValueError):
            pass

    # Strategy 3: Find starting '{' or '[' and use JSONDecoder.raw_decode() safely
    decoder = json.JSONDecoder()
    first_brace = text.find("{")
    first_bracket = text.find("[")

    start_indices = []
    if first_brace != -1 and first_bracket != -1:
        if first_brace < first_bracket:
            start_indices = [first_brace, first_bracket]
        else:
            start_indices = [first_bracket, first_brace]
    elif first_brace != -1:
        start_indices = [first_brace]
    elif first_bracket != -1:
        start_indices = [first_bracket]

    for idx in start_indices:
        try:
            parsed, end_idx = decoder.raw_decode(text, idx)
            if isinstance(parsed, (dict, list)):
                return parsed
        except (json.JSONDecodeError, ValueError):
            continue

    # Strategy 4: Fallback greedy regex for object or array
    obj_match = re.search(r"(\{.*\})", text, re.DOTALL)
    if obj_match:
        try:
            parsed = json.loads(obj_match.group(1))
            if isinstance(parsed, (dict, list)):
                return parsed
        except (json.JSONDecodeError, ValueError):
            pass

    arr_match = re.search(r"(\[.*\])", text, re.DOTALL)
    if arr_match:
        try:
            parsed = json.loads(arr_match.group(1))
            if isinstance(parsed, (dict, list)):
                return parsed
        except (json.JSONDecodeError, ValueError):
            pass

    preview = (text[:120] + "...") if len(text) > 120 else text
    raise OpenRouterJSONError(
        f"Unable to parse structured JSON from model response (length: {len(text)}, preview: {repr(preview)})."
    )


class OpenRouterProvider:
    """
    Encapsulated OpenRouter LLM Provider.
    Interfaces with OpenRouter's OpenAI-compatible API at https://openrouter.ai/api/v1.
    Handles structured JSON generation, safe error sanitization, and free-tier routing.
    """

    def __init__(self, api_key: Optional[str] = None, model_name: Optional[str] = None):
        self._api_key = api_key if api_key is not None else os.getenv("OPENROUTER_API_KEY")
        env_model = os.getenv("OPENROUTER_MODEL")
        if model_name is not None:
            self.model_name = model_name
        elif env_model and env_model.strip() and env_model.strip() != "openrouter/free":
            self.model_name = env_model.strip()
        else:
            self.model_name = DEFAULT_FREE_MODEL

        self.base_url = "https://openrouter.ai/api/v1"
        self._last_selected_model: Optional[str] = None

    @property
    def is_configured(self) -> bool:
        """Check if OPENROUTER_API_KEY is configured without logging it."""
        return bool(self._api_key and len(self._api_key.strip()) > 0)

    @property
    def last_selected_model(self) -> Optional[str]:
        """Return the actual underlying model returned by OpenRouter router (if available)."""
        return self._last_selected_model

    def _get_headers(self) -> Dict[str, str]:
        """Build OpenRouter request headers."""
        if not self.is_configured:
            raise OpenRouterNotConfiguredError("OpenRouter API key is not configured.")
        return {
            "Authorization": f"Bearer {self._api_key}",
            "HTTP-Referer": "https://reprova.local",
            "X-Title": "Reprova",
            "Content-Type": "application/json"
        }

    def _send_request(
        self,
        payload: Dict[str, Any],
        timeout_seconds: int = 60,
        max_retries: int = 1
    ) -> Dict[str, Any]:
        """Send HTTP POST request to OpenRouter with conservative retry."""
        headers = self._get_headers()
        url = f"{self.base_url}/chat/completions"

        attempts = 0
        last_error = None

        while attempts <= max_retries:
            attempts += 1
            try:
                with httpx.Client(timeout=timeout_seconds) as client:
                    resp = client.post(url, headers=headers, json=payload)

                print(f"[OpenRouter HTTP Debug] Status: {resp.status_code} | Attempt: {attempts}/{max_retries + 1}")

                if resp.status_code == 200:
                    data = resp.json()
                    # Capture actual routed model name if reported by OpenRouter
                    if isinstance(data, dict) and "model" in data:
                        self._last_selected_model = data["model"]
                    return data

                # Check for HTTP 429 Rate Limit
                if resp.status_code == 429:
                    err_msg = self._extract_error_detail(resp)
                    raise OpenRouterRateLimitError(
                        f"OpenRouter rate limit reached (HTTP 429): {err_msg}"
                    )

                # Check for HTTP 400 (e.g. response_format unsupported by specific free model)
                if resp.status_code == 400:
                    err_msg = self._extract_error_detail(resp)
                    raise OpenRouterAPIError(f"OpenRouter HTTP 400: {err_msg}")

                # Other HTTP errors
                err_msg = self._extract_error_detail(resp)
                raise OpenRouterAPIError(f"OpenRouter HTTP {resp.status_code}: {err_msg}")

            except OpenRouterRateLimitError:
                # Do NOT repeatedly retry 429 errors per safety requirements
                raise

            except OpenRouterAPIError as api_err:
                # If it's a 400 format error, don't retry with same payload
                if "HTTP 400" in str(api_err):
                    raise
                last_error = api_err
                if attempts <= max_retries:
                    time.sleep(1.0)

            except (httpx.TimeoutException, httpx.NetworkError, httpx.RemoteProtocolError) as net_err:
                clean_msg = self._sanitize_error_message(net_err)
                last_error = OpenRouterAPIError(f"OpenRouter network error: {clean_msg}")
                if attempts <= max_retries:
                    time.sleep(1.0)

            except Exception as unk_err:
                clean_msg = self._sanitize_error_message(unk_err)
                raise OpenRouterAPIError(f"OpenRouter unexpected failure: {clean_msg}") from unk_err

        raise last_error or OpenRouterAPIError("OpenRouter request failed after retries.")

    def _extract_error_detail(self, resp: httpx.Response) -> str:
        """Safely extract error message from response body without leaking secrets."""
        try:
            body = resp.json()
            if isinstance(body, dict) and "error" in body:
                err_obj = body["error"]
                if isinstance(err_obj, dict):
                    return self._sanitize_error_message(err_obj.get("message", str(err_obj)))
                return self._sanitize_error_message(str(err_obj))
            return self._sanitize_error_message(resp.text[:300])
        except Exception:
            return self._sanitize_error_message(resp.text[:300])

    def generate_structured_json(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        timeout_seconds: int = 60,
        max_tokens: Optional[int] = 8000
    ) -> Union[Dict[str, Any], List[Any]]:
        """
        Generate structured JSON response using OpenRouter.
        Tries response_format={"type": "json_object"}. If unsupported by model,
        gracefully falls back to strict prompt instruction.
        """
        messages = []
        sys_prompt = system_instruction or "You are a precise, evidence-grounded ML reproducibility analysis assistant. Always respond with strictly valid JSON only. Never include text or commentary outside the JSON."
        messages.append({"role": "system", "content": sys_prompt})
        messages.append({"role": "user", "content": prompt})

        expects_array = any(k in prompt.lower() for k in ["json array", "array of", "array matching"])
        payload: Dict[str, Any] = {
            "model": self.model_name,
            "messages": messages,
            "temperature": 0.0,
        }
        if not expects_array:
            payload["response_format"] = {"type": "json_object"}
        if max_tokens:
            payload["max_tokens"] = max_tokens

        try:
            raw_response = self._send_request(payload, timeout_seconds=timeout_seconds, max_retries=1)
        except OpenRouterAPIError as e:
            # If the free model does not support response_format, retry without response_format
            if "response_format" in str(e).lower() or "HTTP 400" in str(e):
                if "response_format" in payload:
                    del payload["response_format"]
                raw_response = self._send_request(payload, timeout_seconds=timeout_seconds, max_retries=1)
            else:
                raise

        choices = raw_response.get("choices", [])
        actual_model = raw_response.get("model", self.model_name)

        if not choices:
            print(f"[OpenRouter Provider Debug] Model: {actual_model} -> choices array is empty.")
            raise OpenRouterAPIError(f"OpenRouter model '{actual_model}' returned empty choices array.")

        choice = choices[0]
        finish_reason = choice.get("finish_reason")
        has_msg = "message" in choice
        msg = choice.get("message", {})
        has_content = msg.get("content") is not None
        raw_text = msg.get("content") or ""
        text_len = len(raw_text)
        is_empty = len(raw_text.strip()) == 0

        # Task 1: Internal diagnostic logging
        print(
            f"[OpenRouter Provider Debug] Model: {actual_model} | "
            f"Finish: {finish_reason} | HasMsg: {has_msg} | "
            f"ContentExists: {has_content} | Length: {text_len} | IsEmpty: {is_empty}"
        )

        # If model returned empty text under response_format, retry without response_format
        if is_empty and "response_format" in payload:
            print(f"[OpenRouter Provider Debug] Empty content under response_format. Retrying without response_format...")
            del payload["response_format"]
            raw_response = self._send_request(payload, timeout_seconds=timeout_seconds, max_retries=1)
            choices = raw_response.get("choices", [])
            if choices:
                choice = choices[0]
                finish_reason = choice.get("finish_reason")
                raw_text = choice.get("message", {}).get("content") or ""
                text_len = len(raw_text)
                is_empty = len(raw_text.strip()) == 0
                print(f"[OpenRouter Provider Debug] Retry finish: {finish_reason} | Length: {text_len} | IsEmpty: {is_empty}")

        # Task 2: Do NOT accept empty or whitespace-only content
        if not raw_text or is_empty:
            # Fallback: check if valid JSON exists within reasoning
            reasoning_text = choice.get("message", {}).get("reasoning") or ""
            if reasoning_text and ("{" in reasoning_text or "[" in reasoning_text):
                try:
                    return _extract_structured_json(reasoning_text)
                except Exception:
                    pass
            raise OpenRouterJSONError(
                f"OpenRouter model '{actual_model}' returned empty message content (finish_reason: {finish_reason})."
            )

        # Task 3: Safe multi-strategy JSON extraction
        return _extract_structured_json(raw_text)

    def generate_text(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        timeout_seconds: int = 45,
        max_tokens: Optional[int] = 1000
    ) -> str:
        """Generate text response using OpenRouter."""
        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})

        payload: Dict[str, Any] = {
            "model": self.model_name,
            "messages": messages,
            "temperature": 0.0,
        }
        if max_tokens:
            payload["max_tokens"] = max_tokens

        raw_response = self._send_request(payload, timeout_seconds=timeout_seconds, max_retries=1)

        choices = raw_response.get("choices", [])
        if not choices:
            raise OpenRouterAPIError("OpenRouter request returned empty choices array.")

        choice = choices[0]
        msg = choice.get("message", {})
        raw_text = msg.get("content") or ""

        if not raw_text.strip():
            raise OpenRouterAPIError("OpenRouter returned empty message content.")

        return raw_text.strip()

    def _sanitize_error_message(self, exc: Union[Exception, str]) -> str:
        """Strip any API key, authorization token, or sensitive parameter from error messages."""
        msg = str(exc)
        if self._api_key:
            msg = msg.replace(self._api_key, "[REDACTED_OPENROUTER_KEY]")
        # Redact generic sk- patterns or authorization headers
        msg = re.sub(r"sk-[a-zA-Z0-9_\-\.]{10,}", "[REDACTED_API_KEY]", msg)
        msg = re.sub(r"key=[a-zA-Z0-9_\-\.]+", "key=[REDACTED]", msg)
        msg = re.sub(r"Bearer\s+[a-zA-Z0-9_\-\.]+", "Bearer [REDACTED]", msg)
        return msg


# Module-level singleton
_openrouter_provider_instance: Optional[OpenRouterProvider] = None


def get_openrouter_provider() -> OpenRouterProvider:
    """Get or create singleton OpenRouterProvider instance."""
    global _openrouter_provider_instance
    if _openrouter_provider_instance is None:
        _openrouter_provider_instance = OpenRouterProvider()
    return _openrouter_provider_instance
