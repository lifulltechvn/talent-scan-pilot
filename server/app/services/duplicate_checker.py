"""Duplicate CV detection service with 5 criteria:
1. Email match (exact)
2. Phone match (normalized)
3. Embedding similarity (cosine > threshold)
4. Skills overlap (% match)
5. Experience overlap (company + role similarity)
"""

import re
from dataclasses import dataclass, field

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.matching import cosine_similarity


# Thresholds
EMBEDDING_SIMILARITY_THRESHOLD = 0.92  # Very high = likely same person
SKILLS_OVERLAP_THRESHOLD = 0.70  # 70% skills match
EXPERIENCE_OVERLAP_THRESHOLD = 0.60  # 60% experience match


@dataclass
class DuplicateMatch:
    candidate_id: str
    candidate_name: str
    reasons: list[str] = field(default_factory=list)
    scores: dict = field(default_factory=dict)
    confidence: float = 0.0  # 0.0 - 1.0 overall duplicate confidence


@dataclass
class DuplicateCheckResult:
    is_duplicate: bool = False
    matches: list[DuplicateMatch] = field(default_factory=list)
    checked_criteria: list[str] = field(default_factory=list)


def _normalize_phone(phone: str | None) -> str | None:
    """Normalize phone number: remove spaces, dashes, dots, country code."""
    if not phone:
        return None
    # Remove all non-digit characters
    digits = re.sub(r'\D', '', phone)
    # Remove Vietnam country code prefix
    if digits.startswith('84') and len(digits) > 9:
        digits = '0' + digits[2:]
    # Remove leading zeros for comparison (keep last 9 digits)
    if len(digits) >= 9:
        return digits[-9:]
    return digits if digits else None


def _normalize_email(email: str | None) -> str | None:
    """Normalize email: lowercase, strip."""
    if not email:
        return None
    return email.lower().strip()


def _compute_skills_overlap(skills_a: list[str], skills_b: list[str]) -> float:
    """Compute bidirectional skills overlap ratio."""
    if not skills_a or not skills_b:
        return 0.0
    set_a = {s.lower().strip() for s in skills_a if s}
    set_b = {s.lower().strip() for s in skills_b if s}
    if not set_a or not set_b:
        return 0.0
    intersection = set_a & set_b
    # Use Jaccard-like: intersection / min(len_a, len_b) — biased toward smaller set
    return len(intersection) / min(len(set_a), len(set_b))


def _compute_experience_overlap(exp_a: list[dict], exp_b: list[dict]) -> float:
    """Compute experience overlap based on company + role similarity."""
    if not exp_a or not exp_b:
        return 0.0

    matches = 0
    for ea in exp_a:
        company_a = (ea.get("company") or "").lower().strip()
        role_a = (ea.get("role") or "").lower().strip()
        if not company_a:
            continue
        for eb in exp_b:
            company_b = (eb.get("company") or "").lower().strip()
            role_b = (eb.get("role") or "").lower().strip()
            if not company_b:
                continue
            # Company match (contains or equal)
            company_match = (
                company_a in company_b or company_b in company_a
                or company_a == company_b
            )
            # Role match (contains or equal)
            role_match = (
                role_a in role_b or role_b in role_a
                or role_a == role_b
            ) if role_a and role_b else False

            if company_match and role_match:
                matches += 1
                break
            elif company_match:
                matches += 0.5
                break

    return matches / len(exp_a) if exp_a else 0.0


async def check_duplicate(
    db: AsyncSession,
    structured_data: dict,
    embedding: list[float] | None = None,
    exclude_id: str | None = None,
) -> DuplicateCheckResult:
    """Check if a candidate with similar info already exists.

    Args:
        db: Database session
        structured_data: Parsed CV data (name, email, phone, skills, experience)
        embedding: CV embedding vector (1024-dim)
        exclude_id: Candidate ID to exclude (for update scenarios)

    Returns:
        DuplicateCheckResult with matches and confidence scores
    """
    result = DuplicateCheckResult()
    candidates_map: dict[str, DuplicateMatch] = {}  # id → match

    email = _normalize_email(structured_data.get("email"))
    phone = _normalize_phone(structured_data.get("phone"))
    skills = structured_data.get("skills") or []
    experience = structured_data.get("experience") or []

    exclude_clause = "AND id != :exclude_id" if exclude_id else ""
    params: dict = {}
    if exclude_id:
        params["exclude_id"] = exclude_id

    # --- 1. Email match ---
    if email:
        result.checked_criteria.append("email")
        rows = await db.execute(text(f"""
            SELECT id, structured_data FROM candidates
            WHERE LOWER(structured_data->>'email') = :email
            AND status NOT IN ('processing', 'blacklisted')
            {exclude_clause}
            LIMIT 5
        """), {**params, "email": email})
        for row in rows.mappings().all():
            cid = str(row["id"])
            if cid not in candidates_map:
                candidates_map[cid] = DuplicateMatch(
                    candidate_id=cid,
                    candidate_name=row["structured_data"].get("name", "Unknown"),
                )
            candidates_map[cid].reasons.append("email_match")
            candidates_map[cid].scores["email"] = 1.0

    # --- 2. Phone match ---
    if phone:
        result.checked_criteria.append("phone")
        # Get all candidates with phone and compare normalized
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
            existing_phone = _normalize_phone(row["structured_data"].get("phone"))
            if existing_phone and existing_phone == phone:
                if cid not in candidates_map:
                    candidates_map[cid] = DuplicateMatch(
                        candidate_id=cid,
                        candidate_name=row["structured_data"].get("name", "Unknown"),
                    )
                candidates_map[cid].reasons.append("phone_match")
                candidates_map[cid].scores["phone"] = 1.0

    # --- 3. Embedding similarity ---
    if embedding:
        result.checked_criteria.append("embedding_similarity")
        # Use pgvector to find top similar candidates
        rows = await db.execute(text(f"""
            SELECT id, structured_data, embedding,
                   1 - (embedding <=> CAST(:emb AS vector)) AS similarity
            FROM candidates
            WHERE embedding IS NOT NULL
            AND status NOT IN ('processing', 'blacklisted')
            {exclude_clause}
            ORDER BY embedding <=> CAST(:emb AS vector)
            LIMIT 5
        """), {**params, "emb": str(embedding)})
        for row in rows.mappings().all():
            sim = float(row["similarity"])
            if sim >= EMBEDDING_SIMILARITY_THRESHOLD:
                cid = str(row["id"])
                if cid not in candidates_map:
                    candidates_map[cid] = DuplicateMatch(
                        candidate_id=cid,
                        candidate_name=row["structured_data"].get("name", "Unknown"),
                    )
                candidates_map[cid].reasons.append("embedding_similarity")
                candidates_map[cid].scores["embedding_similarity"] = round(sim, 4)

    # --- 4. Skills overlap ---
    if skills and len(skills) >= 3:
        result.checked_criteria.append("skills_overlap")
        # Get candidates already flagged by email/phone/embedding OR top similar
        check_ids = list(candidates_map.keys())
        if check_ids:
            rows = await db.execute(text(f"""
                SELECT id, structured_data FROM candidates
                WHERE id = ANY(:ids)
            """), {"ids": check_ids})
            for row in rows.mappings().all():
                cid = str(row["id"])
                existing_skills = row["structured_data"].get("skills") or []
                overlap = _compute_skills_overlap(skills, existing_skills)
                if overlap >= SKILLS_OVERLAP_THRESHOLD:
                    candidates_map[cid].reasons.append("skills_overlap")
                candidates_map[cid].scores["skills_overlap"] = round(overlap, 4)

    # --- 5. Experience overlap ---
    if experience and len(experience) >= 1:
        result.checked_criteria.append("experience_overlap")
        check_ids = list(candidates_map.keys())
        if check_ids:
            rows = await db.execute(text(f"""
                SELECT id, structured_data FROM candidates
                WHERE id = ANY(:ids)
            """), {"ids": check_ids})
            for row in rows.mappings().all():
                cid = str(row["id"])
                existing_exp = row["structured_data"].get("experience") or []
                overlap = _compute_experience_overlap(experience, existing_exp)
                if overlap >= EXPERIENCE_OVERLAP_THRESHOLD:
                    candidates_map[cid].reasons.append("experience_overlap")
                candidates_map[cid].scores["experience_overlap"] = round(overlap, 4)

    # --- Calculate confidence ---
    for match in candidates_map.values():
        # Weighted confidence:
        # email/phone = 0.4 each (very strong signal)
        # embedding = 0.3 (strong signal)
        # skills = 0.15, experience = 0.15 (supporting signal)
        confidence = 0.0
        if "email_match" in match.reasons:
            confidence += 0.4
        if "phone_match" in match.reasons:
            confidence += 0.4
        if "embedding_similarity" in match.reasons:
            confidence += 0.3 * match.scores.get("embedding_similarity", 0)
        if "skills_overlap" in match.reasons:
            confidence += 0.15 * match.scores.get("skills_overlap", 0)
        if "experience_overlap" in match.reasons:
            confidence += 0.15 * match.scores.get("experience_overlap", 0)
        match.confidence = min(round(confidence, 4), 1.0)

    # Filter: only return matches with at least 1 strong signal (email/phone/embedding)
    strong_matches = [
        m for m in candidates_map.values()
        if any(r in ("email_match", "phone_match", "embedding_similarity") for r in m.reasons)
    ]
    strong_matches.sort(key=lambda m: m.confidence, reverse=True)

    result.matches = strong_matches[:5]  # Top 5
    result.is_duplicate = len(result.matches) > 0

    return result
