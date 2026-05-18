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
    # Job 0: Senior Python Backend Developer
    {
        "job_idx": 0,
        "structured_data": {
            "name": "Nguyen Van Minh",
            "skills": ["Python", "FastAPI", "PostgreSQL", "Docker", "Redis", "AWS"],
            "experience_years": 5,
            "totalYearsExperience": 5,
            "education_level": "master",
            "summary": "Senior Python developer, 5 năm kinh nghiệm backend. Từng lead team 4 người.",
            "expectedSalary": "3000-3500 USD",
            "experience": [
                {"company": "VNG Corporation", "role": "Senior Backend Developer", "years": 3, "description": "Lead team 4 người, xây dựng microservices với FastAPI + PostgreSQL. Xử lý 10K req/s."},
                {"company": "FPT Software", "role": "Python Developer", "years": 2, "description": "Phát triển REST API, tích hợp Redis caching, deploy Docker trên AWS ECS."},
            ],
            "education": [
                {"school": "Đại học Bách Khoa TP.HCM", "major": "Khoa học Máy tính", "degree": "master", "year": 2019},
            ],
            "languages": [{"language": "Vietnamese", "level": "Native"}, {"language": "English", "level": "Professional"}],
            "insight": {
                "strengths": "Strong Python/FastAPI expertise, leadership experience, full-stack backend skills with Docker + AWS.",
                "weaknesses": "No frontend experience. Limited exposure to Kubernetes.",
                "recommendation": "Excellent fit for Senior Backend role. Can lead backend team immediately.",
            },
        },
    },
    {
        "job_idx": 0,
        "structured_data": {
            "name": "Tran Thi Lan",
            "skills": ["Python", "Django", "PostgreSQL", "Docker"],
            "experience_years": 3,
            "totalYearsExperience": 3,
            "education_level": "bachelor",
            "summary": "Mid-level Python developer, chuyên Django. Muốn chuyển sang FastAPI.",
            "expectedSalary": "2000-2500 USD",
            "experience": [
                {"company": "Tiki", "role": "Python Developer", "years": 2, "description": "Phát triển e-commerce backend với Django, PostgreSQL."},
                {"company": "Freelance", "role": "Web Developer", "years": 1, "description": "Xây dựng website cho SME, Django + Bootstrap."},
            ],
            "education": [
                {"school": "Đại học Công nghệ - ĐHQG Hà Nội", "major": "Công nghệ Thông tin", "degree": "bachelor", "year": 2021},
            ],
            "languages": [{"language": "Vietnamese", "level": "Native"}, {"language": "English", "level": "Intermediate"}],
            "insight": {
                "strengths": "Solid Python/Django foundation, familiar with PostgreSQL and Docker.",
                "weaknesses": "No FastAPI experience. Missing Redis and AWS skills required for the role.",
                "recommendation": "Good potential but needs training on FastAPI. Consider for mid-level position.",
            },
        },
    },
    {
        "job_idx": 0,
        "structured_data": {
            "name": "Le Hoang Nam",
            "skills": ["Java", "Spring Boot", "MySQL"],
            "experience_years": 4,
            "totalYearsExperience": 4,
            "education_level": "bachelor",
            "summary": "Java developer muốn chuyển sang Python. Chưa có kinh nghiệm FastAPI.",
            "expectedSalary": "2500-3000 USD",
            "experience": [
                {"company": "Samsung Vietnam", "role": "Java Backend Developer", "years": 3, "description": "Phát triển microservices với Spring Boot, MySQL, Kafka."},
                {"company": "NashTech", "role": "Junior Developer", "years": 1, "description": "Học việc Java, unit testing, code review."},
            ],
            "education": [
                {"school": "Đại học Khoa học Tự nhiên TP.HCM", "major": "Công nghệ Phần mềm", "degree": "bachelor", "year": 2020},
            ],
            "languages": [{"language": "Vietnamese", "level": "Native"}, {"language": "English", "level": "Intermediate"}, {"language": "Korean", "level": "Basic"}],
            "insight": {
                "strengths": "Strong OOP fundamentals, microservices experience, good at system design.",
                "weaknesses": "No Python/FastAPI/PostgreSQL experience. Significant skill gap for this role.",
                "recommendation": "Not a good fit currently. Suggest talent pool for future Python roles after self-study.",
            },
        },
    },
    # Job 1: React Frontend Developer
    {
        "job_idx": 1,
        "structured_data": {
            "name": "Pham Duc Anh",
            "skills": ["React", "TypeScript", "TailwindCSS", "REST API", "Git", "Next.js"],
            "experience_years": 4,
            "totalYearsExperience": 4,
            "education_level": "bachelor",
            "summary": "Frontend developer 4 năm, chuyên React ecosystem.",
            "expectedSalary": "2000-2500 USD",
            "experience": [
                {"company": "Momo", "role": "Senior Frontend Developer", "years": 2, "description": "Phát triển payment dashboard với React + TypeScript. Tối ưu performance, giảm 40% load time."},
                {"company": "Ến Vàng Tech", "role": "Frontend Developer", "years": 2, "description": "Xây dựng SPA với React, TailwindCSS, tích hợp REST API."},
            ],
            "education": [
                {"school": "Đại học FPT", "major": "Software Engineering", "degree": "bachelor", "year": 2020},
            ],
            "languages": [{"language": "Vietnamese", "level": "Native"}, {"language": "English", "level": "Professional"}],
            "insight": {
                "strengths": "Expert React/TypeScript, performance optimization experience, modern CSS (Tailwind).",
                "weaknesses": "No backend experience. Limited testing knowledge.",
                "recommendation": "Perfect fit for React Frontend role. Can contribute immediately.",
            },
        },
    },
    {
        "job_idx": 1,
        "structured_data": {
            "name": "Vo Minh Thu",
            "skills": ["Vue.js", "JavaScript", "CSS", "Git"],
            "experience_years": 2,
            "totalYearsExperience": 2,
            "education_level": "bachelor",
            "summary": "Junior frontend, chủ yếu Vue.js. Đang học React.",
            "expectedSalary": "1200-1500 USD",
            "experience": [
                {"company": "Startup XYZ", "role": "Frontend Developer", "years": 2, "description": "Phát triển admin panel với Vue.js, Vuetify. Tích hợp API."},
            ],
            "education": [
                {"school": "Đại học Sư phạm Kỹ thuật TP.HCM", "major": "Công nghệ Thông tin", "degree": "bachelor", "year": 2022},
            ],
            "languages": [{"language": "Vietnamese", "level": "Native"}, {"language": "English", "level": "Intermediate"}],
            "insight": {
                "strengths": "Good JavaScript fundamentals, familiar with component-based architecture.",
                "weaknesses": "No React/TypeScript/TailwindCSS experience. Only Vue.js background.",
                "recommendation": "Needs significant ramp-up time for React. Consider if willing to invest in training.",
            },
        },
    },
    # Job 2: DevOps Engineer
    {
        "job_idx": 2,
        "structured_data": {
            "name": "Hoang Quoc Bao",
            "skills": ["AWS", "Docker", "Kubernetes", "Terraform", "CI/CD", "Linux"],
            "experience_years": 6,
            "totalYearsExperience": 6,
            "education_level": "master",
            "summary": "DevOps engineer 6 năm, AWS certified. Quản lý infra cho 3 products.",
            "expectedSalary": "3500-4000 USD",
            "experience": [
                {"company": "Grab Vietnam", "role": "Senior DevOps Engineer", "years": 3, "description": "Quản lý Kubernetes clusters (50+ nodes), Terraform IaC, CI/CD pipelines cho 10 teams."},
                {"company": "VNPay", "role": "DevOps Engineer", "years": 2, "description": "Setup AWS infrastructure, Docker containerization, monitoring với Prometheus + Grafana."},
                {"company": "FPT Software", "role": "System Admin", "years": 1, "description": "Linux server management, basic scripting, backup automation."},
            ],
            "education": [
                {"school": "Đại học Bách Khoa Hà Nội", "major": "Kỹ thuật Máy tính", "degree": "master", "year": 2018},
            ],
            "languages": [{"language": "Vietnamese", "level": "Native"}, {"language": "English", "level": "Professional"}, {"language": "Japanese", "level": "N3"}],
            "insight": {
                "strengths": "AWS certified, extensive K8s + Terraform experience, proven at scale (Grab). Strong leadership.",
                "weaknesses": "Salary expectation at top of range. May be overqualified for current team size.",
                "recommendation": "Top candidate. Immediate hire recommended. Can architect entire infrastructure.",
            },
        },
    },
    {
        "job_idx": 2,
        "structured_data": {
            "name": "Dang Thanh Son",
            "skills": ["Docker", "Linux", "CI/CD", "Python"],
            "experience_years": 2,
            "totalYearsExperience": 2,
            "education_level": "bachelor",
            "summary": "Junior DevOps, biết Docker và basic CI/CD. Đang học AWS.",
            "expectedSalary": "1500-2000 USD",
            "experience": [
                {"company": "TMA Solutions", "role": "Junior DevOps", "years": 2, "description": "Setup Docker Compose, Jenkins CI/CD, basic Linux administration."},
            ],
            "education": [
                {"school": "Đại học Tôn Đức Thắng", "major": "Mạng Máy tính", "degree": "bachelor", "year": 2022},
            ],
            "languages": [{"language": "Vietnamese", "level": "Native"}, {"language": "English", "level": "Intermediate"}],
            "insight": {
                "strengths": "Good Docker/Linux foundation, eager to learn, affordable salary range.",
                "weaknesses": "No AWS/Kubernetes/Terraform experience. Missing critical skills for the role.",
                "recommendation": "Too junior for this position. Add to talent pool for future junior DevOps openings.",
            },
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
