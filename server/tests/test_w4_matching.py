"""
W4 Verification: Test matching + scoring with mock embeddings.
Run: python -m tests.test_w4_matching
"""
import sys
sys.path.insert(0, ".")

from app.services.matching import (
    compute_match_score,
    cosine_similarity,
    generate_mock_embedding,
    keyword_match_score,
)
from app.services.scoring import classify_candidate, compute_rule_score


def test_cosine_similarity():
    vec = generate_mock_embedding("python developer")
    # Same text → same vector → similarity = 1.0
    assert abs(cosine_similarity(vec, vec) - 1.0) < 0.001
    # Different text → different vector → similarity < 1.0
    vec2 = generate_mock_embedding("marketing manager")
    sim = cosine_similarity(vec, vec2)
    assert -1.0 <= sim < 1.0
    print(f"  ✅ cosine_similarity: same=1.0, different={sim:.4f}")


def test_keyword_match():
    job_skills = ["Python", "FastAPI", "PostgreSQL", "Docker"]
    cand_skills = ["python", "fastapi", "react", "docker", "aws"]
    score = keyword_match_score(job_skills, cand_skills)
    assert score == 0.75  # 3/4 matched
    print(f"  ✅ keyword_match: {score} (3/4 skills matched)")


def test_compute_match_score():
    job_emb = generate_mock_embedding("Senior Python Backend Developer with FastAPI and PostgreSQL")
    cand_emb = generate_mock_embedding("Python developer 5 years experience FastAPI SQLAlchemy")
    result = compute_match_score(
        job_emb, cand_emb,
        job_skills=["Python", "FastAPI", "PostgreSQL"],
        candidate_skills=["Python", "FastAPI", "SQLAlchemy"],
    )
    assert 0 <= result["combined_score"] <= 1.0
    print(f"  ✅ compute_match_score: cosine={result['cosine_score']}, keyword={result['keyword_score']}, combined={result['combined_score']}")


def test_rule_scoring():
    # Good candidate
    result = compute_rule_score(
        job_skills=["Python", "FastAPI", "PostgreSQL", "Docker"],
        candidate_data={
            "skills": ["Python", "FastAPI", "PostgreSQL", "Docker", "AWS"],
            "experience_years": 5,
            "education_level": "master",
        },
        required_years=3,
        required_education="bachelor",
    )
    assert result["rule_score"] >= 80
    assert result["classification"] == "gold"
    print(f"  ✅ Good candidate: score={result['rule_score']}, class={result['classification']}")

    # Weak candidate
    result2 = compute_rule_score(
        job_skills=["Python", "FastAPI", "PostgreSQL", "Docker"],
        candidate_data={
            "skills": ["JavaScript", "React"],
            "experience_years": 1,
            "education_level": "bachelor",
        },
        required_years=5,
        required_education="master",
    )
    assert result2["rule_score"] < 60
    assert result2["classification"] == "talent_pool"
    print(f"  ✅ Weak candidate: score={result2['rule_score']}, class={result2['classification']}")


def test_classification():
    assert classify_candidate(85) == "gold"
    assert classify_candidate(70) == "silver"
    assert classify_candidate(40) == "talent_pool"
    print("  ✅ Classification: gold>=80, silver>=60, talent_pool<60")


if __name__ == "__main__":
    print("\n🧪 W4 Matching + Scoring Tests\n" + "=" * 40)
    test_cosine_similarity()
    test_keyword_match()
    test_compute_match_score()
    test_rule_scoring()
    test_classification()
    print("\n" + "=" * 40)
    print("✅ ALL TESTS PASSED — W4 deliverable verified!")
    print("   Matching + Scoring works locally with mock vectors.\n")
