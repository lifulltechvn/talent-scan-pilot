"""WebSocket manager for realtime batch progress updates."""
import asyncio
import json
import logging
from typing import Dict, Set

from fastapi import WebSocket

logger = logging.getLogger(__name__)

# Active connections per batch_id
_connections: Dict[str, Set[WebSocket]] = {}


async def connect(batch_id: str, websocket: WebSocket):
    await websocket.accept()
    if batch_id not in _connections:
        _connections[batch_id] = set()
    _connections[batch_id].add(websocket)


def disconnect(batch_id: str, websocket: WebSocket):
    if batch_id in _connections:
        _connections[batch_id].discard(websocket)
        if not _connections[batch_id]:
            del _connections[batch_id]


async def broadcast(batch_id: str, data: dict):
    """Send progress update to all connected clients for a batch."""
    if batch_id not in _connections:
        return
    message = json.dumps(data)
    dead = set()
    for ws in _connections[batch_id]:
        try:
            await ws.send_text(message)
        except Exception:
            dead.add(ws)
    for ws in dead:
        _connections[batch_id].discard(ws)


def notify_progress(batch_id: str, data: dict):
    """Fire-and-forget broadcast from sync code (background threads)."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.create_task(broadcast(batch_id, data))
        else:
            asyncio.run(broadcast(batch_id, data))
    except RuntimeError:
        pass  # No event loop — skip notification
