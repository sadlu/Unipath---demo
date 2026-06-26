"""User feedback system — thumb up/down on opportunities and search results."""

import json
import logging
from datetime import datetime, timezone
from typing import Optional

from database import get_db, _execute, _row_as_dict, _rows_as_list

logger = logging.getLogger(__name__)


FEEDBACK_TYPES = ("search", "opportunity", "chat", "cv_advice")


def ensure_feedback_tables():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS feedback (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                uid TEXT NOT NULL,
                feedback_type TEXT NOT NULL,
                target_id TEXT NOT NULL,
                rating INTEGER NOT NULL CHECK(rating IN (1, -1)),
                comment TEXT DEFAULT '',
                created_at TEXT DEFAULT (datetime('now')),
                UNIQUE(uid, feedback_type, target_id)
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_feedback_type_target
            ON feedback(feedback_type, target_id)
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_feedback_uid
            ON feedback(uid)
        """)


def submit_feedback(
    uid: str,
    feedback_type: str,
    target_id: str,
    rating: int,
    comment: str = "",
) -> dict:
    if feedback_type not in FEEDBACK_TYPES:
        return {"ok": False, "error": f"Invalid feedback type. Must be one of: {', '.join(FEEDBACK_TYPES)}"}
    if rating not in (1, -1):
        return {"ok": False, "error": "Rating must be 1 (thumbs up) or -1 (thumbs down)"}
    try:
        with get_db() as conn:
            _execute(
                conn,
                "INSERT OR REPLACE INTO feedback (uid, feedback_type, target_id, rating, comment, created_at) "
                "VALUES (?, ?, ?, ?, ?, datetime('now'))",
                (uid, feedback_type, target_id, rating, comment),
            )
        return {"ok": True}
    except Exception as e:
        logger.warning(f"Feedback submission error: {e}")
        return {"ok": False, "error": str(e)}


def get_feedback_stats(feedback_type: str, target_id: str) -> dict:
    try:
        with get_db() as conn:
            cur = _execute(
                conn,
                "SELECT rating, COUNT(*) AS cnt FROM feedback "
                "WHERE feedback_type = ? AND target_id = ? GROUP BY rating",
                (feedback_type, target_id),
            )
            rows = _rows_as_list(cur.fetchall())
            up = 0
            down = 0
            for r in rows:
                if r["rating"] == 1:
                    up = r["cnt"]
                elif r["rating"] == -1:
                    down = r["cnt"]
            return {"up": up, "down": down, "total": up + down, "score": up - down}
    except Exception as e:
        logger.warning(f"Feedback stats error: {e}")
        return {"up": 0, "down": 0, "total": 0, "score": 0}


def get_user_feedback(uid: str, feedback_type: Optional[str] = None) -> list[dict]:
    try:
        with get_db() as conn:
            if feedback_type:
                cur = _execute(
                    conn,
                    "SELECT * FROM feedback WHERE uid = ? AND feedback_type = ? ORDER BY created_at DESC",
                    (uid, feedback_type),
                )
            else:
                cur = _execute(
                    conn,
                    "SELECT * FROM feedback WHERE uid = ? ORDER BY created_at DESC",
                    (uid,),
                )
            return _rows_as_list(cur.fetchall())
    except Exception as e:
        logger.warning(f"User feedback error: {e}")
        return []


def get_highest_rated(feedback_type: str, limit: int = 20) -> list[dict]:
    try:
        with get_db() as conn:
            cur = _execute(
                conn,
                "SELECT target_id, SUM(rating) AS score, COUNT(*) AS votes "
                "FROM feedback WHERE feedback_type = ? "
                "GROUP BY target_id HAVING score > 0 ORDER BY score DESC LIMIT ?",
                (feedback_type, limit),
            )
            return _rows_as_list(cur.fetchall())
    except Exception as e:
        logger.warning(f"Highest rated error: {e}")
        return []
