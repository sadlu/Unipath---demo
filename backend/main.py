import re
import sys
import os
from pathlib import Path
from datetime import datetime, timezone

os.environ.setdefault("DOTENV_LOADED", "1")

try:
    from dotenv import load_dotenv
    env_path = Path(__file__).resolve().parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)
except ImportError:
    pass

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

sys.path.insert(0, str(Path(__file__).resolve().parent))

from pipeline import run_pipeline
from local_index import ask as local_ask, scrape_all, index_status
from search_service import search_nepal
from config import settings
from database import (
    init_db,
    upsert_user,
    get_user,
    get_user_by_email,
    search_users,
    create_verification_code,
    verify_code,
    send_message,
    get_conversations,
    get_messages,
    follow_user,
    unfollow_user,
    get_following,
    get_followers,
    is_following,
    get_db as get_db_context,
)
from email_service import send_verification_email

app = FastAPI(
    title="UniPath Backend",
    description="Search-then-Extract API for Nepal-focused educational opportunities",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SearchResponse(BaseModel):
    query: str
    answer: str | None = None
    results: list[dict] = []
    error: str | None = None


class ChatRequest(BaseModel):
    query: str
    max_results: int = 8


class ChatResponse(BaseModel):
    query: str
    answer: str | None = None
    results: list[dict] = []
    error: str | None = None


@app.get("/api/search")
def search_endpoint(
    q: str = Query(..., description="Search query for Nepal opportunities"),
    max_results: int = Query(8, ge=1, le=20),
):
    result = run_pipeline(
        user_query=q,
        max_search_results=max_results,
    )
    return SearchResponse(
        query=result.query,
        answer=result.answer,
        results=[
            {"title": r.title, "url": r.url, "snippet": r.snippet, "source_site": r.source_site}
            for r in result.results
        ],
        error=result.error,
    )


@app.post("/api/chat", response_model=ChatResponse)
def chat_endpoint(body: ChatRequest):
    result = run_pipeline(
        user_query=body.query,
        max_search_results=body.max_results,
    )
    return ChatResponse(
        query=result.query,
        answer=result.answer,
        results=[
            {"title": r.title, "url": r.url, "snippet": r.snippet, "source_site": r.source_site}
            for r in result.results
        ],
        error=result.error,
    )


@app.get("/api/local-index/status")
def local_index_status():
    return index_status()


class LocalIndexAskRequest(BaseModel):
    question: str


class LocalIndexAskResponse(BaseModel):
    question: str
    answer: str


@app.post("/api/local-index/ask", response_model=LocalIndexAskResponse)
def local_index_ask(body: LocalIndexAskRequest):
    answer = local_ask(body.question)
    return LocalIndexAskResponse(question=body.question, answer=answer)


@app.post("/api/local-index/scrape")
def local_index_scrape():
    path = scrape_all()
    return {"message": f"Index saved to {path}"}


class DiscoverRequest(BaseModel):
    subjects: str = ""
    limit: int = 20


class DiscoveredOpportunity(BaseModel):
    id: int
    title: str
    description: str
    tags: list[str] = []
    organization: str
    location: str = "Kathmandu, Nepal"
    coordinates: dict = {"lat": 27.7172, "lng": 85.3240}
    startDate: str = ""
    applyUrl: str = ""
    matchPercentage: int = 50
    imageIcon: str = "\U0001f30d"


def _score_result_freshness(title: str, snippet: str) -> int:
    now = datetime.now(timezone.utc)
    current_year = now.year
    text = f"{title} {snippet}"

    years_found: set[int] = set()
    for m in re.finditer(r"\b(20\d{2})\b", text):
        years_found.add(int(m.group(1)))

    if not years_found:
        return 30

    if current_year in years_found:
        return 80
    if current_year + 1 in years_found:
        return 90
    if any(y > current_year for y in years_found):
        return 85
    if current_year - 1 in years_found:
        return 20
    if any(y < current_year - 1 for y in years_found):
        return 5
    return 30


@app.get("/api/discover")
def discover_endpoint(
    subjects: str = Query("", description="Comma-separated subjects"),
    limit: int = Query(40, ge=1, le=60),
):
    now = datetime.now(timezone.utc)
    year = now.year
    query_parts = [s.strip() for s in subjects.split(",") if s.strip()]
    query = " ".join(query_parts) if query_parts else "opportunity"
    search_query = f"{query} Nepal Kathmandu {year}"

    search_resp = search_nepal(search_query, max_results=limit)

    if search_resp.error:
        return {"opportunities": [], "error": search_resp.error}

    scored: list[tuple[int, DiscoveredOpportunity]] = []
    seen_titles: set[str] = set()

    for idx, r in enumerate(search_resp.results):
        title = (r.title or "").strip()
        if not title or title.lower() in seen_titles:
            continue
        seen_titles.add(title.lower())

        snippet = (r.snippet or "")[:300]
        org = r.source_site or "Unknown"

        freshness = _score_result_freshness(title, snippet)
        if freshness < 10:
            continue

        matched_kw = sum(1 for kw in query_parts if kw.lower() in (title + snippet).lower())
        match_pct = min(98, freshness + matched_kw * 5)

        opp = DiscoveredOpportunity(
            id=idx + 1,
            title=title,
            description=snippet or "No description available.",
            tags=[p.capitalize() for p in query_parts[:3]] if query_parts else ["Opportunity"],
            organization=org,
            applyUrl=r.url or "",
            matchPercentage=match_pct,
        )
        scored.append((freshness, opp))

    scored.sort(key=lambda x: -x[0])
    opportunities = [o for _, o in scored[:20]]

    return {"opportunities": [o.model_dump() for o in opportunities], "error": None}


@app.on_event("startup")
def on_startup():
    init_db()


class RegisterEmailRequest(BaseModel):
    uid: str
    email: str
    display_name: str = ""


class VerifyEmailRequest(BaseModel):
    email: str
    code: str
    uid: str


class PeopleSearchResponse(BaseModel):
    users: list[dict]
    error: str | None = None


class UserProfileResponse(BaseModel):
    user: dict | None = None
    error: str | None = None


class FollowRequest(BaseModel):
    follower_uid: str
    following_uid: str


class FollowResponse(BaseModel):
    ok: bool
    following: bool = False
    error: str | None = None


class FollowingResponse(BaseModel):
    uids: list[str]
    error: str | None = None


class SendMessageRequest(BaseModel):
    from_uid: str
    to_uid: str
    content: str


class ConversationsResponse(BaseModel):
    conversations: list[dict]
    error: str | None = None


class MessagesResponse(BaseModel):
    messages: list[dict]
    error: str | None = None


@app.post("/api/people/init")
def people_init(body: RegisterEmailRequest):
    upsert_user(uid=body.uid, display_name=body.display_name, email=body.email)
    return {"ok": True}


@app.post("/api/people/register-email")
def register_email(body: RegisterEmailRequest):
    existing = get_user_by_email(body.email)
    if existing and existing["uid"] != body.uid:
        return {"ok": False, "error": "Email already in use by another account"}
    upsert_user(uid=body.uid, display_name=body.display_name, email=body.email)
    code = create_verification_code(body.email)
    sent, msg = send_verification_email(body.email, code, body.display_name)
    if sent:
        return {"ok": True, "message": "Verification code sent to your email"}
    return {"ok": False, "error": msg}


@app.post("/api/people/verify-email")
def verify_email_endpoint(body: VerifyEmailRequest):
    ok = verify_code(body.email, body.code)
    if ok:
        with get_db_context() as conn:
            conn.execute("UPDATE users SET email_verified = 1 WHERE uid = ?", (body.uid,))
        return {"ok": True}
    return {"ok": False, "error": "Invalid or expired code"}


@app.get("/api/people/search")
def people_search(q: str = "", exclude_uid: str = "", limit: int = 20):
    if not q.strip():
        return {"users": [], "error": None}
    users = search_users(q.strip(), exclude_uid=exclude_uid, limit=limit)
    return {"users": users, "error": None}


@app.get("/api/people/profile/{uid}")
def people_profile(uid: str):
    user = get_user(uid)
    if user:
        return {"user": user, "error": None}
    return {"user": None, "error": "User not found"}


def _is_guest_email(email: str) -> bool:
    return not email or email == "guest@unipath.local" or "@" not in email


@app.post("/api/people/follow")
def people_follow(body: FollowRequest):
    if body.follower_uid == body.following_uid:
        return FollowResponse(ok=False, error="Cannot follow yourself")
    user = get_user(body.following_uid)
    if not user:
        return FollowResponse(ok=False, error="User not found")
    follow_user(body.follower_uid, body.following_uid)
    return FollowResponse(ok=True, following=True)


@app.post("/api/people/unfollow")
def people_unfollow(body: FollowRequest):
    unfollow_user(body.follower_uid, body.following_uid)
    return FollowResponse(ok=True, following=False)


@app.get("/api/people/following/{uid}")
def people_following(uid: str):
    uids = get_following(uid)
    return FollowingResponse(uids=uids, error=None)


@app.get("/api/people/followers/{uid}")
def people_followers(uid: str):
    uids = get_followers(uid)
    return FollowingResponse(uids=uids, error=None)


@app.get("/api/people/is-following")
def people_is_following(follower_uid: str, following_uid: str):
    result = is_following(follower_uid, following_uid)
    return {"ok": True, "following": result}


@app.post("/api/chat/send")
def chat_send(body: SendMessageRequest):
    if not body.content.strip():
        return {"ok": False, "error": "Message cannot be empty"}
    sender = get_user(body.from_uid)
    recipient = get_user(body.to_uid)
    if not sender:
        return {"ok": False, "error": "Sender not found. Init your account first."}
    if not recipient:
        return {"ok": False, "error": "Recipient not found."}
    sender_email = sender.get("email", "")
    if not _is_guest_email(sender_email) and not sender.get("email_verified"):
        return {"ok": False, "error": "You must verify your email before sending messages. Go to Settings > Privacy & Security to verify."}
    msg = send_message(body.from_uid, body.to_uid, body.content.strip())
    return {"ok": True, "message": msg}


@app.get("/api/chat/conversations")
def chat_conversations(uid: str):
    convos = get_conversations(uid)
    return {"conversations": convos, "error": None}


@app.get("/api/chat/messages")
def chat_messages(uid_a: str, uid_b: str, limit: int = 50):
    msgs = get_messages(uid_a, uid_b, limit=limit)
    return {"messages": msgs, "error": None}


@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "openai_configured": settings.has_openai_key,
        "local_index_exists": index_status()["exists"],
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, log_level="info")
