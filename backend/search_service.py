import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class SearchResult:
    title: str
    url: str
    snippet: str
    source_site: str = ""


@dataclass
class SearchResponse:
    results: list[SearchResult] = field(default_factory=list)
    total_estimated: int = 0
    error: Optional[str] = None


def _extract_source_site(url: str) -> str:
    m = re.search(r"https?://(?:www\.)?([^/]+)", url)
    if m:
        parts = m.group(1).split(".")
        if len(parts) >= 2:
            return parts[-2].capitalize()
        return parts[0]
    return ""


def _build_nepal_query(user_query: str) -> str:
    query = user_query.strip()
    nepal_terms = ["Nepal", "Kathmandu", "site:.np"]
    has_nepal = any(term.lower() in query.lower() for term in nepal_terms)
    if not has_nepal:
        query = f"{query} Nepal Kathmandu"
    return query


def _duckduckgo_search(query: str, max_results: int = 8, timeout_s: int = 8) -> SearchResponse:
    try:
        from ddgs import DDGS
    except ImportError:
        try:
            from duckduckgo_search import DDGS
        except ImportError:
            return SearchResponse(
                error="duckduckgo_search not installed. "
                      "Run: pip install ddgs"
            )

    nepal_query = _build_nepal_query(query)
    results = []
    seen_urls: set[str] = set()

    try:
        with DDGS(timeout=timeout_s) as ddgs:
            for r in ddgs.text(nepal_query, max_results=max_results):
                url = r.get("href", r.get("url", ""))
                if not url or url in seen_urls:
                    continue
                seen_urls.add(url)
                title = r.get("title", "")
                body = r.get("body", r.get("snippet", ""))
                results.append(
                    SearchResult(
                        title=title,
                        url=url,
                        snippet=body,
                        source_site=_extract_source_site(url),
                    )
                )
    except Exception as e:
        return SearchResponse(error=f"DuckDuckGo search failed: {e}")

    return SearchResponse(results=results, total_estimated=len(results))


def search_nepal(query: str, max_results: int = 8) -> SearchResponse:
    return _duckduckgo_search(query, max_results=max_results)


def search_nepal_multi(queries: list[str], max_results_per: int = 10) -> list[SearchResponse]:
    responses: list[SearchResponse] = []
    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = {pool.submit(_duckduckgo_search, q, max_results_per): q for q in queries}
        for future in as_completed(futures, timeout=25):
            try:
                responses.append(future.result(timeout=2))
            except Exception:
                responses.append(SearchResponse(error="Timeout", results=[]))
    return responses
