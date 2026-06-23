import sqlite3
import os
import random
import string
from datetime import datetime, timezone
from pathlib import Path
from contextlib import contextmanager

DB_PATH = Path(__file__).resolve().parent / "unipath.db"


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    with get_conn() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                uid TEXT PRIMARY KEY,
                display_name TEXT NOT NULL,
                email TEXT DEFAULT '',
                email_verified INTEGER DEFAULT 0,
                avatar_url TEXT DEFAULT '',
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
        """)


@contextmanager
def get_db():
    conn = get_conn()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def upsert_user(uid: str, display_name: str, email: str = "", avatar_url: str = ""):
    with get_db() as conn:
        cur = conn.execute("SELECT uid FROM users WHERE uid = ?", (uid,))
        if cur.fetchone():
            conn.execute(
                "UPDATE users SET display_name = ?, last_seen = datetime('now') WHERE uid = ?",
                (display_name, uid),
            )
        else:
            conn.execute(
                "INSERT INTO users (uid, display_name, email, avatar_url, last_seen) VALUES (?, ?, ?, ?, datetime('now'))",
                (uid, display_name, email, avatar_url),
            )


def get_user(uid: str) -> dict | None:
    with get_db() as conn:
        cur = conn.execute("SELECT * FROM users WHERE uid = ?", (uid,))
        row = cur.fetchone()
        if row:
            return dict(row)
        return None


def get_user_by_email(email: str) -> dict | None:
    with get_db() as conn:
        cur = conn.execute("SELECT * FROM users WHERE email = ?", (email,))
        row = cur.fetchone()
        if row:
            return dict(row)
        return None


def search_users(query: str, exclude_uid: str = "", limit: int = 20) -> list[dict]:
    with get_db() as conn:
        like = f"%{query}%"
        params = [like, like]
        exclude_clause = ""
        if exclude_uid:
            exclude_clause = "AND uid != ?"
            params.append(exclude_uid)
        cur = conn.execute(
            f"SELECT * FROM users WHERE (display_name LIKE ? OR email LIKE ?) {exclude_clause} ORDER BY last_seen DESC LIMIT ?",
            (*params, limit),
        )
        return [dict(r) for r in cur.fetchall()]


def create_verification_code(email: str) -> str:
    code = "".join(random.choices(string.digits, k=6))
    with get_db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO email_verifications (email, code, created_at) VALUES (?, ?, datetime('now'))",
            (email, code),
        )
    return code


def verify_code(email: str, code: str) -> bool:
    with get_db() as conn:
        cur = conn.execute(
            "SELECT code FROM email_verifications WHERE email = ?",
            (email,),
        )
        row = cur.fetchone()
        if row and row["code"] == code:
            conn.execute("DELETE FROM email_verifications WHERE email = ?", (email,))
            return True
        return False


def send_message(from_uid: str, to_uid: str, content: str) -> dict:
    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO messages (from_uid, to_uid, content) VALUES (?, ?, ?)",
            (from_uid, to_uid, content),
        )
        msg_id = cur.lastrowid
        cur = conn.execute("SELECT * FROM messages WHERE id = ?", (msg_id,))
        return dict(cur.fetchone())


def get_conversations(uid: str) -> list[dict]:
    with get_db() as conn:
        cur = conn.execute(
            """SELECT DISTINCT
                CASE WHEN from_uid = ? THEN to_uid ELSE from_uid END AS other_uid
               FROM messages
               WHERE from_uid = ? OR to_uid = ?""",
            (uid, uid, uid),
        )
        other_uids = [r["other_uid"] for r in cur.fetchall() if r["other_uid"]]
        convos = []
        for other_uid in other_uids:
            cur = conn.execute(
                "SELECT content, created_at FROM messages WHERE (from_uid = ? AND to_uid = ?) OR (from_uid = ? AND to_uid = ?) ORDER BY created_at DESC LIMIT 1",
                (uid, other_uid, other_uid, uid),
            )
            last_row = cur.fetchone()
            cur = conn.execute(
                "SELECT COUNT(*) AS cnt FROM messages WHERE to_uid = ? AND from_uid = ? AND read = 0",
                (uid, other_uid),
            )
            unread = dict(cur.fetchone())["cnt"]
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
        cur = conn.execute(
            """SELECT * FROM messages
               WHERE (from_uid = ? AND to_uid = ?) OR (from_uid = ? AND to_uid = ?)
               ORDER BY created_at ASC LIMIT ?""",
            (uid_a, uid_b, uid_b, uid_a, limit),
        )
        rows = cur.fetchall()
        conn.execute(
            "UPDATE messages SET read = 1 WHERE to_uid = ? AND from_uid = ? AND read = 0",
            (uid_a, uid_b),
        )
        return [dict(r) for r in rows]


def follow_user(follower_uid: str, following_uid: str) -> bool:
    if follower_uid == following_uid:
        return False
    with get_db() as conn:
        try:
            conn.execute(
                "INSERT OR IGNORE INTO follows (follower_uid, following_uid) VALUES (?, ?)",
                (follower_uid, following_uid),
            )
            return conn.total_changes > 0
        except Exception:
            return False


def unfollow_user(follower_uid: str, following_uid: str) -> bool:
    with get_db() as conn:
        conn.execute(
            "DELETE FROM follows WHERE follower_uid = ? AND following_uid = ?",
            (follower_uid, following_uid),
        )
        return conn.total_changes > 0


def get_following(uid: str) -> list[str]:
    with get_db() as conn:
        cur = conn.execute(
            "SELECT following_uid FROM follows WHERE follower_uid = ? ORDER BY created_at DESC",
            (uid,),
        )
        return [r["following_uid"] for r in cur.fetchall()]


def get_followers(uid: str) -> list[str]:
    with get_db() as conn:
        cur = conn.execute(
            "SELECT follower_uid FROM follows WHERE following_uid = ? ORDER BY created_at DESC",
            (uid,),
        )
        return [r["follower_uid"] for r in cur.fetchall()]


def is_following(follower_uid: str, following_uid: str) -> bool:
    with get_db() as conn:
        cur = conn.execute(
            "SELECT 1 FROM follows WHERE follower_uid = ? AND following_uid = ?",
            (follower_uid, following_uid),
        )
        return cur.fetchone() is not None


def check_pending_email(uid: str) -> str | None:
    user = get_user(uid)
    if user and user["email"] and not user["email_verified"]:
        return user["email"]
    return None
