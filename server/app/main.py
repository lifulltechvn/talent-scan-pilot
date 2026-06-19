from contextlib import asynccontextmanager

from fastapi import FastAPI
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.routers import ai_usage, auth, candidates, cv_batch, cv_upload, dashboard, email_templates, interviews, jobs, master_data, outreach, scoring, timeline, users
from app.scheduler import start_scheduler

limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    # Retry stuck candidates on startup
    from app.services.task_recovery import recover_stuck_tasks
    await recover_stuck_tasks()
    # Recover stale batch uploads
    from app.services.cv_batch_worker import recover_stale_batches
    await recover_stale_batches()
    yield


app = FastAPI(title="TalentScan API", version="0.1.0", lifespan=lifespan)
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)


# Request timing middleware
import time
from starlette.middleware.base import BaseHTTPMiddleware
import logging

_req_logger = logging.getLogger("request_timing")


class TimingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        start = time.time()
        response = await call_next(request)
        duration_ms = (time.time() - start) * 1000
        if duration_ms > 100:  # Only log slow requests
            _req_logger.info(f"{request.method} {request.url.path} — {duration_ms:.0f}ms")
        response.headers["X-Response-Time-Ms"] = f"{duration_ms:.0f}"
        return response


app.add_middleware(TimingMiddleware)
app.include_router(auth.router, prefix="/api/v1")
app.include_router(jobs.router, prefix="/api/v1")
app.include_router(candidates.router, prefix="/api/v1")
app.include_router(cv_upload.router, prefix="/api/v1")
app.include_router(cv_batch.router, prefix="/api/v1")
app.include_router(scoring.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(interviews.router, prefix="/api/v1")

app.include_router(outreach.router, prefix="/api/v1")
app.include_router(ai_usage.router, prefix="/api/v1")
app.include_router(timeline.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(email_templates.router, prefix="/api/v1")
app.include_router(master_data.router, prefix="/api/v1")


@app.get("/api/v1/health")
async def health():
    return {"status": "ok"}


# WebSocket for batch progress
from fastapi import WebSocket, WebSocketDisconnect
from app.ws_manager import connect, disconnect


@app.websocket("/ws/batch/{batch_id}")
async def batch_progress_ws(websocket: WebSocket, batch_id: str):
    await connect(batch_id, websocket)
    try:
        while True:
            await websocket.receive_text()  # Keep alive
    except WebSocketDisconnect:
        disconnect(batch_id, websocket)
