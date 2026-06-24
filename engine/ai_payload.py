import json
import os
from typing import Optional

from scraper.scraper import get_scraped_context, run_scraper

SYSTEM_PROMPT = """You are a localized data-extraction engine for Nepal educational paths. Your ONLY source of truth is the provided [Scraped Data Context]. 
RULES:
1. Ground your answer ONLY in the facts provided in the text context. 
2. If an opportunity or subject is not explicitly written in the text context, respond verbatim: 'No recent notices found matching this path on our tracked portals.'
3. You are strictly forbidden from guessing, looping, or recommending international opportunities like MIT, Ivy League, or US colleges. Keep it entirely locked to Nepal.
4. If a specific URL isn't present word-for-word in the data, do not invent or guess a link."""


class AIPayloadController:
    def __init__(self, api_key: str = ""):
        self.api_key = api_key
        self._client = None
        self._context = ""

    def refresh_context(self, force_rescrape: bool = False) -> str:
        if force_rescrape:
            run_scraper()
        self._context = get_scraped_context()
        return self._context

    def get_system_prompt(self) -> str:
        context = self._context or self.refresh_context()
        return f"{SYSTEM_PROMPT}\n\n[Scraped Data Context]\n{context}"

    def query(self, user_question: str, model: str = "gpt-4o", temperature: float = 0.1) -> str:
        if not self.api_key:
            return self._free_fallback(user_question)

        return self._call_llm(
            system_prompt=self.get_system_prompt(),
            user_prompt=user_question,
            model=model,
            temperature=temperature,
        )

    def _call_llm(self, system_prompt: str, user_prompt: str, model: str, temperature: float) -> str:
        if not self.api_key:
            return self._free_fallback(user_prompt)

        client = self._get_openai_client()
        if not client:
            return self._free_fallback(user_prompt)

        try:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=temperature,
                max_tokens=1000,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            return self._fallback_error(str(e))

    def _get_openai_client(self):
        if self._client is None and self.api_key:
            try:
                from openai import OpenAI
                self._client = OpenAI(api_key=self.api_key)
            except Exception:
                self._client = None
        return self._client

    def _free_fallback(self, query: str) -> str:
        context = self._context or self.refresh_context()
        if not context.strip():
            return "No scraped data available. Run the scraper first."

        query_lower = query.lower()
        lines = context.split("\n")
        results = []
        current_notice = ""
        for line in lines:
            if line.startswith("[Notice #"):
                current_notice = line
            elif line.strip() and query_lower in line.lower():
                results.append(current_notice)
                results.append(line)

        if results:
            relevant = "\n".join(results[:30])
            return f"Based on scraped notices, here is what I found:\n\n{relevant}\n\n(This is a free offline response. For AI-powered analysis, provide an API key.)"

        return "No recent notices found matching this path on our tracked portals."

    def _free_fallback_scan(self, subjects: list, city: str, country: str) -> list:
        context = self._context or self.refresh_context()
        results = []
        seen_urls = set()
        lines = context.split("\n")
        current = {}

        for line in lines:
            if line.startswith("[Notice #"):
                if current and current.get("title"):
                    results.append(current)
                current = {"source": "Scraped Notice"}
            elif line.startswith("Title: "):
                current["title"] = line[7:]
            elif line.startswith("Source: "):
                current["source"] = line[8:]
            elif line.startswith("Category: "):
                current["type"] = line[10:].capitalize()
            elif line.startswith("Date: "):
                current["start_date"] = line[6:]
            elif line.startswith("Content: "):
                current["description"] = line[9:]
            elif line.startswith("URL: "):
                url = line[5:]
                current["source_url"] = url
                if url and url in seen_urls:
                    current = {}
                    continue
                if url:
                    seen_urls.add(url)
            elif line.startswith("---"):
                if current and current.get("title"):
                    if not current.get("type"):
                        current["type"] = "Project"
                    current.setdefault("organization", current.get("source", "Unknown"))
                    current.setdefault("tier", "Private/Institutional")
                    current.setdefault("cost", "TBD")
                    current.setdefault("start_date", "TBD")
                    current.setdefault("skills_developed", "General skills")
                    current.setdefault("description", "")
                    current.setdefault("source_url", "")
                    query_text = (current.get("title", "") + " " + current.get("description", "")).lower()
                    subject_match = any(s.lower() in query_text for s in subjects)
                    country_match = country.lower() in query_text
                    if subject_match or country_match:
                        results.append(current)
                current = {}

        if current and current.get("title"):
            results.append(current)

        return results[:20]

    def _fallback_error(self, error_msg: str) -> str:
        return f"AI query failed: {error_msg}. Using offline mode: {self._free_fallback('')}"


def create_payload_controller(api_key: str = "") -> AIPayloadController:
    return AIPayloadController(api_key=api_key)
