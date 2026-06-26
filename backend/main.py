import re
import sys
import os
import threading
import uuid
import shutil
import html
import json
import time
def _detect_image_type(data: bytes) -> str | None:
    if data[:2] == b'\xff\xd8':
        return 'jpeg'
    if data[:4] == b'\x89PNG':
        return 'png'
    if data[:6] in (b'GIF87a', b'GIF89a'):
        return 'gif'
    if data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        return 'webp'
    return None
import logging
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

from fastapi import FastAPI, Query, UploadFile, File, WebSocket, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

sys.path.insert(0, str(Path(__file__).resolve().parent))

from middleware import RateLimitMiddleware
from pipeline import run_pipeline
from local_index import ask as local_ask, scrape_all, index_status
from search_service import search_nepal, search_nepal_multi
from llm_service import generate_cv_advice_with_fallback
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
    update_user_profile,
    get_db as get_db_context,
    create_account,
    authenticate,
    create_auth_token,
    create_auth_token_pair,
    refresh_auth_token,
    get_uid_by_token,
    delete_auth_token,
    sync_user_data,
    hash_password,
    update_user_password,
    cleanup_expired_verifications,
    create_password_reset_token,
    verify_password_reset_token,
    delete_user_account,
    export_user_data,
    get_all_uids,
)
from email_service import send_verification_email
from cache import search_cache, discover_cache, opportunity_cache
from deduplicator import is_duplicate, mark_seen, start_dedup_cleaner, dedup_size
from classifier import classify_opportunity, is_relevant, compute_match_percentage
from ground_truth import verify_url, queue_verification, start_verifier_thread
from websocket_handler import manager, handle_chat_ws
from feedback import submit_feedback, get_feedback_stats, get_user_feedback, get_highest_rated, ensure_feedback_tables
from scheduler import start_scheduler

logger = logging.getLogger(__name__)

app = FastAPI(
    title="UniPath Backend",
    description="Search-then-Extract API for Nepal-focused educational opportunities",
    version="2.0.0",
)

FRONTEND_DIST = Path(__file__).resolve().parent.parent / "dist"
ALLOWED_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://localhost:4173,http://127.0.0.1:5173,http://127.0.0.1:4173,http://localhost:8000,http://127.0.0.1:8000,capacitor://localhost,http://localhost,https://unipath-proxy.fouadazad1234.workers.dev"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(RateLimitMiddleware)

UPLOAD_DIR = Path(__file__).resolve().parent / "uploads"
AVATAR_DIR = UPLOAD_DIR / "avatars"
CHAT_IMG_DIR = UPLOAD_DIR / "chat"
AVATAR_DIR.mkdir(parents=True, exist_ok=True)
CHAT_IMG_DIR.mkdir(parents=True, exist_ok=True)

_ALLOWED_MIME_TYPES = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "gif": "image/gif",
    "webp": "image/webp",
}

app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="frontend_assets")


class SearchResponse(BaseModel):
    query: str
    answer: str | None = None
    results: list[dict] = []
    error: str | None = None
    cached: bool = False


class ChatRequest(BaseModel):
    query: str
    max_results: int = 8


class ChatResponse(BaseModel):
    query: str
    answer: str | None = None
    results: list[dict] = []
    error: str | None = None
    cached: bool = False


@app.get("/api/search")
def search_endpoint(
    q: str = Query(..., description="Search query for Nepal opportunities"),
    max_results: int = Query(8, ge=1, le=20),
):
    cache_key = f"search:{q.lower().strip()}:{max_results}"
    cached = search_cache.get(cache_key)
    if cached:
        return SearchResponse(**cached, cached=True)

    result = run_pipeline(
        user_query=q,
        max_search_results=max_results,
    )
    resp = SearchResponse(
        query=result.query,
        answer=result.answer,
        results=[
            {"title": r.title, "url": r.url, "snippet": r.snippet, "source_site": r.source_site}
            for r in result.results
        ],
        error=result.error,
    )
    search_cache.set(cache_key, resp.model_dump())
    return resp


@app.post("/api/chat", response_model=ChatResponse)
def chat_endpoint(body: ChatRequest):
    cache_key = f"chat:{body.query.lower().strip()}:{body.max_results}"
    cached = search_cache.get(cache_key)
    if cached:
        return ChatResponse(**cached, cached=True)

    result = run_pipeline(
        user_query=body.query,
        max_search_results=body.max_results,
    )
    resp = ChatResponse(
        query=result.query,
        answer=result.answer,
        results=[
            {"title": r.title, "url": r.url, "snippet": r.snippet, "source_site": r.source_site}
            for r in result.results
        ],
        error=result.error,
    )
    search_cache.set(cache_key, resp.model_dump())
    return resp


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
    registrationDeadline: str = ""
    cost: str = ""
    eligibility: str = ""
    skills: str = ""
    verified: bool = False
    verified_at: str = ""


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


_NEPAL_KEYWORDS = ["nepal", "kathmandu", "pokhara", "lalitpur", "bhaktapur", "site:.np"]

_SKIP_PATTERNS = re.compile(
    r"(top\s+\d+|best\s+colleges?|ranking|admission\s+open|"
    r"university\s+review|college\s+review|syllabus|"
    r"entrance\s+exam|result|grade\s+sheet|"
    r"[\u0400-\u04FF])",
    re.IGNORECASE,
)


def _extract_deadline(text: str) -> str:
    patterns = [
        r"(?:deadline|apply\s*(?:before|by)|last\s*date|registration\s*(?:closes?|ends?|deadline))\s*:?\s*"
        r"(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2}|"
        r"(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s*\d{4}|\d{1,2}\s+"
        r"(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4})",
        r"(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4})",
    ]
    for pattern in patterns:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            return m.group(1)
    return ""


def _extract_cost(text: str) -> str:
    m = re.search(
        r"(?:free|cost|fee|price|ticket|npr\s*[\d,]+|rs\s*[\d,]+|\$\s*[\d,]+|"
        r"no\s*(?:cost|fee)|scholarship\s*(?:available|provided))",
        text, re.IGNORECASE,
    )
    if not m:
        return ""
    val = m.group(0)
    if val.lower() in ("free", "no cost", "no fee"):
        return "Free"
    return val


_AGE_RESTRICTED = re.compile(r"(18\+|21\+|adults?\s+(?:only|above)|minimum\s*age\s*1[89]|ages?\s*1[89]\+)", re.IGNORECASE)
_TEEN_KEYWORDS = re.compile(
    r"(students?|teen|young|all\s*ages?|no\s*age\s*limit|open\s*to\s*all|"
    r"for\s*(?:school|high\s*school|a\s*level|class\s*(?:11|12))|"
    r"under\s*1[89]|[\s^]16[\s-]1[89])",
    re.IGNORECASE,
)


def _extract_eligibility(text: str) -> str:
    m = re.search(
        r"(?:eligibility|(?:who\s+can\s+apply|open\s+to|for)\s*:?\s*[^.]{10,100})",
        text, re.IGNORECASE,
    )
    if m:
        raw = m.group(0)
        idx = raw.find(":")
        val = raw[idx + 1:].strip() if idx != -1 else raw
        if _AGE_RESTRICTED.search(val):
            return val
        if _TEEN_KEYWORDS.search(val):
            return f"{val} \u2022 Teen-friendly"
        return val

    if _AGE_RESTRICTED.search(text):
        m2 = _AGE_RESTRICTED.search(text)
        return m2.group(0)

    if _TEEN_KEYWORDS.search(text):
        return "Open to students (teen-friendly)"

    for kw in ["anyone", "all levels", "no experience"]:
        if kw in text.lower():
            return "Open to all \u2022 Teen-friendly"

    return ""


def _extract_skills(text: str) -> str:
    m = re.search(
        r"(?:learn|skills?(?:\s+(?:you['']?ll\s+)?gain)?|you['']?ll\s+learn)\s*:?\s*([^.]{10,120})",
        text, re.IGNORECASE,
    )
    return m.group(1).strip() if m else ""


@app.get("/api/discover")
def discover_endpoint(
    subjects: str = Query("", description="Comma-separated subjects"),
    limit: int = Query(40, ge=1, le=60),
    type: str = Query("", description="Filter: volunteering, workshop, competition, scholarship, internship, conference"),
    location: str = Query("", description="City or region in Nepal"),
    date_from: str = Query("", description="Posted after YYYY-MM-DD"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
):
    now = datetime.now(timezone.utc)
    year = now.year
    query_parts = [s.strip() for s in subjects.split(",") if s.strip()]
    subject_str = " ".join(query_parts) if query_parts else "opportunity"

    type_filter = type.strip().lower() if type else ""
    location_filter = location.strip() if location else ""

    seen_titles: set[str] = set()
    all_opps: list[tuple[int, DiscoveredOpportunity]] = []
    opp_id = 0

    queries = [
        f"{subject_str} for students {topic} Nepal {year}"
        for topic in ("opportunity program", "event workshop", "volunteer internship", "scholarship competition")
    ]
    search_responses = search_nepal_multi(queries, max_results_per=15)

    for search_resp in search_responses:
        if search_resp.error:
            continue

        for r in search_resp.results:
            title = (r.title or "").strip()
            snippet = (r.snippet or "")[:300]
            url = r.url or ""

            if not title or title.lower() in seen_titles:
                continue
            if not is_relevant(title, snippet, query_parts):
                continue
            if is_duplicate(title, url):
                continue

            seen_titles.add(title.lower())
            mark_seen(title, url)

            freshness = _score_result_freshness(title, snippet)
            if freshness < 10:
                continue

            match_pct = compute_match_percentage(title, snippet, query_parts, freshness)

            category, icon = classify_opportunity(title, snippet)

            if type_filter and category.lower() != type_filter:
                continue
            if location_filter and location_filter.lower() not in (title + snippet).lower():
                continue

            extracted = f"{title} {snippet}"
            deadline = _extract_deadline(extracted)
            cost = _extract_cost(extracted)
            eligibility = _extract_eligibility(extracted)
            skills = _extract_skills(extracted)

            verification = verify_url(url)
            queue_verification(url)

            opp_id += 1
            all_opps.append((
                freshness,
                DiscoveredOpportunity(
                    id=opp_id,
                    title=title,
                    description=snippet or "No description available.",
                    tags=[category] + [p.capitalize() for p in query_parts[:2]],
                    organization=r.source_site or "Unknown",
                    applyUrl=url or "",
                    matchPercentage=match_pct,
                    registrationDeadline=deadline,
                    cost=cost,
                    eligibility=eligibility,
                    skills=skills,
                    verified=verification.get("alive", False),
                    verified_at=verification.get("checked_at", ""),
                ),
            ))

    all_opps.sort(key=lambda x: -x[0])
    total = len(all_opps)
    opportunities = [o for _, o in all_opps[offset:offset + limit]]

    return {
        "opportunities": [o.model_dump() for o in opportunities],
        "total": total,
        "offset": offset,
        "limit": limit,
        "error": None,
    }


class CVAdviseRequest(BaseModel):
    uid: str
    query: str
    conversation_history: list[dict] = []


class CVAdviseResponse(BaseModel):
    query: str
    answer: str | None = None
    provider: str | None = None
    error: str | None = None


@app.post("/api/cv/advise", response_model=CVAdviseResponse)
def cv_advise_endpoint(body: CVAdviseRequest):
    user = get_user(body.uid)
    if not user:
        return CVAdviseResponse(query=body.query, error="User not found. Please create an account first.")

    try:
        achievements = json.loads(user.get("achievements", "[]"))
    except:
        achievements = []
    user_profile = {
        "display_name": user.get("display_name", ""),
        "email": user.get("email", ""),
        "bio": user.get("bio", ""),
        "subjects": user.get("subjects", ""),
        "level": user.get("level", 1),
        "xp": user.get("xp", 0),
        "achievements": achievements,
    }

    subject_parts = [s.strip() for s in user.get("subjects", "").split(",") if s.strip()]
    search_topic = " ".join(subject_parts) if subject_parts else "scholarship internship opportunity"
    query = f"{search_topic} {body.query} Nepal"

    search_resp = search_nepal(query, max_results=6)
    snippets = []
    if search_resp and not search_resp.error:
        snippets = [
            {
                "title": r.title,
                "url": r.url,
                "snippet": r.snippet,
                "source_site": r.source_site,
            }
            for r in search_resp.results
        ]

    answer, provider = generate_cv_advice_with_fallback(
        user_query=body.query,
        user_profile=user_profile,
        search_snippets=snippets,
        conversation_history=body.conversation_history or None,
    )

    if answer is None:
        return CVAdviseResponse(
            query=body.query,
            error="No AI provider is currently available. Please configure at least one API key in your .env file, or start Ollama locally.",
        )

    return CVAdviseResponse(query=body.query, answer=answer, provider=provider)


@app.on_event("startup")
def on_startup():
    init_db()
    ensure_feedback_tables()
    start_scheduler()


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
    content: str = ""
    image_url: str = ""


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


class UpdateProfileRequest(BaseModel):
    uid: str
    display_name: str | None = None
    bio: str | None = None
    subjects: list[str] | None = None


@app.post("/api/people/update-profile")
def update_profile(body: UpdateProfileRequest):
    ok = update_user_profile(
        uid=body.uid,
        display_name=_sanitize(body.display_name) if body.display_name else None,
        bio=_sanitize(body.bio)[:500] if body.bio else None,
    )
    return {"ok": ok}


@app.put("/api/people/profile/{uid}")
def put_profile(uid: str, body: UpdateProfileRequest):
    ok = update_user_profile(
        uid=uid,
        display_name=_sanitize(body.display_name) if body.display_name else None,
        bio=_sanitize(body.bio)[:500] if body.bio else None,
    )
    if body.subjects is not None:
        with get_db_context() as conn:
            conn.execute("UPDATE users SET subjects = ? WHERE uid = ?", (",".join(body.subjects), uid))
    return {"ok": ok, "error": None}


def _validate_image(file: UploadFile) -> bool:
    ext = Path(file.filename or ".jpg").suffix.lower().lstrip(".")
    if ext not in _ALLOWED_MIME_TYPES:
        return False
    contents = file.file.read(32)
    file.file.seek(0)
    detected = _detect_image_type(contents) or ext
    return detected in _ALLOWED_MIME_TYPES


@app.post("/api/upload/avatar")
async def upload_avatar(uid: str = Query(...), file: UploadFile = File(...)):
    if not _validate_image(file):
        return {"ok": False, "error": "Invalid image type. Allowed: jpg, png, gif, webp"}
    ext = Path(file.filename or ".jpg").suffix
    filename = f"{uid}{ext}"
    dest = AVATAR_DIR / filename
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)
    url = f"/uploads/avatars/{filename}"
    update_user_profile(uid=uid, avatar_url=url)
    return {"ok": True, "url": url}


@app.post("/api/upload/chat-image")
async def upload_chat_image(file: UploadFile = File(...)):
    if not _validate_image(file):
        return {"ok": False, "error": "Invalid image type. Allowed: jpg, png, gif, webp"}
    ext = Path(file.filename or ".jpg").suffix
    filename = f"{uuid.uuid4().hex}{ext}"
    dest = CHAT_IMG_DIR / filename
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)
    url = f"/uploads/chat/{filename}"
    return {"ok": True, "url": url}


@app.post("/api/people/register-email")
def register_email(body: RegisterEmailRequest):
    existing = get_user_by_email(body.email)
    if existing and existing["uid"] != body.uid:
        return {"ok": False, "error": "Email already in use by another account"}
    upsert_user(uid=_sanitize(body.uid), display_name=_sanitize(body.display_name) or body.uid, email=body.email.strip())
    code = create_verification_code(body.email)
    sent, msg = send_verification_email(body.email, code, body.display_name)
    if not sent:
        return {"ok": False, "error": msg}
    return {"ok": True, "message": "Verification code sent"}


@app.post("/api/people/verify-email")
def verify_email_endpoint(body: VerifyEmailRequest):
    if not verify_code(body.email, body.code):
        return {"ok": False, "error": "Invalid verification code. Check your email and try again."}
    with get_db_context() as conn:
        conn.execute("UPDATE users SET email_verified = 1 WHERE uid = ?", (body.uid,))
    return {"ok": True, "message": "Email verified successfully"}


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



def _sanitize(text: str | None) -> str:
    if text is None:
        return ""
    return html.escape(text.strip(), quote=True)

@app.post("/api/chat/send")
def chat_send(body: SendMessageRequest):
    if not body.image_url and not body.content.strip():
        return {"ok": False, "error": "Message cannot be empty"}
    sender = get_user(body.from_uid)
    recipient = get_user(body.to_uid)
    if not sender:
        return {"ok": False, "error": "Sender not found. Init your account first."}
    if not recipient:
        return {"ok": False, "error": "Recipient not found."}
    sender_email = sender.get("email", "")
    if _is_guest_email(sender_email):
        return {"ok": False, "error": "Guest accounts cannot send messages. Create an account and verify your email."}
    if not sender.get("email_verified"):
        return {"ok": False, "error": "Verify your email before sending messages. Go to Settings > Privacy & Security."}
    content = _sanitize(body.content)[:2000] if body.content else ""
    msg = send_message(body.from_uid, body.to_uid, content, body.image_url)
    return {"ok": True, "message": msg}


@app.get("/api/chat/conversations")
def chat_conversations(uid: str):
    convos = get_conversations(uid)
    return {"conversations": convos, "error": None}


@app.get("/api/chat/messages")
def chat_messages(uid_a: str, uid_b: str, limit: int = 50):
    msgs = get_messages(uid_a, uid_b, limit=limit)
    return {"messages": msgs, "error": None}


class TypingRequest(BaseModel):
    uid: str
    conversation_with: str
    typing: bool = True


_typing_status: dict[str, dict[str, float]] = {}

@app.post("/api/chat/typing")
def chat_typing(body: TypingRequest):
    key = f"{body.uid}:{body.conversation_with}"
    if body.typing:
        _typing_status[key] = {"uid": body.uid, "conversation_with": body.conversation_with, "at": time.time()}
    else:
        _typing_status.pop(key, None)
    return {"ok": True}


@app.get("/api/chat/typing/{uid}/{conversation_with}")
def chat_typing_status(uid: str, conversation_with: str):
    key = f"{uid}:{conversation_with}"
    entry = _typing_status.get(key)
    if entry and time.time() - entry["at"] < 5:
        return {"typing": True}
    return {"typing": False}


@app.post("/api/chat/read")
def chat_mark_read(body: SendMessageRequest):
    with get_db_context() as conn:
        conn.execute(
            "UPDATE messages SET read = 1 WHERE from_uid = ? AND to_uid = ? AND read = 0",
            (body.to_uid, body.from_uid),
        )
    return {"ok": True}


@app.websocket("/ws/{uid}")
async def websocket_endpoint(ws: WebSocket, uid: str):
    await handle_chat_ws(ws, uid)


class AuthRegisterRequest(BaseModel):
    uid: str
    display_name: str
    password: str
    subjects: list[str] = []


class AuthLoginRequest(BaseModel):
    uid: str
    password: str


class AuthSyncRequest(BaseModel):
    token: str
    xp: int | None = None
    level: int | None = None
    streak_days: int | None = None
    subjects: list[str] | None = None
    slider_value: int | None = None
    achievements: list[str] | None = None
    settings: dict | None = None


def _validate_token(token: str) -> str | None:
    if not token or len(token) < 10:
        return None
    return get_uid_by_token(token)


@app.post("/api/auth/register")
def auth_register(body: AuthRegisterRequest):
    if len(body.password) < 4:
        return {"ok": False, "error": "Password must be at least 4 characters"}
    existing = get_user(body.uid)
    if existing and existing.get("password_hash"):
        return {"ok": False, "error": "Username already taken"}
    if existing and not existing.get("password_hash"):
        update_user_profile(uid=body.uid, display_name=body.display_name)
        with get_db_context() as conn:
            conn.execute("UPDATE users SET password_hash = ? WHERE uid = ?", (hash_password(body.password), body.uid))
            if body.subjects:
                conn.execute("UPDATE users SET subjects = ? WHERE uid = ?", (",".join(body.subjects), body.uid))
    else:
        create_account(body.uid, body.display_name, body.password, body.subjects)
    token, refresh_token = create_auth_token_pair(body.uid)
    user = get_user(body.uid)
    return {"ok": True, "token": token, "refresh_token": refresh_token, "user": _format_user(user)}


class AuthChangePasswordRequest(BaseModel):
    token: str
    current_password: str
    new_password: str


@app.post("/api/auth/change-password")
def auth_change_password(body: AuthChangePasswordRequest):
    uid = _validate_token(body.token)
    if not uid:
        return {"ok": False, "error": "Invalid or expired token"}
    if len(body.new_password) < 4:
        return {"ok": False, "error": "New password must be at least 4 characters"}
    user = authenticate(uid, body.current_password)
    if not user:
        return {"ok": False, "error": "Current password is incorrect"}
    ok = update_user_password(uid, hash_password(body.new_password))
    return {"ok": ok, "error": None}


@app.post("/api/auth/login")
def auth_login(body: AuthLoginRequest):
    user = authenticate(body.uid, body.password)
    if not user:
        return {"ok": False, "error": "Invalid username or password"}
    token, refresh_token = create_auth_token_pair(body.uid)
    return {"ok": True, "token": token, "refresh_token": refresh_token, "user": _format_user(user)}


class AuthRefreshRequest(BaseModel):
    refresh_token: str


@app.post("/api/auth/refresh")
def auth_refresh(body: AuthRefreshRequest):
    result = refresh_auth_token(body.refresh_token)
    if not result:
        return {"ok": False, "error": "Invalid or expired refresh token"}
    access, new_refresh = result
    return {"ok": True, "token": access, "refresh_token": new_refresh}


@app.post("/api/auth/logout")
def auth_logout(token: str = Query("")):
    delete_auth_token(token)
    return {"ok": True}


@app.get("/api/auth/me")
def auth_me(token: str = Query("")):
    uid = _validate_token(token)
    if not uid:
        return {"ok": False, "error": "Invalid or expired token"}
    user = get_user(uid)
    if not user:
        return {"ok": False, "error": "User not found"}
    return {"ok": True, "user": _format_user(user)}


@app.post("/api/auth/sync")
def auth_sync(body: AuthSyncRequest):
    uid = _validate_token(body.token)
    if not uid:
        return {"ok": False, "error": "Invalid token"}
    sync_user_data(
        uid=uid,
        xp=body.xp,
        level=body.level,
        streak_days=body.streak_days,
        subjects=body.subjects,
        slider_value=body.slider_value,
        achievements=body.achievements,
        settings=body.settings,
    )
    return {"ok": True}


@app.post("/api/auth/forgot-password")
def auth_forgot_password(email: str = Query(...)):
    user = get_user_by_email(email)
    if not user:
        return {"ok": False, "error": "No account found with that email"}
    uid = user["uid"]
    token, _ = create_password_reset_token(uid)
    sent, msg = send_verification_email(
        email,
        f"reset:{token}",
        user.get("display_name", "User"),
    )
    if not sent:
        return {"ok": False, "error": msg}
    return {"ok": True, "message": "Password reset link sent to your email"}


@app.post("/api/auth/reset-password")
def auth_reset_password(reset_token: str = Query(...), new_password: str = Query(...)):
    if len(new_password) < 4:
        return {"ok": False, "error": "Password must be at least 4 characters"}
    uid = verify_password_reset_token(reset_token)
    if not uid:
        return {"ok": False, "error": "Invalid or expired reset token"}
    ok = update_user_password(uid, hash_password(new_password))
    return {"ok": ok, "error": None}


@app.post("/api/people/export")
def people_export(uid: str = Query(...)):
    data = export_user_data(uid)
    if not data:
        return {"ok": False, "error": "User not found"}
    return {"ok": True, "data": data}


@app.post("/api/people/delete")
def people_delete(uid: str = Query(...)):
    ok = delete_user_account(uid)
    return {"ok": ok}


class FeedbackSubmitRequest(BaseModel):
    uid: str
    feedback_type: str
    target_id: str
    rating: int
    comment: str = ""


@app.post("/api/feedback")
def feedback_submit(body: FeedbackSubmitRequest):
    result = submit_feedback(body.uid, body.feedback_type, body.target_id, body.rating, body.comment)
    return result


@app.get("/api/feedback/stats")
def feedback_stats(feedback_type: str, target_id: str):
    return get_feedback_stats(feedback_type, target_id)


@app.get("/api/feedback/user")
def feedback_user(uid: str, feedback_type: str = ""):
    return {"feedback": get_user_feedback(uid, feedback_type or None)}


@app.get("/api/feedback/top")
def feedback_top(feedback_type: str, limit: int = 20):
    return {"top": get_highest_rated(feedback_type, limit)}


@app.get("/api/admin/stats")
def admin_stats():
    all_uids = get_all_uids()
    return {
        "total_users": len(all_uids),
        "dedup_cache_size": dedup_size(),
        "websocket_online": manager.online_users,
    }


def _format_user(user: dict) -> dict:
    try:
        achievements = json.loads(user.get("achievements", "[]"))
    except:
        achievements = []
    try:
        settings_val = json.loads(user.get("settings", "{}"))
    except:
        settings_val = {}
    return {
        "displayName": user["display_name"],
        "email": user.get("email", ""),
        "photoURL": user.get("avatar_url", ""),
        "uid": user["uid"],
        "xp": user.get("xp", 0),
        "level": user.get("level", 1),
        "streakDays": user.get("streak_days", 0),
        "sliderValue": user.get("slider_value", 50),
        "subjects": user.get("subjects", "").split(",") if user.get("subjects") else [],
        "achievements": achievements,
        "settings": settings_val,
        "hasSeenTutorial": True,
    }


@app.get("/api/health")
def health_check():
    active_providers = []
    if settings.ollama_enabled:
        active_providers.append(f"ollama({settings.ollama_model})")
    if settings.has_groq_key:
        active_providers.append(f"groq({settings.groq_model})")
    if settings.has_gemini_key:
        active_providers.append(f"gemini({settings.gemini_model})")
    if settings.has_nvidia_key:
        active_providers.append(f"nvidia({settings.nvidia_model})")
    if settings.has_openrouter_key:
        active_providers.append(f"openrouter({settings.openrouter_model})")
    if settings.has_together_key:
        active_providers.append(f"together({settings.together_model})")
    if settings.has_huggingface_key:
        active_providers.append(f"huggingface({settings.huggingface_model})")
    if settings.has_cloudflare_key:
        active_providers.append(f"cloudflare({settings.cloudflare_model})")
    return {
        "status": "ok",
        "openai_configured": settings.has_openai_key,
        "ollama_enabled": settings.ollama_enabled,
        "ollama_model": settings.ollama_model,
        "groq_configured": settings.has_groq_key,
        "active_providers": active_providers,
        "provider_chain_order": ["groq", "gemini", "nvidia", "openrouter", "together", "ollama", "huggingface", "cloudflare"],
        "local_index_exists": index_status()["exists"],
        "cache_size": search_cache.size(),
        "dedup_size": dedup_size(),
    }


URL_FILE = Path(__file__).resolve().parent.parent / "public_url.txt"

@app.get("/api/public-url")
def get_public_url():
    if URL_FILE.exists():
        url = URL_FILE.read_text().strip()
        return {"url": url}
    return JSONResponse({"error": "No public URL available"}, status_code=404)


@app.get("/api/download-apk")
def download_apk():
    apk_dir = Path(__file__).resolve().parent.parent
    apk_files = sorted(apk_dir.glob("UniPath-v*.android.apk"), reverse=True)
    if not apk_files:
        apk_files = sorted(apk_dir.glob("*.apk"), reverse=True)
    if apk_files:
        return FileResponse(str(apk_files[0]), media_type="application/vnd.android.package-archive", filename=apk_files[0].name)
    return JSONResponse({"error": "APK not found"}, status_code=404)


if FRONTEND_DIST.exists():
    @app.get("/")
    @app.get("/{path:path}")
    def serve_frontend(path: str = ""):
        if path.startswith("api/") or path.startswith("uploads/") or path.startswith("ws/"):
            return JSONResponse({"error": "Not found"}, status_code=404)
        file = FRONTEND_DIST / "index.html"
        if file.exists():
            return FileResponse(str(file))
        return {"error": "Frontend not built. Run: npx vite build"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", str(settings.server_port)))
    uvicorn.run(app, host=settings.server_host, port=port, log_level="info")
