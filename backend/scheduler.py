"""Background job scheduler for periodic maintenance tasks.

Uses APScheduler for cron-like scheduling. Starts automatically
with the FastAPI app. All jobs are zero-cost (no external services).
"""

import logging
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler

from database import cleanup_expired_verifications, get_db, _execute
from deduplicator import start_dedup_cleaner
from ground_truth import start_verifier_thread

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler(daemon=True)


def cleanup_stale_tokens():
    """Remove expired auth and refresh tokens from the database."""
    try:
        with get_db() as conn:
            _execute(conn, "DELETE FROM auth_tokens WHERE expires_at < datetime('now') AND expires_at != ''")
            _execute(conn, "DELETE FROM refresh_tokens WHERE expires_at < datetime('now') AND expires_at != ''")
        logger.info("Cleaned up stale tokens")
    except Exception as e:
        logger.warning(f"Token cleanup failed: {e}")


def cleanup_stale_password_resets():
    """Remove expired or used password reset tokens."""
    try:
        with get_db() as conn:
            _execute(conn, "DELETE FROM password_resets WHERE expires_at < datetime('now') AND expires_at != ''")
            _execute(conn, "UPDATE password_resets SET used = 1 WHERE expires_at < datetime('now') AND expires_at != ''")
        logger.info("Cleaned up stale password reset tokens")
    except Exception as e:
        logger.warning(f"Password reset cleanup failed: {e}")


def start_scheduler():
    if scheduler.running:
        return

    scheduler.add_job(cleanup_expired_verifications, "interval", hours=1, id="cleanup_verifications")
    scheduler.add_job(cleanup_stale_tokens, "interval", hours=6, id="cleanup_tokens")
    scheduler.add_job(cleanup_stale_password_resets, "interval", hours=6, id="cleanup_resets")

    start_dedup_cleaner()
    start_verifier_thread()

    scheduler.start()
    logger.info("Background scheduler started with cleanup jobs")
