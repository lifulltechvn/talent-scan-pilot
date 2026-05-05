from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.config import settings

router = APIRouter(prefix="/app", tags=["app"])

RELEASES_DIR = Path("/app/releases")


@router.get("/version")
async def get_version():
    """Return latest app version and available downloads."""
    downloads = {}
    if RELEASES_DIR.exists():
        for f in RELEASES_DIR.iterdir():
            if f.suffix in (".zip", ".dmg", ".exe"):
                name = f.name.lower()
                if "macos" in name:
                    downloads["macos"] = f"/api/v1/app/download/{f.name}"
                elif "windows" in name:
                    downloads["windows"] = f"/api/v1/app/download/{f.name}"
    return {"version": settings.APP_VERSION, "downloads": downloads}


@router.get("/download/{filename}")
async def download(filename: str):
    """Download app release file."""
    path = RELEASES_DIR / filename
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path, filename=filename)
