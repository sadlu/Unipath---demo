"""WebSocket handler for real-time chat — zero additional dependencies.

Uses FastAPI's built-in WebSocket support. In-memory connection manager
tracks active sessions for direct message delivery.
"""

import json
import logging
import time
from typing import Optional
from fastapi import WebSocket, WebSocketDisconnect

from database import send_message as db_send_message, get_user

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self._connections: dict[str, list[WebSocket]] = {}

    async def connect(self, uid: str, ws: WebSocket):
        await ws.accept()
        if uid not in self._connections:
            self._connections[uid] = []
        self._connections[uid].append(ws)
        logger.info(f"WebSocket connected: {uid} ({len(self._connections[uid])} sessions)")

    def disconnect(self, uid: str, ws: WebSocket):
        if uid in self._connections:
            try:
                self._connections[uid].remove(ws)
            except ValueError:
                pass
            if not self._connections[uid]:
                del self._connections[uid]
        logger.info(f"WebSocket disconnected: {uid}")

    def is_online(self, uid: str) -> bool:
        return uid in self._connections and bool(self._connections[uid])

    async def send_to_user(self, uid: str, message: dict):
        if uid not in self._connections:
            return False
        dead = []
        for ws in self._connections[uid]:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(uid, ws)
        return len(dead) < len(self._connections.get(uid, []))

    async def broadcast(self, message: dict):
        for uid in list(self._connections.keys()):
            await self.send_to_user(uid, message)

    @property
    def online_users(self) -> list[str]:
        return list(self._connections.keys())


manager = ConnectionManager()


async def handle_chat_ws(ws: WebSocket, uid: str):
    user = get_user(uid)
    if not user:
        await ws.close(code=4004, reason="User not found")
        return

    await manager.connect(uid, ws)
    try:
        while True:
            raw = await ws.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await ws.send_json({"type": "error", "error": "Invalid JSON"})
                continue

            msg_type = data.get("type", "message")

            if msg_type == "ping":
                await ws.send_json({"type": "pong"})

            elif msg_type == "message":
                to_uid = data.get("to_uid", "")
                content = data.get("content", "")
                image_url = data.get("image_url", "")

                if not to_uid:
                    await ws.send_json({"type": "error", "error": "Missing to_uid"})
                    continue

                recipient = get_user(to_uid)
                if not recipient:
                    await ws.send_json({"type": "error", "error": "Recipient not found"})
                    continue

                msg = db_send_message(uid, to_uid, content[:2000], image_url)

                delivery = {
                    "type": "message",
                    "message": msg,
                }

                online = await manager.send_to_user(to_uid, delivery)
                msg["delivered"] = online
                msg["queued"] = not online

                await manager.send_to_user(uid, delivery)

            elif msg_type == "typing":
                to_uid = data.get("to_uid", "")
                typing = data.get("typing", True)
                await manager.send_to_user(to_uid, {
                    "type": "typing",
                    "from_uid": uid,
                    "typing": typing,
                })

            elif msg_type == "mark_read":
                to_uid = data.get("to_uid", "")
                from database import get_db, _execute
                with get_db() as conn:
                    _execute(
                        conn,
                        "UPDATE messages SET read = 1 WHERE from_uid = ? AND to_uid = ? AND read = 0",
                        (to_uid, uid),
                    )
                await manager.send_to_user(to_uid, {
                    "type": "read_receipt",
                    "from_uid": uid,
                })

    except WebSocketDisconnect:
        manager.disconnect(uid, ws)
    except Exception as e:
        logger.warning(f"WebSocket error for {uid}: {e}")
        manager.disconnect(uid, ws)
