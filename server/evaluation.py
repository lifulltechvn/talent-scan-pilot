"""Evaluation: measure ranking quality against ground truth."""
import asyncio

from app.services.scoring import compute_rule_score, score_skills
from app.services.matching import generate_mock_embedding, compute_match_score
from app.skill_normalizer import normalize_skills

# Ground truth: human-labeled candidates for "Senior Python Developer"
# Rating: 1 (bad fit) to 5 (excellent fit)
GROUND_TRUTH = [
    {"name": "A", "skills": ["Python", "FastAPI", "PostgreSQL", "Docker", "Redis", "AWS"], "experience_years": 5, "education_level": "master", "human_rating": 5},
    {"name": "B", "skills": ["Python", "Django", "PostgreSQL", "Docker"], "experience_years": 3, "education_level": "bachelor", "human_rating": 3},
    {"name": "C", "skills": ["Java", "Spring Boot", "MySQL"], "experience_years": 4, "education_level": "bachelor", "human_rating": 1},
    {"name": "D", "skills": ["Python", "FastAPI", "Redis", "Docker", "Kubernetes", "PostgreSQL", "AWS"], "experience_years": 7, "education_level": "master", "human_rating": 5},
    {"name": "E", "skills": ["React", "TypeScript", "TailwindCSS", "REST API", "Git", "Next.js"], "experience_years": 4, "education_level": "bachelor", "human_rating": 1},
    {"name": "F", "skills": ["Python", "Flask", "MySQL", "Git"], "experience_years": 1, "education_level": "bachelor", "human_rating": 2},
    {"name": "G", "skills": ["AWS", "Docker", "Kubernetes", "Terraform", "CI/CD", "Python"], "experience_years": 6, "education_level": "master", "human_rating": 3},
    {"name": "H", "skills": ["Python", "FastAPI", "PostgreSQL", "Docker", "Redis"], "experience_years": 4, "education_level": "bachelor", "human_rating": 4},
    {"name": "I", "skills": ["Python", "Django", "Redis", "AWS", "Docker", "PostgreSQL"], "experience_years": 5, "education_level": "bachelor", "human_rating": 4},
    {"name": "J", "skills": ["Go", "gRPC", "Docker", "Kubernetes"], "experience_years": 3, "education_level": "bachelor", "human_rating": 1},
]

JOB = {
    "title": "Senior Python Backend Developer",
    "required_skills": ["Python", "FastAPI", "PostgreSQL", "Docker", "Redis"],
    "required_years": 3,
    "required_education": "bachelor",
}


def evaluate():
    print("=" * 60)
    print("TalentScan — Ranking Quality Evaluation")
    print("=" * 60)
    print(f"\nJob: {JOB['title']}")
    print(f"Required: {JOB['required_skills']}")
    print(f"Ground truth: {len(GROUND_TRUTH)} candidates, human-rated 1-5\n")

    # Score each candidate
    results = []
    job_emb = generate_mock_embedding(JOB["title"] + " ".join(JOB["required_skills"]))

    for c in GROUND_TRUTH:
        cand_emb = generate_mock_embedding(" ".join(c["skills"]) + str(c["experience_years"]))
        match = compute_match_score(job_emb, cand_emb, JOB["required_skills"], c["skills"])
        score_result = compute_rule_score(
            job_skills=JOB["required_skills"],
            candidate_data=c,
            required_years=JOB["required_years"],
            required_education=JOB["required_education"],
            job_title=JOB["title"],
            use_llm=False,
        )
        results.append({
            "name": c["name"],
            "human_rating": c["human_rating"],
            "system_score": score_result["final_score"],
            "classification": score_result["classification"],
        })

    # Sort by system score (descending)
    results.sort(key=lambda x: x["system_score"], reverse=True)
    human_rank = sorted(GROUND_TRUTH, key=lambda x: x["human_rating"], reverse=True)

    print(f"{'Rank':<5} {'Name':<5} {'System Score':<14} {'Class':<12} {'Human Rating':<13}")
    print("-" * 50)
    for i, r in enumerate(results):
        print(f"{i+1:<5} {r['name']:<5} {r['system_score']:<14.1f} {r['classification']:<12} {r['human_rating']:<13}")

    # Metrics
    # 1. NDCG@5 (simplified)
    system_top5 = [r["name"] for r in results[:5]]
    human_top5 = [c["name"] for c in human_rank[:5]]
    overlap_top5 = len(set(system_top5) & set(human_top5))

    # 2. Correlation: do high human ratings get high system scores?
    high_human = [r for r in results if r["human_rating"] >= 4]
    high_system_correct = sum(1 for r in high_human if r["system_score"] >= 60)

    low_human = [r for r in results if r["human_rating"] <= 2]
    low_system_correct = sum(1 for r in low_human if r["system_score"] < 60)

    # 3. Top-1 accuracy
    top1_correct = results[0]["human_rating"] >= 4

    # 4. Gold accuracy: are all "gold" candidates actually good?
    gold = [r for r in results if r["classification"] == "gold"]
    gold_correct = sum(1 for r in gold if r["human_rating"] >= 4)

    print("\n" + "=" * 60)
    print("📊 EVALUATION METRICS")
    print("=" * 60)
    print(f"\n  Top-5 overlap with human ranking: {overlap_top5}/5 ({overlap_top5/5*100:.0f}%)")
    print(f"  Top-1 accuracy: {'✅ PASS' if top1_correct else '❌ FAIL'}")
    print(f"  High-rated detected (≥4 → score≥60): {high_system_correct}/{len(high_human)} ({high_system_correct/len(high_human)*100:.0f}%)")
    print(f"  Low-rated filtered (≤2 → score<60): {low_system_correct}/{len(low_human)} ({low_system_correct/len(low_human)*100:.0f}%)")
    print(f"  Gold precision: {gold_correct}/{len(gold)} ({gold_correct/len(gold)*100:.0f}%)" if gold else "  Gold precision: N/A")

    total_correct = high_system_correct + low_system_correct
    total = len(high_human) + len(low_human)
    accuracy = total_correct / total * 100 if total else 0
    print(f"\n  🎯 Overall Accuracy: {accuracy:.0f}%")
    print(f"  KPI Target: ≥ 80% — {'✅ PASS' if accuracy >= 80 else '❌ NEEDS IMPROVEMENT'}")
    print("-" * 60)


if __name__ == "__main__":
    evaluate()
