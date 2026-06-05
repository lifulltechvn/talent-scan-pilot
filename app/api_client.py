"""API client for Desktop App → Server communication."""
import os

import httpx

SERVER_URL = os.environ.get("TALENTSCAN_SERVER_URL", "http://18.181.237.122")
_token: str | None = None


def login(email: str, password: str) -> str:
    """Login and store token. Returns access_token."""
    global _token
    r = httpx.post(
        f"{SERVER_URL}/api/v1/auth/login",
        data={"username": email, "password": password},
        timeout=10,
    )
    r.raise_for_status()
    _token = r.json()["access_token"]
    return _token


def get_token() -> str | None:
    return _token


def upload_candidate(job_id: str | None, structured_data: dict, embedding: list[float] | None = None) -> dict:
    """Upload a candidate to server. Returns created candidate."""
    if not _token:
        raise RuntimeError("Not logged in")
    from updater import CURRENT_VERSION
    payload = {"structured_data": structured_data, "source_app_version": CURRENT_VERSION}
    if job_id:
        payload["job_id"] = job_id
    if embedding:
        payload["embedding"] = embedding
    r = httpx.post(
        f"{SERVER_URL}/api/v1/candidates",
        json=payload,
        headers={"Authorization": f"Bearer {_token}"},
        timeout=15,
    )
    r.raise_for_status()
    return r.json()


def get_jobs() -> list[dict]:
    """Get list of jobs from server."""
    if not _token:
        raise RuntimeError("Not logged in")
    r = httpx.get(
        f"{SERVER_URL}/api/v1/jobs",
        headers={"Authorization": f"Bearer {_token}"},
        timeout=10,
    )
    r.raise_for_status()
    return r.json()


def trigger_scoring(job_id: str) -> dict:
    """Trigger matching + scoring for all candidates of a job."""
    if not _token:
        raise RuntimeError("Not logged in")
    r = httpx.post(
        f"{SERVER_URL}/api/v1/scoring/jobs/{job_id}/match",
        headers={"Authorization": f"Bearer {_token}"},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()
