import json
import logging
import time
from typing import Optional

import requests

from config import settings

logger = logging.getLogger(__name__)

NEPAL_SYSTEM_PROMPT = """You are a helpful assistant for the "Uni Path" app — an educational and career opportunities platform for students in **Kathmandu and Nepal**.

## CORE RULES (obey these above all else)

1. **NEPAL-ONLY SCOPE**: You must ONLY suggest opportunities, universities, scholarships, internships, and events that are explicitly confirmed to be **within Nepal**. If the user asks about something international, politely redirect or ask if they meant Nepal-specific results.

2. **NO URL HALLUCINATION**: You must NEVER invent, guess, or construct URLs. The only URLs you may output are those **verbatim provided in the search results context below**. If no search result contains a relevant URL, say "Please search online for more details" — do not fabricate a link.

3. **GROUNDED RESPONSES ONLY**: Every factual claim you make must be directly supported by the search results or snippets shown below. If the search results do not contain enough information to answer the user's question, say so honestly. Do not rely on your training data for current opportunities, dates, or application links.

4. **LOCALIZE**: When mentioning a university, organization, or venue, include which city or district in Nepal it is located in (e.g., "Kathmandu University, Dhulikhel" or "Pulchowk Campus, Lalitpur").

5. **FORMAT**: Use clear Markdown with sections if listing multiple items. For each opportunity, include:
   - Title (bolded)
   - Organization / Host
   - Location
   - Key details (dates, eligibility, cost if mentioned)
   - Source link (only if present in search results — never fabricated)

6. **TONE**: Be encouraging, student-friendly, and precise. Assume the user is a high school or undergraduate student in Nepal.
"""

CV_SYSTEM_PROMPT = """You are a **CV Coach** for the "Uni Path" app — helping Nepali students build stronger university and scholarship applications.

## YOUR ROLE
You review a student's profile and give personalized, actionable advice to improve their CV/resume for university admissions, scholarships, and internships in Nepal.

## CORE RULES
1. **PERSONALIZE**: Tailor every piece of advice to the student's specific subjects, level, achievements, and bio. Never give generic tips.
2. **BE SPECIFIC**: Suggest exact improvements — what to add, what to remove, how to phrase things better.
3. **FOCUS ON NEPAL**: Recommend opportunities (scholarships, internships, programs) that exist in Nepal and match their profile.
4. **NO HALLUCINATED URLS**: Only use URLs from the search results provided.
5. **SKILL GAPS**: Identify missing skills or experiences they should gain.
6. **TONE**: Be encouraging but honest. Assume the student is in high school or early university in Nepal.
"""


def _build_prompt(user_query: str, search_snippets: list[dict[str, str]]) -> str:
    snippets_text = ""
    if search_snippets:
        parts = []
        for i, s in enumerate(search_snippets, 1):
            title = s.get("title", "Untitled")
            url = s.get("url", "")
            snippet = s.get("snippet", "")
            parts.append(
                f"[{i}] Title: {title}\n    URL: {url}\n    Snippet: {snippet}"
            )
        snippets_text = "\n\n".join(parts)
    else:
        snippets_text = "(No search results were returned for this query.)"

    return (
        f"## USER QUERY\n{user_query}\n\n"
        f"## SEARCH RESULTS\n{snippets_text}\n\n"
        "Based **only** on the search results above, answer the user's query. "
        "Follow the system rules strictly: no hallucinated URLs, no non-Nepal suggestions unless the user explicitly asks."
    )


def _build_cv_prompt(
    user_query: str,
    user_profile: dict,
    search_snippets: list[dict[str, str]],
    conversation_history: Optional[list[dict]] = None,
) -> str:
    profile_lines = [
        f"Display Name: {user_profile.get('display_name', 'Unknown')}",
        f"Email: {user_profile.get('email', 'Not set')}",
        f"Bio: {user_profile.get('bio', 'No bio')}",
        f"Subjects: {user_profile.get('subjects', 'Not specified')}",
        f"Level: {user_profile.get('level', 1)}",
        f"XP: {user_profile.get('xp', 0)}",
        f"Achievements: {user_profile.get('achievements', '[]')}",
    ]
    profile_text = "\n".join(profile_lines)

    snippets_text = ""
    if search_snippets:
        parts = []
        for i, s in enumerate(search_snippets, 1):
            parts.append(
                f"[{i}] Title: {s.get('title', 'Untitled')}\n"
                f"    URL: {s.get('url', '')}\n"
                f"    Snippet: {s.get('snippet', '')}"
            )
        snippets_text = "\n\n".join(parts)

    history_text = ""
    if conversation_history:
        lines = []
        for msg in conversation_history[-6:]:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            lines.append(f"{role}: {content}")
        history_text = "\n".join(lines)

    return (
        f"## USER PROFILE\n{profile_text}\n\n"
        f"## USER QUERY\n{user_query}\n\n"
        f"## SEARCH RESULTS (Opportunities matching this student)\n{snippets_text}\n\n"
        f"## CONVERSATION HISTORY\n{history_text or '(No prior conversation)'}\n\n"
        "Based on the student's profile and available opportunities, provide personalized CV advice. "
        "Follow the CV Coach rules strictly."
    )


def _api_call(
    url: str,
    headers: dict,
    payload: dict,
    timeout: int = 60,
) -> Optional[str]:
    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=timeout)
        resp.raise_for_status()
        return resp.text
    except requests.Timeout:
        logger.warning(f"Timeout calling {url}")
        return None
    except requests.RequestException as e:
        logger.warning(f"API error calling {url}: {e}")
        return None


def _extract_json(text: str) -> Optional[dict]:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


# ---------------------------------------------------------------------------
# Provider: Ollama (local, completely free)
# ---------------------------------------------------------------------------

def generate_ollama(
    system_prompt: str,
    user_prompt: str,
    model: Optional[str] = None,
    temperature: float = 0.2,
    max_tokens: int = 1500,
) -> Optional[str]:
    if not settings.ollama_enabled:
        return None
    model = model or settings.ollama_model
    try:
        resp = requests.post(
            f"{settings.ollama_host}/api/generate",
            json={
                "model": model,
                "system": system_prompt,
                "prompt": user_prompt,
                "stream": False,
                "options": {"temperature": temperature, "num_predict": max_tokens},
            },
            timeout=120,
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("response", "").strip() or None
    except requests.RequestException:
        return None

# ---------------------------------------------------------------------------
# Provider: OpenAI-compatible (Groq, OpenRouter, NVIDIA NIM, Together)
# ---------------------------------------------------------------------------

def _generate_openai_compat(
    base_url: str,
    api_key: str,
    model: str,
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.2,
    max_tokens: int = 1500,
) -> Optional[str]:
    if not api_key:
        return None
    try:
        from openai import OpenAI
    except ImportError:
        return None

    client = OpenAI(api_key=api_key, base_url=base_url)
    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        logger.warning(f"OpenAI-compat error at {base_url}: {e}")
        return None


def generate_groq(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.2,
    max_tokens: int = 1500,
) -> Optional[str]:
    if not settings.has_groq_key:
        return None
    return _generate_openai_compat(
        base_url="https://api.groq.com/openai/v1",
        api_key=settings.groq_api_key,
        model=settings.groq_model,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        temperature=temperature,
        max_tokens=max_tokens,
    )


def generate_openrouter(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.2,
    max_tokens: int = 1500,
) -> Optional[str]:
    if not settings.has_openrouter_key:
        return None
    return _generate_openai_compat(
        base_url="https://openrouter.ai/api/v1",
        api_key=settings.openrouter_api_key,
        model=settings.openrouter_model,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        temperature=temperature,
        max_tokens=max_tokens,
    )


def generate_nvidia(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.2,
    max_tokens: int = 1500,
) -> Optional[str]:
    if not settings.has_nvidia_key:
        return None
    return _generate_openai_compat(
        base_url="https://integrate.api.nvidia.com/v1",
        api_key=settings.nvidia_api_key,
        model=settings.nvidia_model,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        temperature=temperature,
        max_tokens=max_tokens,
    )


def generate_together(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.2,
    max_tokens: int = 1500,
) -> Optional[str]:
    if not settings.has_together_key:
        return None
    return _generate_openai_compat(
        base_url="https://api.together.xyz/v1",
        api_key=settings.together_api_key,
        model=settings.together_model,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        temperature=temperature,
        max_tokens=max_tokens,
    )

# ---------------------------------------------------------------------------
# Provider: Google Gemini (generous free tier, no credit card)
# ---------------------------------------------------------------------------

def generate_gemini(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.2,
    max_tokens: int = 1500,
) -> Optional[str]:
    if not settings.has_gemini_key:
        return None
    try:
        import google.generativeai as genai
        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel(
            model_name=settings.gemini_model,
            system_instruction=system_prompt,
            generation_config={
                "temperature": temperature,
                "max_output_tokens": max_tokens,
            },
        )
        response = model.generate_content(user_prompt)
        return response.text.strip() if response.text else None
    except ImportError:
        return None
    except Exception as e:
        logger.warning(f"Gemini error: {e}")
        return None

# ---------------------------------------------------------------------------
# Provider: HuggingFace Inference API (free tier, no credit card)
# ---------------------------------------------------------------------------

def generate_huggingface(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.2,
    max_tokens: int = 1500,
) -> Optional[str]:
    if not settings.has_huggingface_key:
        return None
    url = f"https://api-inference.huggingface.co/models/{settings.huggingface_model}"
    headers = {"Authorization": f"Bearer {settings.huggingface_api_key}"}
    full_prompt = f"{system_prompt}\n\n{user_prompt}"
    payload = {
        "inputs": full_prompt,
        "parameters": {
            "temperature": temperature,
            "max_new_tokens": max_tokens,
            "return_full_text": False,
        },
    }
    text = _api_call(url, headers, payload, timeout=90)
    if not text:
        return None
    data = _extract_json(text)
    if isinstance(data, list) and len(data) > 0:
        return data[0].get("generated_text", "").strip() or None
    if isinstance(data, dict) and "error" in data:
        logger.warning(f"HuggingFace API error: {data['error']}")
        return None
    return str(data).strip() if data else None

# ---------------------------------------------------------------------------
# Provider: Cloudflare Workers AI (free tier)
# ---------------------------------------------------------------------------

def generate_cloudflare(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.2,
    max_tokens: int = 1500,
) -> Optional[str]:
    if not settings.has_cloudflare_key:
        return None
    url = (
        f"https://api.cloudflare.com/client/v4/accounts/"
        f"{settings.cloudflare_account_id}/ai/run/{settings.cloudflare_model}"
    )
    headers = {"Authorization": f"Bearer {settings.cloudflare_api_key}"}
    full_prompt = f"{system_prompt}\n\n{user_prompt}"
    payload = {
        "prompt": full_prompt,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }
    text = _api_call(url, headers, payload, timeout=90)
    if not text:
        return None
    data = _extract_json(text)
    if isinstance(data, dict):
        result = data.get("result", {})
        response_text = result.get("response", "")
        if response_text:
            return response_text.strip()
    return None


# ---------------------------------------------------------------------------
# Cooldown cache for rate-limited providers
# ---------------------------------------------------------------------------

_cooldowns: dict[str, float] = {}
_COOLDOWN_SECONDS = 60

def _is_on_cooldown(provider: str) -> bool:
    expires = _cooldowns.get(provider, 0)
    if time.time() < expires:
        return True
    return False

def _set_cooldown(provider: str):
    _cooldowns[provider] = time.time() + _COOLDOWN_SECONDS


# ---------------------------------------------------------------------------
# Provider chain: ordered list of (name, function, is_configured)
# ---------------------------------------------------------------------------

PROVIDER_CHAIN = [
    ("groq", generate_groq, lambda: settings.has_groq_key),
    ("gemini", generate_gemini, lambda: settings.has_gemini_key),
    ("nvidia", generate_nvidia, lambda: settings.has_nvidia_key),
    ("openrouter", generate_openrouter, lambda: settings.has_openrouter_key),
    ("together", generate_together, lambda: settings.has_together_key),
    ("ollama", generate_ollama, lambda: settings.ollama_enabled),
    ("huggingface", generate_huggingface, lambda: settings.has_huggingface_key),
    ("cloudflare", generate_cloudflare, lambda: settings.has_cloudflare_key),
]


def generate_answer_with_fallback(
    user_query: str,
    search_snippets: list[dict[str, str]],
    system_prompt: Optional[str] = None,
    temperature: float = 0.2,
    max_tokens: int = 1500,
) -> tuple[Optional[str], Optional[str]]:
    user_prompt = _build_prompt(user_query, search_snippets)
    sp = system_prompt or NEPAL_SYSTEM_PROMPT

    for name, func, is_ready in PROVIDER_CHAIN:
        if not is_ready():
            continue
        if _is_on_cooldown(name):
            logger.info(f"Skipping {name} (on cooldown)")
            continue
        try:
            result = func(sp, user_prompt, temperature=temperature, max_tokens=max_tokens)
            if result is not None:
                logger.info(f"LLM answer generated via {name}")
                return result, name
            _set_cooldown(name)
        except Exception as e:
            logger.warning(f"{name} failed: {e}")
            _set_cooldown(name)

    return None, None


def generate_cv_advice_with_fallback(
    user_query: str,
    user_profile: dict,
    search_snippets: list[dict[str, str]],
    conversation_history: Optional[list[dict]] = None,
    temperature: float = 0.3,
    max_tokens: int = 2000,
) -> tuple[Optional[str], Optional[str]]:
    user_prompt = _build_cv_prompt(user_query, user_profile, search_snippets, conversation_history)

    for name, func, is_ready in PROVIDER_CHAIN:
        if not is_ready():
            continue
        if _is_on_cooldown(name):
            continue
        try:
            result = func(CV_SYSTEM_PROMPT, user_prompt, temperature=temperature, max_tokens=max_tokens)
            if result is not None:
                logger.info(f"CV advice generated via {name}")
                return result, name
            _set_cooldown(name)
        except Exception as e:
            logger.warning(f"{name} failed for CV: {e}")
            _set_cooldown(name)

    return None, None


# ---------------------------------------------------------------------------
# Legacy wrappers (keep existing API working)
# ---------------------------------------------------------------------------

def generate_answer(
    user_query: str,
    search_snippets: list[dict[str, str]],
    model: Optional[str] = None,
    temperature: float = 0.2,
    max_tokens: int = 1500,
) -> Optional[str]:
    answer, _ = generate_answer_with_fallback(
        user_query=user_query,
        search_snippets=search_snippets,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return answer


def generate_answer_ollama(
    user_query: str,
    search_snippets: list[dict[str, str]],
    model: Optional[str] = None,
    temperature: float = 0.2,
    max_tokens: int = 1500,
) -> Optional[str]:
    user_prompt = _build_prompt(user_query, search_snippets)
    return generate_ollama(
        NEPAL_SYSTEM_PROMPT, user_prompt, model=model,
        temperature=temperature, max_tokens=max_tokens,
    )
