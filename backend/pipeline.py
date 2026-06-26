from dataclasses import dataclass, field
from typing import Optional

from search_service import search_nepal, SearchResult
from llm_service import generate_answer
from cache import search_cache
from local_index import ask as local_ask, index_status


@dataclass
class PipelineResult:
    query: str
    answer: Optional[str]
    results: list[SearchResult] = field(default_factory=list)
    error: Optional[str] = None


def run_pipeline(
    user_query: str,
    max_search_results: int = 8,
) -> PipelineResult:
    if not user_query or not user_query.strip():
        return PipelineResult(
            query=user_query,
            answer=None,
            error="Query is empty.",
        )

    search_resp = search_nepal(
        query=user_query,
        max_results=max_search_results,
    )

    if search_resp.error:
        local_status = index_status()
        if local_status.get("exists"):
            local_answer = local_ask(user_query)
            if local_answer and "No recent notices" not in local_answer:
                return PipelineResult(
                    query=user_query,
                    answer=local_answer,
                    results=[],
                )
        return PipelineResult(
            query=user_query,
            answer=None,
            error=search_resp.error,
        )

    snippets = [
        {
            "title": r.title,
            "url": r.url,
            "snippet": r.snippet,
            "source_site": r.source_site,
        }
        for r in search_resp.results
    ]

    answer = generate_answer(
        user_query=user_query,
        search_snippets=snippets,
    )

    if answer is None and not search_resp.results:
        local_status = index_status()
        if local_status.get("exists"):
            local_answer = local_ask(user_query)
            if local_answer and "No recent notices" not in local_answer:
                return PipelineResult(
                    query=user_query,
                    answer=local_answer,
                    results=[],
                )
        return PipelineResult(
            query=user_query,
            answer=None,
            error="No search results found and LLM unavailable.",
        )

    if answer is None and search_resp.results:
        fallback_lines = [
            "I found the following search results (LLM not available):",
            "",
        ]
        for r in search_resp.results:
            fallback_lines.append(f"**{r.title}**")
            if r.snippet:
                fallback_lines.append(f"> {r.snippet}")
            fallback_lines.append(f"\U0001f517 {r.url}")
            fallback_lines.append("")
        answer = "\n".join(fallback_lines)

    return PipelineResult(
        query=user_query,
        answer=answer,
        results=search_resp.results,
    )
