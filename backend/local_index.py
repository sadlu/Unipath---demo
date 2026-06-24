"""
Local Index Strategy — zero-cost Nepal education notice scraper + AI payload controller.

CLI:
  python local_index.py scrape           # fetch 5 portals → scraped_notices.txt
  python local_index.py ask "question"    # answer from index via LLM (or offline grep)
  python local_index.py status            # show index stats

Importable:
  from local_index import scrape_all, ask, load_index
"""

import os
import re
import sys
import time
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 1.  LINK LIBRARY  — 5 credible Nepalese notice & education portals
# ---------------------------------------------------------------------------

SOURCE_LINKS: list[dict] = [
    {
        "name": "Edusanjal News",
        "url": "https://edusanjal.com/news/",
        "type": "education news portal",
    },
    {
        "name": "Edusanjal Vacancies",
        "url": "https://edusanjal.com/vacancy/",
        "type": "job & vacancy board",
    },
    {
        "name": "EducateNepal",
        "url": "https://www.educatenepal.com/",
        "type": "education portal",
    },
    {
        "name": "TU Exam Controller",
        "url": "https://exam.tu.edu.np/",
        "type": "university exam notices",
    },
    {
        "name": "TU Faculty of Management",
        "url": "https://www.fomecd.edu.np/",
        "type": "university faculty notices",
    },
]

_data_dir = os.environ.get("UNIPATH_DATA_DIR")
if _data_dir:
    SCRAPED_FILE = os.path.join(_data_dir, "scraped_notices.txt")
else:
    SCRAPED_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "scraped_notices.txt")
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) UniPath-LocalIndex/1.0"
REQUEST_TIMEOUT = 25
CRAWL_DELAY = 2.0  # seconds between requests — be polite
MAX_PAGE_CHARS = 10000


# ---------------------------------------------------------------------------
# 2.  SCRAPER — extracts headlines, anchor links, dates, and body text
# ---------------------------------------------------------------------------

@dataclass
class ScrapedPage:
    source_name: str
    source_url: str
    source_type: str
    scraped_at: str
    headlines: list[str] = field(default_factory=list)
    links: list[dict] = field(default_factory=list)
    dates: list[str] = field(default_factory=list)
    body_text: str = ""


def _fetch_html(url: str) -> Optional[str]:
    try:
        resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        resp.encoding = resp.apparent_encoding or "utf-8"
        return resp.text
    except requests.RequestException as e:
        logger.warning(f"  [NETWORK ERROR] {e}")
        return None


def _extract_headlines(soup: BeautifulSoup) -> list[str]:
    headlines: list[str] = []
    for tag in soup.find_all(["h1", "h2", "h3", "h4"]):
        text = tag.get_text(strip=True)
        if text and len(text) > 5:
            headlines.append(text)
    return headlines


def _extract_links(soup: BeautifulSoup, base_url: str) -> list[dict]:
    links: list[dict] = []
    seen = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        text = a.get_text(strip=True)
        if not text or len(text) < 3:
            continue
        if href.startswith("/"):
            parsed = urlparse(base_url)
            href = f"{parsed.scheme}://{parsed.netloc}{href}"
        if href not in seen:
            seen.add(href)
            links.append({"text": text, "href": href})
    return links


def _extract_dates(soup: BeautifulSoup) -> list[str]:
    dates: list[str] = []
    # common date patterns in Nepali edu portals
    for tag in soup.find_all(["time", "span", "div", "li", "p"]):
        text = tag.get_text(strip=True)
        if not text:
            continue
        # match dates like "2025-01-15", "Jan 15, 2025", "15 Jan 2025", "01/15/2025"
        if re.search(
            r"\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b|"
            r"\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},?\s*\d{4}\b|"
            r"\b\d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{4}\b",
            text,
            re.IGNORECASE,
        ):
            dates.append(text)
    return dates


def _clean_body(soup: BeautifulSoup) -> str:
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "noscript"]):
        tag.decompose()
    text = soup.get_text(separator="\n")
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return "\n".join(lines)


def scrape_source(entry: dict) -> Optional[ScrapedPage]:
    name = entry["name"]
    url = entry["url"]

    html = _fetch_html(url)
    if html is None:
        return None

    soup = BeautifulSoup(html, "html.parser")
    headlines = _extract_headlines(soup)
    links = _extract_links(soup, url)
    dates = _extract_dates(soup)
    body = _clean_body(soup)

    if len(body) > MAX_PAGE_CHARS:
        body = body[:MAX_PAGE_CHARS] + "\n[-- page truncated --]"

    return ScrapedPage(
        source_name=name,
        source_url=url,
        source_type=entry["type"],
        scraped_at=datetime.now(timezone.utc).isoformat(),
        headlines=headlines,
        links=links,
        dates=dates,
        body_text=body,
    )


def _format_page(page: ScrapedPage) -> str:
    lines: list[str] = []
    lines.append(f"=== {page.source_name} ===")
    lines.append(f"URL: {page.source_url}")
    lines.append(f"Type: {page.source_type}")
    lines.append(f"Scraped: {page.scraped_at}")
    lines.append("")

    if page.headlines:
        lines.append("--- HEADLINES ---")
        for h in page.headlines:
            lines.append(f"  • {h}")
        lines.append("")

    if page.dates:
        lines.append("--- DATES FOUND ---")
        for d in page.dates:
            lines.append(f"  • {d}")
        lines.append("")

    if page.links:
        lines.append("--- LINKS ---")
        for link in page.links[:30]:  # cap links per page
            lines.append(f"  • {link['text']}  →  {link['href']}")
        if len(page.links) > 30:
            lines.append(f"  (... {len(page.links) - 30} more links)")
        lines.append("")

    lines.append("--- BODY TEXT ---")
    lines.append(page.body_text)
    lines.append("")
    lines.append("---")
    lines.append("")

    return "\n".join(lines)


def scrape_all() -> str:
    entries: list[ScrapedPage] = []
    total = len(SOURCE_LINKS)

    logger.info(f"Scraping {total} Nepal education portals ...")
    for i, entry in enumerate(SOURCE_LINKS, 1):
        label = f"[{i}/{total}] {entry['name']}"
        logger.info(f"  {label}  ({entry['url']})")
        result = scrape_source(entry)
        if result:
            entries.append(result)
            h = len(result.headlines)
            l = len(result.links)
            d = len(result.dates)
            b = len(result.body_text)
            logger.info(f"  ✓  {h} headlines, {l} links, {d} dates, {b} chars")
        else:
            logger.warning(f"  ✗  FAILED")
        if i < total:
            time.sleep(CRAWL_DELAY)

    _write_index(entries)
    logger.info(f"Done — {len(entries)}/{total} sources saved to {SCRAPED_FILE}")
    return SCRAPED_FILE


def _write_index(entries: list[ScrapedPage]):
    parts: list[str] = []
    parts.append(f"# Local Index — scraped {datetime.now(timezone.utc).isoformat()}")
    parts.append(f"# Sources: {len(entries)}")
    parts.append("")

    for page in entries:
        parts.append(_format_page(page))

    with open(SCRAPED_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(parts))


# ---------------------------------------------------------------------------
# 3.  AI PAYLOAD CONTROLLER
# ---------------------------------------------------------------------------

RIGID_SYSTEM_PROMPT = """You are a localized data-extraction engine for Nepal educational paths.
Your ONLY source of truth is the provided [Scraped Data Context] compiled from local Nepalese portals.

Strict Rules:
1. Ground your answer ONLY in the facts provided in the text context.
2. If the user asks about a subject, college, or opportunity that is not explicitly written in the text context, respond verbatim: 'No recent notices found matching this path on our tracked portals.'
3. You are strictly forbidden from guessing, looping, or recommending international opportunities like MIT, Ivy League, or US colleges. Keep it entirely locked to Nepal.
4. If a specific URL isn't present word-for-word in the context text, do not invent a link."""


def load_index(filepath: str = SCRAPED_FILE) -> Optional[str]:
    if not os.path.exists(filepath):
        return None
    with open(filepath, "r", encoding="utf-8") as f:
        return f.read()


def index_status(filepath: str = SCRAPED_FILE) -> dict:
    if not os.path.exists(filepath):
        return {"exists": False, "bytes": 0, "sources": 0, "scraped_at": None}

    text = load_index(filepath)
    sources = len(re.findall(r"^=== (.+) ===", text or "", re.MULTILINE))
    first_line = (text or "").splitlines()[0]
    scraped_at = first_line.replace("# Local Index — scraped ", "").strip() if first_line.startswith("#") else None

    return {
        "exists": True,
        "bytes": os.path.getsize(filepath),
        "sources": sources,
        "scraped_at": scraped_at,
    }


def ask(
    question: str,
    openai_api_key: Optional[str] = None,
    model: str = "gpt-4o",
    filepath: str = SCRAPED_FILE,
) -> str:
    context = load_index(filepath)
    if context is None:
        return (
            "No local index found. Run `python local_index.py scrape` first "
            "to build scraped_notices.txt."
        )

    api_key = openai_api_key or os.getenv("OPENAI_API_KEY")
    if not api_key:
        return _keyword_fallback(question, context)

    try:
        from openai import OpenAI
    except ImportError:
        return _keyword_fallback(question, context)

    client = OpenAI(api_key=api_key)

    user_prompt = (
        "[Scraped Data Context]\n"
        f"{context}\n\n"
        f"User Question: {question}\n\n"
        "Answer using ONLY the context above. Follow the strict rules."
    )

    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": RIGID_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.1,
            max_tokens=1500,
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        return f"LLM call failed: {e}\n\nFallback:\n{_keyword_fallback(question, context)}"


def _keyword_fallback(question: str, context: str) -> str:
    keywords = question.lower().split()
    lines = context.splitlines()
    matched = [line for line in lines if any(kw in line.lower() for kw in keywords)]
    if not matched:
        return "No recent notices found matching this path on our tracked portals."

    result = ["Matched entries from local index (LLM offline):", ""]
    seen = set()
    for line in matched:
        stripped = line.strip()
        if stripped and stripped not in seen:
            seen.add(stripped)
            result.append(stripped)
    return "\n".join(result[:40])


# ---------------------------------------------------------------------------
# 4.  CLI
# ---------------------------------------------------------------------------


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    command = sys.argv[1]

    if command == "scrape":
        scrape_all()

    elif command == "ask":
        if len(sys.argv) < 3:
            print('Usage: python local_index.py ask "your question"')
            sys.exit(1)
        question = " ".join(sys.argv[2:])
        print(f"Q: {question}\n")
        answer = ask(question)
        print(f"A:\n{answer}")

    elif command == "status":
        info = index_status()
        if info["exists"]:
            print(f"Index file:     {SCRAPED_FILE}")
            print(f"Size:           {info['bytes']:,} bytes")
            print(f"Sources found:  {info['sources']}")
            print(f"Last scraped:   {info['scraped_at']}")
        else:
            print("No index file found. Run `python local_index.py scrape` first.")

    else:
        print(f"Unknown command: {command}")
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
