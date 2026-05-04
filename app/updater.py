"""Auto-updater: check server version, download + replace + restart if needed."""

import io
import os
import platform
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path
from urllib.parse import urljoin

import httpx

CURRENT_VERSION = "1.0.5"
DEFAULT_SERVER_URL = "http://localhost:8000"


def get_server_url() -> str:
    return os.environ.get("TALENTSCAN_SERVER_URL", DEFAULT_SERVER_URL)


def check_update() -> dict | None:
    """Check server for new version. Returns {"version", "download_url"} or None."""
    try:
        r = httpx.get(f"{get_server_url()}/api/v1/app/version", timeout=5)
        r.raise_for_status()
        data = r.json()
        if data["version"] != CURRENT_VERSION and data.get("downloads"):
            # Pick download for current OS
            os_key = "macos" if platform.system() == "Darwin" else "windows"
            dl = data["downloads"].get(os_key)
            if dl:
                return {"version": data["version"], "download_url": dl}
    except Exception:
        pass
    return None


def download_and_install(download_url: str) -> Path:
    """Download zip from server, extract to temp dir, return extracted path."""
    url = urljoin(get_server_url(), download_url)
    r = httpx.get(url, timeout=60, follow_redirects=True)
    r.raise_for_status()

    # Extract zip to a temp location next to current app
    app_dir = Path(__file__).resolve().parent
    update_dir = app_dir / "_update"
    if update_dir.exists():
        shutil.rmtree(update_dir)

    with zipfile.ZipFile(io.BytesIO(r.content)) as zf:
        zf.extractall(update_dir)

    return update_dir


def apply_update(update_dir: Path):
    """Replace current app files with updated ones and restart."""
    app_dir = Path(__file__).resolve().parent
    backup_dir = app_dir / "_backup"

    # Backup current files (exclude venv, __pycache__, _update, _backup)
    skip = {".venv", "__pycache__", "_update", "_backup"}
    if backup_dir.exists():
        shutil.rmtree(backup_dir)
    backup_dir.mkdir()

    for item in app_dir.iterdir():
        if item.name in skip:
            continue
        dest = backup_dir / item.name
        if item.is_dir():
            shutil.copytree(item, dest)
        else:
            shutil.copy2(item, dest)

    # Copy new files over
    for item in update_dir.iterdir():
        dest = app_dir / item.name
        if dest.exists():
            if dest.is_dir():
                shutil.rmtree(dest)
            else:
                dest.unlink()
        if item.is_dir():
            shutil.copytree(item, dest)
        else:
            shutil.copy2(item, dest)

    # Cleanup
    shutil.rmtree(update_dir, ignore_errors=True)
    shutil.rmtree(backup_dir, ignore_errors=True)
