import re
import sys
import os
import uuid
import shutil
import html
import json
import time
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

from fastapi import FastAPI, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

sys.path.insert(0, str(Path(__file__).resolve().parent))

from pipeline import run_pipeline
from local_index import ask as local_ask, scrape_all, index_status
from search_service import search_nepal, search_nepal_multi
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
    get_uid_by_token,
    delete_auth_token,
    sync_user_data,
    hash_password,
)
from email_service import send_verification_email

app = FastAPI(
    title="UniPath Backend",
    description="Search-then-Extract API for Nepal-focused educational opportunities",
    version="1.0.0",
)

FRONTEND_DIST = Path(__file__).resolve().parent.parent / "dist"
ALLOWED_ORIGINS = os.getenv("CORS_ORIGINS", f"http://localhost:5173,http://localhost:4173,http://127.0.0.1:5173,http://127.0.0.1:4173,app://.,http://localhost:8000,http://127.0.0.1:8000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path(__file__).resolve().parent / "uploads"
AVATAR_DIR = UPLOAD_DIR / "avatars"
CHAT_IMG_DIR = UPLOAD_DIR / "chat"
AVATAR_DIR.mkdir(parents=True, exist_ok=True)
CHAT_IMG_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="frontend_assets")


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
    if not _check_rate_limit("search", 15):
        return SearchResponse(query=q, error="Rate limit exceeded. Please wait.")
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
    if not _check_rate_limit("chat", 15):
        return ChatResponse(query=body.query, error="Rate limit exceeded. Please wait.")
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
    registrationDeadline: str = ""
    cost: str = ""
    eligibility: str = ""
    skills: str = ""


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
_OPP_CATEGORIES = [
    ("Volunteering", "\U0001f9f3", ["volunteer", "volunteering", "community service", "social work", "sewa"]),
    ("Workshop", "\U0001f528", ["workshop", "training", "bootcamp", "skill", "hands-on", "learn"]),
    ("Competition", "\U0001f3c6", ["competition", "hackathon", "contest", "olympiad", "challenge"]),
    ("Scholarship", "\U0001f393", ["scholarship", "fellowship", "grant", "funding", "financial aid"]),
    ("Internship", "\U0001f4bc", ["internship", "intern", "trainee", "apprenticeship"]),
    ("Conference", "\U0001f30d", ["conference", "seminar", "summit", "symposium", "student event"]),
]


def _classify_opportunity(title: str, snippet: str) -> tuple[str, str]:
    text = (title + " " + snippet).lower()
    for label, icon, keywords in _OPP_CATEGORIES:
        if any(kw in text for kw in keywords):
            return label, icon
    return "Opportunity", "\U0001f30d"


_SKIP_PATTERNS = re.compile(
    r"(top\s+\d+|best\s+colleges?|ranking|admission\s+open|"
    r"university\s+review|college\s+review|syllabus|"
    r"entrance\s+exam|result|grade\s+sheet|"
    r"[\u0400-\u04FF])",
    re.IGNORECASE,
)


def _extract_deadline(text: str) -> str:
    m = re.search(
        r"(?:deadline|apply\s*(?:before|by)|last\s*date|registration\s*(?:closes?|ends?|deadline))\s*:?\s*"
        r"(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2}|"
        r"(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s*\d{4})",
        text, re.IGNORECASE,
    )
    return m.group(1) if m else ""


def _extract_cost(text: str) -> str:
    m = re.search(r"(?:free|cost|fee|price|ticket|npr\s*[\d,]+|rs\s*[\d,]+|\$\s*[\d,]+)", text, re.IGNORECASE)
    if not m:
        return ""
    val = m.group(0)
    if val.lower() == "free":
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


def _is_relevant(title: str, snippet: str, query_parts: list[str]) -> bool:
    text = (title + " " + snippet).lower()
    if _SKIP_PATTERNS.search(text):
        return False
    if not any(kw in text for kw in _NEPAL_KEYWORDS):
        return False
    if query_parts and not any(kw.lower() in text for kw in query_parts):
        return False
    return True


@app.get("/api/discover")
def discover_endpoint(
    subjects: str = Query("", description="Comma-separated subjects"),
    limit: int = Query(40, ge=1, le=60),
    type: str = Query("", description="Filter: volunteering, workshop, competition, scholarship, internship, conference"),
    location: str = Query("", description="City or region in Nepal"),
    date_from: str = Query("", description="Posted after YYYY-MM-DD"),
):
    if not _check_rate_limit("discover", 10):
        return {"opportunities": [], "error": "Rate limit exceeded. Please wait."}
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

            if not title or title.lower() in seen_titles:
                continue
            if not _is_relevant(title, snippet, query_parts):
                continue

            seen_titles.add(title.lower())
            freshness = _score_result_freshness(title, snippet)
            if freshness < 10:
                continue

            matched_kw = sum(1 for kw in query_parts if kw.lower() in (title + snippet).lower())
            match_pct = min(98, freshness + matched_kw * 5 + 5)

            category, icon = _classify_opportunity(title, snippet)

            if type_filter and category.lower() != type_filter:
                continue
            if location_filter and location_filter.lower() not in (title + snippet).lower():
                continue

            extracted = f"{title} {snippet}"
            deadline = _extract_deadline(extracted)
            cost = _extract_cost(extracted)
            eligibility = _extract_eligibility(extracted)
            skills = _extract_skills(extracted)

            opp_id += 1
            all_opps.append((
                freshness,
                DiscoveredOpportunity(
                    id=opp_id,
                    title=title,
                    description=snippet or "No description available.",
                    tags=[category] + [p.capitalize() for p in query_parts[:2]],
                    organization=r.source_site or "Unknown",
                    applyUrl=r.url or "",
                    matchPercentage=match_pct,
                    registrationDeadline=deadline,
                    cost=cost,
                    eligibility=eligibility,
                    skills=skills,
                ),
            ))

    all_opps.sort(key=lambda x: -x[0])
    opportunities = [o for _, o in all_opps[:20]]

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


@app.post("/api/upload/avatar")
async def upload_avatar(uid: str = Query(...), file: UploadFile = File(...)):
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


_RATE_LIMIT_WINDOW = 10
_rate_log: dict[str, list[float]] = {}

def _check_rate_limit(key: str, max_calls: int = 20) -> bool:
    now = time.time()
    window = _RATE_LIMIT_WINDOW
    if key not in _rate_log:
        _rate_log[key] = []
    _rate_log[key] = [t for t in _rate_log[key] if now - t < window]
    if len(_rate_log[key]) >= max_calls:
        return False
    _rate_log[key].append(now)
    return True

def _sanitize(text: str) -> str:
    return html.escape(text.strip(), quote=True)

@app.post("/api/chat/send")
def chat_send(body: SendMessageRequest):
    if not body.image_url and not body.content.strip():
        return {"ok": False, "error": "Message cannot be empty"}
    if not _check_rate_limit(f"chat:{body.from_uid}", 30):
        return {"ok": False, "error": "Too many messages. Slow down."}
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
    init_people = False
    try:
        from pipeline import init_people_user as ipu
        ipu(body.uid, body.display_name, body.uid)
        init_people = True
    except:
        pass
    token = create_auth_token(body.uid)
    user = get_user(body.uid)
    return {"ok": True, "token": token, "user": _format_user(user)}


@app.post("/api/auth/login")
def auth_login(body: AuthLoginRequest):
    user = authenticate(body.uid, body.password)
    if not user:
        return {"ok": False, "error": "Invalid username or password"}
    token = create_auth_token(body.uid)
    return {"ok": True, "token": token, "user": _format_user(user)}


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
    return {
        "status": "ok",
        "openai_configured": settings.has_openai_key,
        "ollama_enabled": settings.ollama_enabled,
        "ollama_model": settings.ollama_model,
        "local_index_exists": index_status()["exists"],
    }


if FRONTEND_DIST.exists():
    @app.get("/")
    @app.get("/{path:path}")
    def serve_frontend(path: str = ""):
        if path.startswith("api/") or path.startswith("uploads/"):
            from fastapi.responses import JSONResponse
            return JSONResponse({"error": "Not found"}, status_code=404)
        file = FRONTEND_DIST / "index.html"
        if file.exists():
            return FileResponse(str(file))
        return {"error": "Frontend not built. Run: npx vite build"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, log_level="info")
