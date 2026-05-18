from fastapi import FastAPI

from app.routers import app_version, auth, candidates, jobs, scoring

app = FastAPI(title="TalentScan API", version="0.1.0")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(app_version.router, prefix="/api/v1")
app.include_router(jobs.router, prefix="/api/v1")
app.include_router(candidates.router, prefix="/api/v1")
app.include_router(scoring.router, prefix="/api/v1")


@app.get("/api/v1/health")
async def health():
    return {"status": "ok"}
