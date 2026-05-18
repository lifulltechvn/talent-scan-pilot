"""Seed test data: user + jobs + candidates + scores."""
import asyncio
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import hash_password
from app.database import async_session
from app.models import Candidate, Job, Score, User
from app.services.matching import compute_match_score, generate_mock_embedding
from app.services.scoring import compute_rule_score


JOBS = [
    {
        "title": "Senior Python Backend Developer",
        "description": "Xây dựng hệ thống backend với FastAPI, PostgreSQL, Docker. Yêu cầu 3+ năm kinh nghiệm Python.",
        "required_skills": ["Python", "FastAPI", "PostgreSQL", "Docker", "Redis"],
        "location": "Ho Chi Minh",
        "salary_range": "2000-3500 USD",
    },
    {
        "title": "React Frontend Developer",
        "description": "Phát triển dashboard SPA với React, TypeScript, TailwindCSS. Cần hiểu REST API.",
        "required_skills": ["React", "TypeScript", "TailwindCSS", "REST API", "Git"],
        "location": "Ha Noi",
        "salary_range": "1500-2500 USD",
    },
    {
        "title": "DevOps Engineer",
        "description": "Quản lý infrastructure AWS, CI/CD pipelines, Docker/Kubernetes.",
        "required_skills": ["AWS", "Docker", "Kubernetes", "Terraform", "CI/CD"],
        "location": "Remote",
        "salary_range": "2500-4000 USD",
    },
]

CANDIDATES = [
    # Job 0 candidates
    {
        "job_idx": 0,
        "structured_data": {
            "name": "Nguyen Van Minh",
            "email": "minh.nv@gmail.com",
            "skills": ["Python", "FastAPI", "PostgreSQL", "Docker", "Redis", "AWS"],
            "experience_years": 5,
            "education_level": "master",
            "summary": "Senior Python developer, 5 năm kinh nghiệm backend. Từng lead team 4 người.",
        },
    },
    {
        "job_idx": 0,
        "structured_data": {
            "name": "Tran Thi Lan",
            "email": "lan.tt@gmail.com",
            "skills": ["Python", "Django", "PostgreSQL", "Docker"],
            "experience_years": 3,
            "education_level": "bachelor",
            "summary": "Mid-level Python developer, chuyên Django. Muốn chuyển sang FastAPI.",
        },
    },
    {
        "job_idx": 0,
        "structured_data": {
            "name": "Le Hoang Nam",
            "email": "nam.lh@gmail.com",
            "skills": ["Java", "Spring Boot", "MySQL"],
            "experience_years": 4,
            "education_level": "bachelor",
            "summary": "Java developer muốn chuyển sang Python. Chưa có kinh nghiệm FastAPI.",
        },
    },
    # Job 1 candidates
    {
        "job_idx": 1,
        "structured_data": {
            "name": "Pham Duc Anh",
            "email": "anh.pd@gmail.com",
            "skills": ["React", "TypeScript", "TailwindCSS", "REST API", "Git", "Next.js"],
            "experience_years": 4,
            "education_level": "bachelor",
            "summary": "Frontend developer 4 năm, chuyên React ecosystem.",
        },
    },
    {
        "job_idx": 1,
        "structured_data": {
            "name": "Vo Minh Thu",
            "email": "thu.vm@gmail.com",
            "skills": ["Vue.js", "JavaScript", "CSS", "Git"],
            "experience_years": 2,
            "education_level": "bachelor",
            "summary": "Junior frontend, chủ yếu Vue.js. Đang học React.",
        },
    },
    # Job 2 candidates
    {
        "job_idx": 2,
        "structured_data": {
            "name": "Hoang Quoc Bao",
            "email": "bao.hq@gmail.com",
            "skills": ["AWS", "Docker", "Kubernetes", "Terraform", "CI/CD", "Linux"],
            "experience_years": 6,
            "education_level": "master",
            "summary": "DevOps engineer 6 năm, AWS certified. Quản lý infra cho 3 products.",
        },
    },
    {
        "job_idx": 2,
        "structured_data": {
            "name": "Dang Thanh Son",
            "email": "son.dt@gmail.com",
            "skills": ["Docker", "Linux", "CI/CD", "Python"],
            "experience_years": 2,
            "education_level": "bachelor",
            "summary": "Junior DevOps, biết Docker và basic CI/CD. Đang học AWS.",
        },
    },
]


async def seed():
    async with async_session() as db:
        # 1. Create test user
        existing = await db.execute(select(User).where(User.email == "hr@test.com"))
        if not existing.scalar_one_or_none():
            user = User(
                email="hr@test.com",
                hashed_password=hash_password("test1234"),
                full_name="HR Manager",
            )
            db.add(user)
            await db.flush()
        else:
            user = (await db.execute(select(User).where(User.email == "hr@test.com"))).scalar_one()

        print(f"✅ User: hr@test.com / test1234")

        # 2. Create jobs
        job_objects = []
        for j in JOBS:
            job = Job(**j, created_by=user.id)
            db.add(job)
            job_objects.append(job)
        await db.flush()
        print(f"✅ Created {len(job_objects)} jobs")

        # 3. Create candidates
        cand_objects = []
        for c in CANDIDATES:
            job = job_objects[c["job_idx"]]
            cand = Candidate(
                job_id=job.id,
                structured_data=c["structured_data"],
                status="new",
                source_app_version="1.0.5",
            )
            db.add(cand)
            cand_objects.append((cand, job))
        await db.flush()
        print(f"✅ Created {len(cand_objects)} candidates")

        # 4. Run matching + scoring
        for cand, job in cand_objects:
            job_emb = generate_mock_embedding(job.title + job.description)
            cand_text = str(cand.structured_data.get("skills", [])) + cand.structured_data.get("summary", "")
            cand_emb = generate_mock_embedding(cand_text)

            match_result = compute_match_score(job_emb, cand_emb, job.required_skills, cand.structured_data.get("skills", []))
            score_result = compute_rule_score(
                job_skills=job.required_skills,
                candidate_data=cand.structured_data,
                required_years=3,
                required_education="bachelor",
            )

            final_score = round((match_result["combined_score"] * 100 + score_result["rule_score"]) / 2, 2)
            cand.match_score = match_result["combined_score"]

            score_obj = Score(
                candidate_id=cand.id,
                rule_score=score_result["rule_score"],
                final_score=final_score,
                classification=score_result["classification"],
                details={"matching": match_result, "rule_scoring": score_result["details"]},
            )
            db.add(score_obj)

        await db.commit()
        print(f"✅ Scored all candidates")
        print(f"\n🎉 Seed complete! Login: hr@test.com / test1234")
        print(f"   Dashboard: http://localhost")
        print(f"   Swagger:   http://localhost:8000/docs")


if __name__ == "__main__":
    asyncio.run(seed())
