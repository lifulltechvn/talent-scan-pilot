from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.routers import ai_usage, app_version, auth, candidates, dashboard, jobs, outreach, quiz, schedule, scoring
from app.scheduler import start_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield


app = FastAPI(title="TalentScan API", version="0.1.0", lifespan=lifespan)
app.include_router(auth.router, prefix="/api/v1")
app.include_router(app_version.router, prefix="/api/v1")
app.include_router(jobs.router, prefix="/api/v1")
app.include_router(candidates.router, prefix="/api/v1")
app.include_router(scoring.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(quiz.router, prefix="/api/v1")
app.include_router(schedule.router, prefix="/api/v1")
app.include_router(outreach.router, prefix="/api/v1")
app.include_router(ai_usage.router, prefix="/api/v1")


@app.get("/api/v1/health")
async def health():
    return {"status": "ok"}
