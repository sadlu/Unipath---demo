from typing import Optional

import requests

from config import settings

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


def generate_answer_ollama(
    user_query: str,
    search_snippets: list[dict[str, str]],
    model: str | None = None,
    temperature: float = 0.2,
    max_tokens: int = 1500,
) -> Optional[str]:
    if not settings.ollama_enabled:
        return None

    model = model or settings.ollama_model
    user_prompt = _build_prompt(user_query, search_snippets)

    try:
        resp = requests.post(
            f"{settings.ollama_host}/api/generate",
            json={
                "model": model,
                "system": NEPAL_SYSTEM_PROMPT,
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


def generate_answer(
    user_query: str,
    search_snippets: list[dict[str, str]],
    model: str | None = None,
    temperature: float = 0.2,
    max_tokens: int = 1500,
) -> Optional[str]:
    if settings.ollama_enabled:
        result = generate_answer_ollama(
            user_query=user_query,
            search_snippets=search_snippets,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        if result is not None:
            return result

    if not settings.has_openai_key:
        return None

    try:
        from openai import OpenAI
    except ImportError:
        return None

    client = OpenAI(api_key=settings.openai_api_key)
    model = model or settings.openai_model
    user_prompt = _build_prompt(user_query, search_snippets)

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": NEPAL_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content.strip()
    except Exception:
        return None
