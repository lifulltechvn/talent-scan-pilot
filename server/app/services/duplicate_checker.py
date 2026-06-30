"""Duplicate CV detection: check by email or phone match."""

import re
from dataclasses import dataclass, field

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass
class DuplicateMatch:
    candidate_id: str
    candidate_name: str
    reason: str  # "email" or "phone"


@dataclass
class DuplicateCheckResult:
    is_duplicate: bool = False
    matches: list[DuplicateMatch] = field(default_factory=list)


def _normalize_phone(phone: str | None) -> str | None:
    """Normalize phone number: remove spaces, dashes, dots, country code. Keep last 9 digits."""
    if not phone:
        return None
    digits = re.sub(r'\D', '', phone)
    # Remove Vietnam country code prefix
    if digits.startswith('84') and len(digits) > 9:
        digits = '0' + digits[2:]
    # Keep last 9 digits for comparison
    if len(digits) >= 9:
        return digits[-9:]
    return digits if digits else None


def _normalize_email(email: str | None) -> str | None:
    """Normalize email: lowercase, strip."""
    if not email:
        return None
    email = email.lower().strip()
    return email if '@' in email else None


async def check_duplicate(
    db: AsyncSession,
    structured_data: dict,
    exclude_id: str | None = None,
    **kwargs,
) -> DuplicateCheckResult:
    """Check if a candidate with same email or phone already exists.

    Returns DuplicateCheckResult with matches found.
    """
    result = DuplicateCheckResult()

    email = _normalize_email(structured_data.get("email"))
    phone = _normalize_phone(structured_data.get("phone"))

    if not email and not phone:
        return result  # Nothing to check

    exclude_clause = "AND id != :exclude_id" if exclude_id else ""
    params: dict = {}
    if exclude_id:
        params["exclude_id"] = exclude_id

    # --- Email match ---
    if email:
        rows = await db.execute(text(f"""
            SELECT id, structured_data FROM candidates
            WHERE LOWER(structured_data->>'email') = :email
            AND status NOT IN ('processing', 'blacklisted')
            {exclude_clause}
            LIMIT 5
        """), {**params, "email": email})
        for row in rows.mappings().all():
            result.matches.append(DuplicateMatch(
                candidate_id=str(row["id"]),
                candidate_name=row["structured_data"].get("name", "Unknown"),
                reason="email",
            ))

    # --- Phone match ---
    if phone:
        # Get candidates with phone and compare normalized
        rows = await db.execute(text(f"""
            SELECT id, structured_data FROM candidates
            WHERE structured_data->>'phone' IS NOT NULL
            AND structured_data->>'phone' != ''
            AND status NOT IN ('processing', 'blacklisted')
            {exclude_clause}
            LIMIT 200
        """), params)
        for row in rows.mappings().all():
            cid = str(row["id"])
            # Skip if already matched by email
            if any(m.candidate_id == cid for m in result.matches):
                continue
            existing_phone = _normalize_phone(row["structured_data"].get("phone"))
            if existing_phone and existing_phone == phone:
                result.matches.append(DuplicateMatch(
                    candidate_id=cid,
                    candidate_name=row["structured_data"].get("name", "Unknown"),
                    reason="phone",
                ))

    result.is_duplicate = len(result.matches) > 0
    return result
