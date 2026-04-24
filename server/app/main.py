from fastapi import FastAPI

from app.routers import auth

app = FastAPI(title="TalentScan API", version="0.1.0")
app.include_router(auth.router, prefix="/api/v1")


@app.get("/api/v1/health")
async def health():
    return {"status": "ok"}
