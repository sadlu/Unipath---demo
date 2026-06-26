import os
import random
import string
import hashlib
import secrets
import json
from datetime import datetime, timezone
from pathlib import Path
from contextlib import contextmanager
from typing import Optional

DATABASE_URL = os.environ.get("DATABASE_URL", "")

if DATABASE_URL:
    import psycopg2
    import psycopg2.extras

    _is_pg = True

    def _sql(sql: str) -> str:
        return sql.replace("?", "%s").replace("datetime('now')", "NOW()")

    def get_conn():
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = False
        return conn

    def _execute(conn, sql: str, params=()):
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(_sql(sql), params)
        return cur

    def _ensure_str(val):
        if isinstance(val, memoryview):
            return bytes(val).decode()
        if isinstance(val, bytes):
            return val.decode()
        return val

    def _row_as_dict(row) -> Optional[dict]:
        if row is None:
            return None
        return {k: _ensure_str(v) for k, v in row.items()}

    def _rows_as_list(rows) -> list[dict]:
        return [_row_as_dict(r) for r in rows]

    def _migrate_add_auth(conn):
        cur = conn.cursor()
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'")
        cols = [r[0] for r in cur.fetchall()]
        for col, typ in [("password_hash", "TEXT DEFAULT ''"), ("streak_days", "INTEGER DEFAULT 0"), ("slider_value", "INTEGER DEFAULT 50"), ("achievements", "TEXT DEFAULT '[]'"), ("settings", "TEXT DEFAULT '{}'")]:
            if col not in cols:
                conn.execute(_sql(f"ALTER TABLE users ADD COLUMN {col} {typ}"))

    def _migrate_add_token_expires_at(conn):
        cur = conn.cursor()
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'auth_tokens' AND column_name = 'expires_at'")
        if not cur.fetchone():
            conn.execute("ALTER TABLE auth_tokens ADD COLUMN expires_at TEXT DEFAULT ''")
        cur.execute("SELECT table_name FROM information_schema.tables WHERE table_name = 'refresh_tokens'")
        if not cur.fetchone():
            conn.execute("""
                CREATE TABLE IF NOT EXISTS refresh_tokens (
                    token TEXT PRIMARY KEY,
                    uid TEXT NOT NULL,
                    created_at TEXT DEFAULT NOW(),
                    expires_at TEXT DEFAULT '',
                    FOREIGN KEY (uid) REFERENCES users(uid)
                )
            """)

    def init_db():
        with get_conn() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    uid TEXT PRIMARY KEY,
                    display_name TEXT NOT NULL,
                    email TEXT DEFAULT '',
                    email_verified INTEGER DEFAULT 0,
                    avatar_url TEXT DEFAULT '',
                    bio TEXT DEFAULT '',
                    subjects TEXT DEFAULT '',
                    xp INTEGER DEFAULT 0,
                    level INTEGER DEFAULT 1,
                    last_seen TEXT DEFAULT '',
                    created_at TEXT DEFAULT NOW()
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS email_verifications (
                    email TEXT PRIMARY KEY,
                    code TEXT NOT NULL,
                    created_at TEXT DEFAULT NOW()
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS messages (
                    id SERIAL PRIMARY KEY,
                    from_uid TEXT NOT NULL,
                    to_uid TEXT NOT NULL,
                    content TEXT NOT NULL,
                    image_url TEXT DEFAULT '',
                    created_at TEXT DEFAULT NOW(),
                    read INTEGER DEFAULT 0,
                    FOREIGN KEY (from_uid) REFERENCES users(uid),
                    FOREIGN KEY (to_uid) REFERENCES users(uid)
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_messages_from ON messages(from_uid)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_uid)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(from_uid, to_uid)")
            conn.execute("""
                CREATE TABLE IF NOT EXISTS follows (
                    follower_uid TEXT NOT NULL,
                    following_uid TEXT NOT NULL,
                    created_at TEXT DEFAULT NOW(),
                    PRIMARY KEY (follower_uid, following_uid),
                    FOREIGN KEY (follower_uid) REFERENCES users(uid),
                    FOREIGN KEY (following_uid) REFERENCES users(uid)
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS auth_tokens (
                    token TEXT PRIMARY KEY,
                    uid TEXT NOT NULL,
                    created_at TEXT DEFAULT NOW(),
                    expires_at TEXT DEFAULT '',
                    FOREIGN KEY (uid) REFERENCES users(uid)
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS refresh_tokens (
                    token TEXT PRIMARY KEY,
                    uid TEXT NOT NULL,
                    created_at TEXT DEFAULT NOW(),
                    expires_at TEXT DEFAULT '',
                    FOREIGN KEY (uid) REFERENCES users(uid)
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS password_resets (
                    token TEXT PRIMARY KEY,
                    uid TEXT NOT NULL,
                    created_at TEXT DEFAULT NOW(),
                    expires_at TEXT DEFAULT '',
                    used INTEGER DEFAULT 0,
                    FOREIGN KEY (uid) REFERENCES users(uid)
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS feedback (
                    id SERIAL PRIMARY KEY,
                    uid TEXT NOT NULL,
                    feedback_type TEXT NOT NULL,
                    target_id TEXT NOT NULL,
                    rating INTEGER NOT NULL CHECK(rating IN (1, -1)),
                    comment TEXT DEFAULT '',
                    created_at TEXT DEFAULT NOW()
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_feedback_type_target ON feedback(feedback_type, target_id)")
            conn.commit()
            _migrate_add_auth(conn)
            _migrate_add_token_expires_at(conn)
            conn.commit()

    @contextmanager
    def get_db():
        conn = get_conn()
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

else:
    import sqlite3

    _is_pg = False
    _data_dir = os.environ.get("UNIPATH_DATA_DIR")
    if _data_dir:
        DB_PATH = Path(_data_dir) / "unipath.db"
    else:
        DB_PATH = Path(__file__).resolve().parent / "unipath.db"

    def get_conn() -> sqlite3.Connection:
        conn = sqlite3.connect(str(DB_PATH))
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        return conn

    def _sql(sql: str) -> str:
        return sql

    def _execute(conn, sql: str, params=()):
        return conn.execute(sql, params)

    def _row_as_dict(row) -> Optional[dict]:
        if row is None:
            return None
        return dict(row)

    def _rows_as_list(rows) -> list[dict]:
        return [dict(r) for r in rows]

    def _migrate_add_auth(conn):
        cur = conn.execute("PRAGMA table_info(users)")
        cols = [r["name"] for r in cur.fetchall()]
        for col, typ in [("password_hash", "TEXT DEFAULT ''"), ("streak_days", "INTEGER DEFAULT 0"), ("slider_value", "INTEGER DEFAULT 50"), ("achievements", "TEXT DEFAULT '[]'"), ("settings", "TEXT DEFAULT '{}'")]:
            if col not in cols:
                conn.execute(f"ALTER TABLE users ADD COLUMN {col} {typ}")

    def _migrate_add_token_expires_at(conn):
        cur = conn.execute("PRAGMA table_info(auth_tokens)")
        cols = [r["name"] for r in cur.fetchall()]
        if "expires_at" not in cols:
            conn.execute("ALTER TABLE auth_tokens ADD COLUMN expires_at TEXT DEFAULT ''")
        cur = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='refresh_tokens'")
        if not cur.fetchone():
            conn.execute("""
                CREATE TABLE refresh_tokens (
                    token TEXT PRIMARY KEY,
                    uid TEXT NOT NULL,
                    created_at TEXT DEFAULT (datetime('now')),
                    expires_at TEXT DEFAULT '',
                    FOREIGN KEY (uid) REFERENCES users(uid)
                )
            """)

    def _migrate_add_reset_tokens(conn):
        cur = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='password_resets'")
        if not cur.fetchone():
            conn.execute("""
                CREATE TABLE password_resets (
                    token TEXT PRIMARY KEY,
                    uid TEXT NOT NULL,
                    created_at TEXT DEFAULT (datetime('now')),
                    expires_at TEXT DEFAULT '',
                    used INTEGER DEFAULT 0,
                    FOREIGN KEY (uid) REFERENCES users(uid)
                )
            """)

    def _migrate_add_feedback(conn):
        cur = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='feedback'")
        if not cur.fetchone():
            conn.execute("""
                CREATE TABLE feedback (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    uid TEXT NOT NULL,
                    feedback_type TEXT NOT NULL,
                    target_id TEXT NOT NULL,
                    rating INTEGER NOT NULL CHECK(rating IN (1, -1)),
                    comment TEXT DEFAULT '',
                    created_at TEXT DEFAULT (datetime('now'))
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_feedback_type_target ON feedback(feedback_type, target_id)")

    def init_db():
        with get_conn() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS users (
                    uid TEXT PRIMARY KEY,
                    display_name TEXT NOT NULL,
                    email TEXT DEFAULT '',
                    email_verified INTEGER DEFAULT 0,
                    avatar_url TEXT DEFAULT '',
                    bio TEXT DEFAULT '',
                    subjects TEXT DEFAULT '',
                    xp INTEGER DEFAULT 0,
                    level INTEGER DEFAULT 1,
                    last_seen TEXT DEFAULT '',
                    created_at TEXT DEFAULT (datetime('now'))
                );
                CREATE TABLE IF NOT EXISTS email_verifications (
                    email TEXT PRIMARY KEY,
                    code TEXT NOT NULL,
                    created_at TEXT DEFAULT (datetime('now'))
                );
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    from_uid TEXT NOT NULL,
                    to_uid TEXT NOT NULL,
                    content TEXT NOT NULL,
                    image_url TEXT DEFAULT '',
                    created_at TEXT DEFAULT (datetime('now')),
                    read INTEGER DEFAULT 0,
                    FOREIGN KEY (from_uid) REFERENCES users(uid),
                    FOREIGN KEY (to_uid) REFERENCES users(uid)
                );
                CREATE INDEX IF NOT EXISTS idx_messages_from ON messages(from_uid);
                CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_uid);
                CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(from_uid, to_uid);
                CREATE TABLE IF NOT EXISTS follows (
                    follower_uid TEXT NOT NULL,
                    following_uid TEXT NOT NULL,
                    created_at TEXT DEFAULT (datetime('now')),
                    PRIMARY KEY (follower_uid, following_uid),
                    FOREIGN KEY (follower_uid) REFERENCES users(uid),
                    FOREIGN KEY (following_uid) REFERENCES users(uid)
                );
                CREATE TABLE IF NOT EXISTS auth_tokens (
                    token TEXT PRIMARY KEY,
                    uid TEXT NOT NULL,
                    created_at TEXT DEFAULT (datetime('now')),
                    expires_at TEXT DEFAULT '',
                    FOREIGN KEY (uid) REFERENCES users(uid)
                );
                CREATE TABLE IF NOT EXISTS refresh_tokens (
                    token TEXT PRIMARY KEY,
                    uid TEXT NOT NULL,
                    created_at TEXT DEFAULT (datetime('now')),
                    expires_at TEXT DEFAULT '',
                    FOREIGN KEY (uid) REFERENCES users(uid)
                );
            """)
            _check_image_url_col(conn)
            _check_bio_col(conn)
            _check_subjects_col(conn)
            _migrate_add_auth(conn)
            _migrate_add_token_expires_at(conn)
            _migrate_add_reset_tokens(conn)
            _migrate_add_feedback(conn)

    def _check_image_url_col(conn):
        cur = conn.execute("PRAGMA table_info(messages)")
        cols = [r["name"] for r in cur.fetchall()]
        if "image_url" not in cols:
            conn.execute("ALTER TABLE messages ADD COLUMN image_url TEXT DEFAULT ''")

    def _check_bio_col(conn):
        cur = conn.execute("PRAGMA table_info(users)")
        cols = [r["name"] for r in cur.fetchall()]
        if "bio" not in cols:
            conn.execute("ALTER TABLE users ADD COLUMN bio TEXT DEFAULT ''")

    def _check_subjects_col(conn):
        cur = conn.execute("PRAGMA table_info(users)")
        cols = [r["name"] for r in cur.fetchall()]
        if "subjects" not in cols:
            conn.execute("ALTER TABLE users ADD COLUMN subjects TEXT DEFAULT ''")

    @contextmanager
    def get_db():
        conn = get_conn()
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()


def hash_password(password: str) -> str:
    try:
        import bcrypt
        salt = bcrypt.gensalt(rounds=12)
        return bcrypt.hashpw(password.encode(), salt).decode()
    except ImportError:
        salt = secrets.token_hex(16)
        h = hashlib.sha256((salt + password).encode()).hexdigest()
        return f"sha256:{salt}:{h}"


def verify_password(password: str, stored: str) -> bool:
    if stored.startswith("$2b$") or stored.startswith("$2a$"):
        try:
            import bcrypt
            return bcrypt.checkpw(password.encode(), stored.encode())
        except ImportError:
            return False
    if stored.startswith("sha256:"):
        parts = stored.split(":", 2)
        if len(parts) != 3:
            return False
        _, salt, expected = parts
        h = hashlib.sha256((salt + password).encode()).hexdigest()
        return h == expected
    return False


def upsert_user(uid: str, display_name: str, email: str = "", avatar_url: str = ""):
    with get_db() as conn:
        cur = _execute(conn, "SELECT uid FROM users WHERE uid = ?", (uid,))
        if cur.fetchone():
            _execute(conn, "UPDATE users SET display_name = ?, last_seen = datetime('now') WHERE uid = ?", (display_name, uid))
        else:
            _execute(conn, "INSERT INTO users (uid, display_name, email, avatar_url, last_seen) VALUES (?, ?, ?, ?, datetime('now'))", (uid, display_name, email, avatar_url))


def get_user(uid: str) -> Optional[dict]:
    with get_db() as conn:
        cur = _execute(conn, "SELECT * FROM users WHERE uid = ?", (uid,))
        return _row_as_dict(cur.fetchone())


def get_user_by_email(email: str) -> Optional[dict]:
    with get_db() as conn:
        cur = _execute(conn, "SELECT * FROM users WHERE email = ?", (email,))
        return _row_as_dict(cur.fetchone())


def search_users(query: str, exclude_uid: str = "", limit: int = 20) -> list[dict]:
    with get_db() as conn:
        like = f"%{query}%"
        params: list = [like, like]
        exclude_clause = ""
        if exclude_uid:
            exclude_clause = "AND uid != ?"
            params.append(exclude_uid)
        params.append(limit)
        cur = _execute(conn, f"SELECT * FROM users WHERE (display_name LIKE ? OR email LIKE ?) {exclude_clause} ORDER BY last_seen DESC LIMIT ?", params)
        return _rows_as_list(cur.fetchall())


def create_verification_code(email: str) -> str:
    code = "".join(random.choices(string.digits, k=6))
    with get_db() as conn:
        if _is_pg:
            _execute(conn, "INSERT INTO email_verifications (email, code, created_at) VALUES (?, ?, datetime('now')) ON CONFLICT (email) DO UPDATE SET code = ?, created_at = datetime('now')", (email, code, code))
        else:
            _execute(conn, "INSERT OR REPLACE INTO email_verifications (email, code, created_at) VALUES (?, ?, datetime('now'))", (email, code))
    return code


def verify_code(email: str, code: str) -> bool:
    with get_db() as conn:
        cur = _execute(conn, "SELECT code, created_at FROM email_verifications WHERE email = ?", (email,))
        row = cur.fetchone()
        if not row or row["code"] != code:
            return False
        _execute(conn, "DELETE FROM email_verifications WHERE email = ?", (email,))
        try:
            created = row["created_at"]
            if isinstance(created, str):
                created = datetime.fromisoformat(created.replace("Z", "+00:00"))
            if (datetime.now(timezone.utc) - created).total_seconds() > 900:
                return False
        except (ValueError, TypeError):
            return False
        return True


def cleanup_expired_verifications():
    with get_db() as conn:
        if _is_pg:
            _execute(conn, "DELETE FROM email_verifications WHERE created_at < NOW() - INTERVAL '15 minutes'")
        else:
            _execute(conn, "DELETE FROM email_verifications WHERE created_at < datetime('now', '-15 minutes')")


def send_message(from_uid: str, to_uid: str, content: str, image_url: str = "") -> dict:
    with get_db() as conn:
        if _is_pg:
            cur = _execute(conn, "INSERT INTO messages (from_uid, to_uid, content, image_url) VALUES (?, ?, ?, ?) RETURNING *", (from_uid, to_uid, content, image_url))
            return _row_as_dict(cur.fetchone())
        else:
            cur = _execute(conn, "INSERT INTO messages (from_uid, to_uid, content, image_url) VALUES (?, ?, ?, ?)", (from_uid, to_uid, content, image_url))
            cur = _execute(conn, "SELECT * FROM messages WHERE id = ?", (cur.lastrowid,))
            return _row_as_dict(cur.fetchone())


def get_conversations(uid: str) -> list[dict]:
    with get_db() as conn:
        cur = _execute(conn,
            "SELECT DISTINCT CASE WHEN from_uid = ? THEN to_uid ELSE from_uid END AS other_uid FROM messages WHERE from_uid = ? OR to_uid = ?",
            (uid, uid, uid),
        )
        other_uids = [r["other_uid"] for r in cur.fetchall() if r["other_uid"]]
        convos = []
        for other_uid in other_uids:
            cur = _execute(conn,
                "SELECT content, created_at FROM messages WHERE (from_uid = ? AND to_uid = ?) OR (from_uid = ? AND to_uid = ?) ORDER BY created_at DESC LIMIT 1",
                (uid, other_uid, other_uid, uid),
            )
            last_row = cur.fetchone()
            cur = _execute(conn, "SELECT COUNT(*) AS cnt FROM messages WHERE to_uid = ? AND from_uid = ? AND read = 0", (uid, other_uid))
            unread = _row_as_dict(cur.fetchone())["cnt"]
            user = get_user(other_uid)
            convos.append({
                "other_uid": other_uid,
                "last_message": last_row["content"] if last_row else "",
                "last_time": last_row["created_at"] if last_row else "",
                "unread": unread,
                "display_name": user["display_name"] if user else other_uid,
                "email": user.get("email", "") if user else "",
                "other_verified": bool(user.get("email_verified")) if user else False,
            })
        convos.sort(key=lambda c: c["last_time"], reverse=True)
        return convos


def get_messages(uid_a: str, uid_b: str, limit: int = 50) -> list[dict]:
    with get_db() as conn:
        cur = _execute(conn,
            "SELECT * FROM messages WHERE (from_uid = ? AND to_uid = ?) OR (from_uid = ? AND to_uid = ?) ORDER BY created_at ASC LIMIT ?",
            (uid_a, uid_b, uid_b, uid_a, limit),
        )
        rows = _rows_as_list(cur.fetchall())
        _execute(conn, "UPDATE messages SET read = 1 WHERE to_uid = ? AND from_uid = ? AND read = 0", (uid_a, uid_b))
        return rows


def _get_affected_count(conn, cur) -> int:
    return cur.rowcount


def follow_user(follower_uid: str, following_uid: str) -> bool:
    if follower_uid == following_uid:
        return False
    with get_db() as conn:
        try:
            if _is_pg:
                cur = _execute(conn, "INSERT INTO follows (follower_uid, following_uid) VALUES (?, ?) ON CONFLICT DO NOTHING", (follower_uid, following_uid))
            else:
                cur = _execute(conn, "INSERT OR IGNORE INTO follows (follower_uid, following_uid) VALUES (?, ?)", (follower_uid, following_uid))
            return _get_affected_count(conn, cur) > 0
        except Exception:
            return False


def unfollow_user(follower_uid: str, following_uid: str) -> bool:
    with get_db() as conn:
        cur = _execute(conn, "DELETE FROM follows WHERE follower_uid = ? AND following_uid = ?", (follower_uid, following_uid))
        return _get_affected_count(conn, cur) > 0


def get_following(uid: str) -> list[str]:
    with get_db() as conn:
        cur = _execute(conn, "SELECT following_uid FROM follows WHERE follower_uid = ? ORDER BY created_at DESC", (uid,))
        return [r["following_uid"] for r in cur.fetchall()]


def get_followers(uid: str) -> list[str]:
    with get_db() as conn:
        cur = _execute(conn, "SELECT follower_uid FROM follows WHERE following_uid = ? ORDER BY created_at DESC", (uid,))
        return [r["follower_uid"] for r in cur.fetchall()]


def is_following(follower_uid: str, following_uid: str) -> bool:
    with get_db() as conn:
        cur = _execute(conn, "SELECT 1 FROM follows WHERE follower_uid = ? AND following_uid = ?", (follower_uid, following_uid))
        return cur.fetchone() is not None


def update_user_profile(uid: str, display_name: Optional[str] = None, avatar_url: Optional[str] = None, bio: Optional[str] = None) -> bool:
    fields = []
    params: list = []
    if display_name is not None:
        fields.append("display_name = ?")
        params.append(display_name)
    if avatar_url is not None:
        fields.append("avatar_url = ?")
        params.append(avatar_url)
    if bio is not None:
        fields.append("bio = ?")
        params.append(bio)
    if not fields:
        return False
    params.append(uid)
    with get_db() as conn:
        cur = _execute(conn, f"UPDATE users SET {', '.join(fields)} WHERE uid = ?", params)
        return _get_affected_count(conn, cur) > 0


def update_user_password(uid: str, new_password_hash: str) -> bool:
    with get_db() as conn:
        cur = _execute(conn, "UPDATE users SET password_hash = ? WHERE uid = ?", (new_password_hash, uid))
        return _get_affected_count(conn, cur) > 0


def create_auth_token(uid: str) -> str:
    token = secrets.token_hex(32)
    with get_db() as conn:
        _execute(conn, "INSERT INTO auth_tokens (token, uid, expires_at) VALUES (?, ?, datetime('now', '+1 day'))", (token, uid))
    return token


def create_auth_token_pair(uid: str) -> tuple[str, str]:
    access = secrets.token_hex(32)
    refresh = secrets.token_hex(32)
    with get_db() as conn:
        _execute(conn, "INSERT INTO auth_tokens (token, uid, expires_at) VALUES (?, ?, datetime('now', '+1 day'))", (access, uid))
        _execute(conn, "INSERT INTO refresh_tokens (token, uid, expires_at) VALUES (?, ?, datetime('now', '+30 days'))", (refresh, uid))
    return access, refresh


def _parse_expiry(expires: str) -> Optional[datetime]:
    try:
        dt = datetime.fromisoformat(expires.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (ValueError, TypeError):
        return None


def get_uid_by_token(token: str) -> Optional[str]:
    with get_db() as conn:
        cur = _execute(conn, "SELECT uid, expires_at FROM auth_tokens WHERE token = ?", (token,))
        row = cur.fetchone()
        if not row:
            return None
        expires_raw = row["expires_at"]
        if not expires_raw:
            return None
        expires = _parse_expiry(expires_raw)
        if expires is None:
            _execute(conn, "DELETE FROM auth_tokens WHERE token = ?", (token,))
            return None
        if datetime.now(timezone.utc) > expires:
            _execute(conn, "DELETE FROM auth_tokens WHERE token = ?", (token,))
            return None
        return row["uid"]


def refresh_auth_token(refresh_token: str) -> Optional[tuple[str, str]]:
    with get_db() as conn:
        cur = _execute(conn, "SELECT uid, expires_at FROM refresh_tokens WHERE token = ?", (refresh_token,))
        row = cur.fetchone()
        if not row:
            return None
        expires_raw = row["expires_at"]
        if not expires_raw:
            return None
        expires = _parse_expiry(expires_raw)
        if expires is None or datetime.now(timezone.utc) > expires:
            _execute(conn, "DELETE FROM refresh_tokens WHERE token = ?", (refresh_token,))
            return None
        uid = row["uid"]
        _execute(conn, "DELETE FROM refresh_tokens WHERE token = ?", (refresh_token,))
    access, new_refresh = create_auth_token_pair(uid)
    return access, new_refresh


def delete_auth_token(token: str):
    with get_db() as conn:
        _execute(conn, "DELETE FROM auth_tokens WHERE token = ?", (token,))


def create_account(uid: str, display_name: str, password: str, subjects: Optional[list[str]] = None) -> dict:
    pwh = hash_password(password)
    subj_str = ",".join(subjects) if subjects else ""
    with get_db() as conn:
        _execute(conn, "INSERT INTO users (uid, display_name, password_hash, subjects, streak_days, last_seen) VALUES (?, ?, ?, ?, 0, datetime('now'))", (uid, display_name, pwh, subj_str))
    return get_user(uid)


def authenticate(uid: str, password: str) -> Optional[dict]:
    user = get_user(uid)
    if not user:
        return None
    stored = user.get("password_hash", "")
    if not stored or not verify_password(password, stored):
        return None
    with get_db() as conn:
        _execute(conn, "UPDATE users SET last_seen = datetime('now') WHERE uid = ?", (uid,))
    return user


def sync_user_data(uid: str, xp: Optional[int] = None, level: Optional[int] = None, streak_days: Optional[int] = None, subjects: Optional[list[str]] = None, slider_value: Optional[int] = None, achievements: Optional[list[str]] = None, settings: Optional[dict] = None):
    fields = []
    params: list = []
    if xp is not None:
        fields.append("xp = ?")
        params.append(xp)
    if level is not None:
        fields.append("level = ?")
        params.append(level)
    if streak_days is not None:
        fields.append("streak_days = ?")
        params.append(streak_days)
    if subjects is not None:
        fields.append("subjects = ?")
        params.append(",".join(subjects))
    if slider_value is not None:
        fields.append("slider_value = ?")
        params.append(slider_value)
    if achievements is not None:
        fields.append("achievements = ?")
        params.append(json.dumps(achievements))
    if settings is not None:
        fields.append("settings = ?")
        params.append(json.dumps(settings))
    if not fields:
        return
    fields.append("last_seen = datetime('now')")
    params.append(uid)
    with get_db() as conn:
        _execute(conn, f"UPDATE users SET {', '.join(fields)} WHERE uid = ?", params)


def check_pending_email(uid: str) -> Optional[str]:
    user = get_user(uid)
    if user and user["email"] and not user["email_verified"]:
        return user["email"]
    return None


def create_password_reset_token(uid: str) -> tuple[str, str]:
    token = secrets.token_hex(32)
    with get_db() as conn:
        _execute(conn, "INSERT INTO password_resets (token, uid, expires_at) VALUES (?, ?, datetime('now', '+1 hour'))", (token, uid))
    return token, uid


def verify_password_reset_token(token: str) -> Optional[str]:
    with get_db() as conn:
        cur = _execute(conn, "SELECT uid, expires_at, used FROM password_resets WHERE token = ?", (token,))
        row = cur.fetchone()
        if not row:
            return None
        if row.get("used"):
            return None
        expires_raw = row["expires_at"]
        if not expires_raw:
            return None
        expires = _parse_expiry(expires_raw)
        if expires is None or datetime.now(timezone.utc) > expires:
            _execute(conn, "DELETE FROM password_resets WHERE token = ?", (token,))
            return None
        _execute(conn, "UPDATE password_resets SET used = 1 WHERE token = ?", (token,))
        return row["uid"]


def delete_user_account(uid: str) -> bool:
    with get_db() as conn:
        _execute(conn, "DELETE FROM messages WHERE from_uid = ? OR to_uid = ?", (uid, uid))
        _execute(conn, "DELETE FROM follows WHERE follower_uid = ? OR following_uid = ?", (uid, uid))
        _execute(conn, "DELETE FROM auth_tokens WHERE uid = ?", (uid,))
        _execute(conn, "DELETE FROM refresh_tokens WHERE uid = ?", (uid,))
        _execute(conn, "DELETE FROM feedback WHERE uid = ?", (uid,))
        _execute(conn, "DELETE FROM password_resets WHERE uid = ?", (uid,))
        _execute(conn, "DELETE FROM email_verifications WHERE email IN (SELECT email FROM users WHERE uid = ?)", (uid,))
        _execute(conn, "DELETE FROM users WHERE uid = ?", (uid,))
    return True


def export_user_data(uid: str) -> Optional[dict]:
    user = get_user(uid)
    if not user:
        return None
    with get_db() as conn:
        cur = _execute(conn, "SELECT * FROM messages WHERE from_uid = ? OR to_uid = ? ORDER BY created_at ASC", (uid, uid))
        messages = _rows_as_list(cur.fetchall())
        cur = _execute(conn, "SELECT * FROM feedback WHERE uid = ? ORDER BY created_at ASC", (uid,))
        feedback = _rows_as_list(cur.fetchall())
        cur = _execute(conn, "SELECT following_uid FROM follows WHERE follower_uid = ?", (uid,))
        following = [r["following_uid"] for r in cur.fetchall()]
        cur = _execute(conn, "SELECT follower_uid FROM follows WHERE following_uid = ?", (uid,))
        followers = [r["follower_uid"] for r in cur.fetchall()]
    return {
        "user": dict(user),
        "messages": messages,
        "feedback": feedback,
        "following": following,
        "followers": followers,
    }


def get_all_uids() -> list[str]:
    with get_db() as conn:
        cur = _execute(conn, "SELECT uid FROM users ORDER BY uid")
        return [r["uid"] for r in cur.fetchall()]
