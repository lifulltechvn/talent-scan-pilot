"""Matching service: cosine similarity (embeddings) + keyword overlap."""

import numpy as np

from app.bedrock import get_embedding as bedrock_get_embedding


def cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    a = np.array(vec_a, dtype=np.float32)
    b = np.array(vec_b, dtype=np.float32)
    dot = np.dot(a, b)
    norm = np.linalg.norm(a) * np.linalg.norm(b)
    if norm == 0:
        return 0.0
    return float(dot / norm)


def get_embedding(text: str) -> list[float]:
    return bedrock_get_embedding(text[:8000])


def generate_mock_embedding(text: str) -> list[float]:
    """Generate a deterministic mock embedding (1024-dim) for seeding without API calls."""
    import hashlib
    import random
    seed = int(hashlib.md5(text.encode()).hexdigest(), 16) % (2**32)
    rng = random.Random(seed)
    vec = [rng.gauss(0, 1) for _ in range(1024)]
    norm = (sum(x * x for x in vec)) ** 0.5 or 1.0
    return [x / norm for x in vec]


def keyword_match_score(job_skills: list[str], candidate_skills: list[str]) -> float:
    if not job_skills:
        return 0.0
    job_set = {s.lower().strip() for s in job_skills}
    cand_set = {s.lower().strip() for s in candidate_skills}
    matched = job_set & cand_set
    return len(matched) / len(job_set)


def compute_match_score(
    job_embedding: list[float] | None,
    candidate_embedding: list[float] | None,
    job_skills: list[str],
    candidate_skills: list[str],
    cosine_weight: float = 0.6,
    keyword_weight: float = 0.4,
) -> dict:
    if job_embedding is not None and candidate_embedding is not None:
        cos_score = cosine_similarity(job_embedding, candidate_embedding)
    else:
        cos_score = 0.0

    kw_score = keyword_match_score(job_skills, candidate_skills)
    combined = cos_score * cosine_weight + kw_score * keyword_weight

    return {
        "cosine_score": round(cos_score, 4),
        "keyword_score": round(kw_score, 4),
        "combined_score": round(combined, 4),
    }
