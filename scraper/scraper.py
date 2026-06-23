import os
import time
import logging
from datetime import datetime
from typing import List, Dict
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("unipath.scraper")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9,ne;q=0.8",
}

OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_PATH = os.path.join(OUTPUT_DIR, "scraped_notices.txt")

PORTALS = [
    {
        "name": "Edusanjal News",
        "url": "https://edusanjal.com/news/",
        "type": "admissions",
    },
    {
        "name": "Edusanjal Vacancy",
        "url": "https://edusanjal.com/vacancy/",
        "type": "jobs",
    },
    {
        "name": "Educate Nepal",
        "url": "https://www.educatenepal.com/",
        "type": "scholarships",
    },
    {
        "name": "TU Exam Controller",
        "url": "https://exam.tu.edu.np/",
        "type": "exams",
    },
    {
        "name": "TU Faculty of Management",
        "url": "https://www.fomecd.edu.np/",
        "type": "management",
    },
]


def fetch_page(url: str, timeout: int = 15) -> str | None:
    try:
        resp = requests.get(url, headers=HEADERS, timeout=timeout)
        resp.raise_for_status()
        resp.encoding = resp.apparent_encoding or "utf-8"
        return resp.text
    except requests.RequestException as e:
        logger.warning("Failed to fetch %s: %s", url, e)
        return None


def parse_edusanjal_news(html: str) -> List[Dict]:
    items = []
    soup = BeautifulSoup(html, "html.parser")
    for article in soup.select("article, .news-item, .post-item, .card"):
        title_el = article.select_one("h2 a, h3 a, .title a, a")
        if not title_el:
            continue
        title = title_el.get_text(strip=True)
        link = urljoin("https://edusanjal.com", title_el.get("href", ""))
        date_el = article.select_one("time, .date, .meta-date, span.date")
        date = date_el.get_text(strip=True) if date_el else ""
        excerpt_el = article.select_one("p, .excerpt, .description, .summary")
        excerpt = excerpt_el.get_text(strip=True) if excerpt_el else ""
        items.append({"title": title, "date": date, "text": excerpt, "url": link})
    return items


def parse_edusanjal_vacancy(html: str) -> List[Dict]:
    items = []
    soup = BeautifulSoup(html, "html.parser")
    for article in soup.select("article, .vacancy-item, .job-item, .card"):
        title_el = article.select_one("h2 a, h3 a, .title a, a")
        if not title_el:
            continue
        title = title_el.get_text(strip=True)
        link = urljoin("https://edusanjal.com", title_el.get("href", ""))
        date_el = article.select_one("time, .date, .meta-date")
        date = date_el.get_text(strip=True) if date_el else ""
        excerpt_el = article.select_one("p, .excerpt, .description")
        excerpt = excerpt_el.get_text(strip=True) if excerpt_el else ""
        items.append({"title": title, "date": date, "text": excerpt, "url": link})
    return items


def parse_educate_nepal(html: str) -> List[Dict]:
    items = []
    soup = BeautifulSoup(html, "html.parser")
    for article in soup.select("article, .post, .blog-post, .entry, .card, .scholarship-item"):
        title_el = article.select_one("h2 a, h3 a, .entry-title a, .title a")
        if not title_el:
            continue
        title = title_el.get_text(strip=True)
        link = urljoin("https://www.educatenepal.com", title_el.get("href", ""))
        date_el = article.select_one("time, .date, .post-date, .entry-date")
        date = date_el.get_text(strip=True) if date_el else ""
        excerpt_el = article.select_one("p, .excerpt, .entry-summary")
        excerpt = excerpt_el.get_text(strip=True) if excerpt_el else ""
        items.append({"title": title, "date": date, "text": excerpt, "url": link})
    return items


def parse_tu_exam(html: str) -> List[Dict]:
    items = []
    soup = BeautifulSoup(html, "html.parser")
    for article in soup.select("tr, .notice-item, .news-item, li, .post"):
        title_el = article.select_one("a")
        if not title_el:
            continue
        title = title_el.get_text(strip=True)
        link = urljoin("https://exam.tu.edu.np", title_el.get("href", ""))
        date_el = article.select_one("td, .date, time, span")
        date = date_el.get_text(strip=True) if date_el else ""
        items.append({"title": title, "date": date, "text": "", "url": link})
        if not items[-1]["title"]:
            items.pop()
    return items


def parse_fomecd(html: str) -> List[Dict]:
    items = []
    soup = BeautifulSoup(html, "html.parser")
    for article in soup.select("article, .post, .notice-item, .entry, tr, li a"):
        title_el = article.select_one("h2 a, h3 a, a")
        if not title_el:
            continue
        title = title_el.get_text(strip=True)
        link = urljoin("https://www.fomecd.edu.np", title_el.get("href", ""))
        date_el = article.select_one("time, .date, td, span.date")
        date = date_el.get_text(strip=True) if date_el else ""
        excerpt_el = article.select_one("p, .excerpt, td")
        excerpt = excerpt_el.get_text(strip=True) if excerpt_el else ""
        items.append({"title": title, "date": date, "text": excerpt, "url": link})
    return items


PARSERS = {
    "https://edusanjal.com/news/": parse_edusanjal_news,
    "https://edusanjal.com/vacancy/": parse_edusanjal_vacancy,
    "https://www.educatenepal.com/": parse_educate_nepal,
    "https://exam.tu.edu.np/": parse_tu_exam,
    "https://www.fomecd.edu.np/": parse_fomecd,
}


def scrape_all() -> List[Dict]:
    all_items = []
    for portal in PORTALS:
        url = portal["url"]
        name = portal["name"]
        ptype = portal["type"]
        logger.info("Scraping %s (%s)...", name, url)
        html = fetch_page(url)
        if not html:
            logger.warning("No content from %s, skipping", name)
            continue
        parser = PARSERS.get(url)
        if not parser:
            logger.warning("No parser for %s, skipping", url)
            continue
        try:
            items = parser(html)
        except Exception as e:
            logger.error("Parser failed for %s: %s", name, e)
            continue
        for item in items:
            item["source"] = name
            item["type"] = ptype
            item["scraped_at"] = datetime.now().isoformat()
        logger.info("  -> %d items from %s", len(items), name)
        all_items.extend(items)
        time.sleep(1.5)
    return all_items


def format_notices(items: List[Dict]) -> str:
    lines = []
    for i, item in enumerate(items, 1):
        lines.append(f"[Notice #{i}]")
        lines.append(f"Source: {item.get('source', 'Unknown')}")
        lines.append(f"Category: {item.get('type', 'general')}")
        lines.append(f"Title: {item.get('title', '')}")
        lines.append(f"Date: {item.get('date', 'N/A')}")
        if item.get("text"):
            lines.append(f"Content: {item['text']}")
        if item.get("url"):
            lines.append(f"URL: {item['url']}")
        lines.append(f"Scraped At: {item.get('scraped_at', '')}")
        lines.append("---")
        lines.append("")
    return "\n".join(lines)


def run_scraper() -> str:
    logger.info("=== UniPath Scraper Starting ===")
    items = scrape_all()
    content = format_notices(items)

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write(content)

    summary = (
        f"Scraped {len(items)} notices from {len(PORTALS)} portals "
        f"-> {OUTPUT_PATH}"
    )
    logger.info(summary)
    return summary


def get_scraped_context() -> str:
    if not os.path.exists(OUTPUT_PATH):
        run_scraper()
    try:
        with open(OUTPUT_PATH, "r", encoding="utf-8") as f:
            return f.read()
    except (IOError, OSError):
        return ""


if __name__ == "__main__":
    run_scraper()
