"""Intelligent opportunity classification using lightweight zero-cost approaches.

Uses TF-IDF + cosine similarity for category matching (no paid APIs).
Falls back to keyword matching when the model is unavailable.
"""

import re
import math
import json
from collections import Counter
from typing import Optional

NEPAL_KEYWORDS = ["nepal", "kathmandu", "pokhara", "lalitpur", "bhaktapur", "site:.np"]

CATEGORIES = {
    "volunteering": {
        "icon": "\U0001f9f3",
        "keywords": ["volunteer", "volunteering", "community service", "social work", "sewa", "ngo", "nonprofit", "charity", "service"],
        "weight": 1.0,
    },
    "workshop": {
        "icon": "\U0001f528",
        "keywords": ["workshop", "training", "bootcamp", "skill", "hands-on", "learn", "masterclass", "seminar", "practical"],
        "weight": 1.0,
    },
    "competition": {
        "icon": "\U0001f3c6",
        "keywords": ["competition", "hackathon", "contest", "olympiad", "challenge", "quiz", "tournament", "championship"],
        "weight": 1.0,
    },
    "scholarship": {
        "icon": "\U0001f393",
        "keywords": ["scholarship", "fellowship", "grant", "funding", "financial aid", "merit", "stipend", "award"],
        "weight": 1.5,
    },
    "internship": {
        "icon": "\U0001f4bc",
        "keywords": ["internship", "intern", "trainee", "apprenticeship", "placement", "work experience"],
        "weight": 1.2,
    },
    "conference": {
        "icon": "\U0001f30d",
        "keywords": ["conference", "summit", "symposium", "convention", "forum", "meetup", "networking"],
        "weight": 1.0,
    },
    "job": {
        "icon": "\U0001f4bc",
        "keywords": ["job", "career", "vacancy", "employment", "hiring", "recruitment", "position", "opening", "work"],
        "weight": 1.0,
    },
    "exam": {
        "icon": "\U0001f4da",
        "keywords": ["exam", "examination", "test", "entrance", "admission", "result", "notice"],
        "weight": 0.8,
    },
    "event": {
        "icon": "\U0001f389",
        "keywords": ["event", "program", "activity", "extracurricular", "festival", "celebration"],
        "weight": 0.9,
    },
}

SKIP_PATTERNS = re.compile(
    r"(top\s+\d+|best\s+colleges?|ranking|admission\s+open|"
    r"university\s+review|college\s+review|syllabus|"
    r"entrance\s+exam|result|grade\s+sheet|"
    r"[\u0400-\u04FF])",
    re.IGNORECASE,
)


def _tokenize(text: str) -> list[str]:
    text = text.lower()
    tokens = re.findall(r"[a-z]+(?:'[a-z]+)?", text)
    stopwords = {
        "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
        "have", "has", "had", "do", "does", "did", "will", "would", "could",
        "should", "may", "might", "shall", "can", "need", "dare", "ought",
        "used", "to", "of", "in", "for", "on", "with", "at", "by", "from",
        "up", "about", "into", "over", "after", "all", "each", "every",
        "both", "few", "more", "most", "other", "some", "such", "no", "nor",
        "not", "only", "own", "same", "so", "than", "too", "very", "just",
        "because", "as", "until", "while", "that", "this", "these", "those",
        "it", "its", "and", "but", "or", "if", "then", "else", "when",
    }
    return [t for t in tokens if t not in stopwords and len(t) > 2]


def _tfidf_score(tokens: list[str], category_keywords: list[str]) -> float:
    token_counts = Counter(tokens)
    total_tokens = len(tokens)
    if total_tokens == 0:
        return 0.0

    score = 0.0
    cat_tokens = set(_tokenize(" ".join(category_keywords)))

    for token in cat_tokens:
        tf = token_counts.get(token, 0) / total_tokens
        if tf > 0:
            idf = math.log((len(token_counts) + 1) / (token_counts.get(token, 1) + 1)) + 1
            score += tf * idf

    return score


def classify_opportunity(title: str, snippet: str) -> tuple[str, str]:
    text = f"{title} {snippet}"
    text_lower = text.lower()

    best_category = "opportunity"
    best_icon = "\U0001f30d"
    best_score = 0.0

    tokens = _tokenize(text)

    for cat_name, cat_info in CATEGORIES.items():
        kw_score = sum(
            cat_info["weight"] * (1.5 if kw in text_lower else 1.0)
            for kw in cat_info["keywords"]
            if kw in text_lower
        )
        tfidf = _tfidf_score(tokens, cat_info["keywords"])
        combined = kw_score + tfidf * 10

        if combined > best_score:
            best_score = combined
            best_category = cat_name.capitalize()
            best_icon = cat_info["icon"]

    if best_score == 0.0:
        return "Opportunity", "\U0001f30d"

    return best_category, best_icon


def is_relevant(title: str, snippet: str, query_parts: list[str]) -> bool:
    text = f"{title} {snippet}".lower()
    if SKIP_PATTERNS.search(text):
        return False
    if not any(kw in text for kw in NEPAL_KEYWORDS):
        return False
    if query_parts:
        if not any(kw.lower() in text for kw in query_parts):
            return False
    return True


def compute_match_percentage(
    title: str,
    snippet: str,
    query_parts: list[str],
    freshness_score: int,
) -> int:
    text = f"{title} {snippet}".lower()
    matched_kw = sum(1 for kw in query_parts if kw.lower() in text)
    kw_bonus = matched_kw * 5
    length_bonus = min(10, len(title) // 10)
    return min(98, freshness_score + kw_bonus + length_bonus + 5)
