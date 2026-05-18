"""
Matching service: cosine similarity (embeddings) + keyword overlap.
Uses mock embeddings when real ones are not available.
"""
import numpy as np


def cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    a = np.array(vec_a, dtype=np.float32)
    b = np.array(vec_b, dtype=np.float32)
    dot = np.dot(a, b)
    norm = np.linalg.norm(a) * np.linalg.norm(b)
    if norm == 0:
        return 0.0
    return float(dot / norm)


def generate_mock_embedding(seed_text: str, dim: int = 1536) -> list[float]:
    """Generate a deterministic mock embedding from text (for testing)."""
    rng = np.random.default_rng(seed=hash(seed_text) % (2**32))
    vec = rng.standard_normal(dim).astype(np.float32)
    vec = vec / np.linalg.norm(vec)  # normalize
    return vec.tolist()


def keyword_match_score(job_skills: list[str], candidate_skills: list[str]) -> float:
    """Calculate keyword overlap ratio between job required skills and candidate skills."""
    if not job_skills:
        return 0.0
    job_set = {s.lower().strip() for s in job_skills}
    cand_set = {s.lower().strip() for s in candidate_skills}
    if not job_set:
        return 0.0
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
    """
    Combined match score: weighted cosine + keyword.
    Returns dict with cosine_score, keyword_score, combined_score.
    """
    # Cosine similarity
    if job_embedding and candidate_embedding:
        cos_score = cosine_similarity(job_embedding, candidate_embedding)
    else:
        cos_score = 0.0

    # Keyword overlap
    kw_score = keyword_match_score(job_skills, candidate_skills)

    # Weighted combination
    combined = cos_score * cosine_weight + kw_score * keyword_weight

    return {
        "cosine_score": round(cos_score, 4),
        "keyword_score": round(kw_score, 4),
        "combined_score": round(combined, 4),
    }
