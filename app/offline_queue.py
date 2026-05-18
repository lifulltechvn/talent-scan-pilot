"""Offline queue: SQLite-based pending uploads for when network is unavailable."""
import json
import os
import sqlite3
import uuid
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "queue.db")


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("""
        CREATE TABLE IF NOT EXISTS pending_uploads (
            id TEXT PRIMARY KEY,
            file_name TEXT NOT NULL,
            extracted_text TEXT,
            structured_data_json TEXT,
            pii_encrypted TEXT,
            status TEXT DEFAULT 'pending',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    return conn


def add_to_queue(file_name: str, extracted_text: str, structured_data: dict | None = None, pii_encrypted: str | None = None) -> str:
    row_id = str(uuid.uuid4())
    conn = _conn()
    conn.execute(
        "INSERT INTO pending_uploads (id, file_name, extracted_text, structured_data_json, pii_encrypted) VALUES (?, ?, ?, ?, ?)",
        (row_id, file_name, extracted_text, json.dumps(structured_data) if structured_data else None, pii_encrypted),
    )
    conn.commit()
    conn.close()
    return row_id


def get_pending() -> list[dict]:
    conn = _conn()
    rows = conn.execute("SELECT * FROM pending_uploads WHERE status = 'pending' ORDER BY created_at").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def mark_uploaded(row_id: str):
    conn = _conn()
    conn.execute("UPDATE pending_uploads SET status = 'uploaded' WHERE id = ?", (row_id,))
    conn.commit()
    conn.close()


def mark_failed(row_id: str):
    conn = _conn()
    conn.execute("UPDATE pending_uploads SET status = 'failed' WHERE id = ?", (row_id,))
    conn.commit()
    conn.close()


def get_queue_count() -> int:
    conn = _conn()
    count = conn.execute("SELECT COUNT(*) FROM pending_uploads WHERE status = 'pending'").fetchone()[0]
    conn.close()
    return count
