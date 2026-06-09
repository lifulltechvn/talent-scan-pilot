"""Master data endpoint — skills, locations, salary ranges."""

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import User

router = APIRouter(prefix="/master-data", tags=["master-data"])

DEFAULT_LOCATIONS = [
    "Ho Chi Minh City", "Ha Noi", "Da Nang", "Remote", "Hybrid",
]

DEFAULT_SALARY_RANGES = [
    "8-12M VND", "12-18M VND", "18-25M VND", "25-35M VND",
    "35-50M VND", "50-70M VND", "70M+ VND", "Negotiable",
]

DEFAULT_SKILLS = [
    "Python", "JavaScript", "TypeScript", "Java", "PHP", "Go", "Rust", "C#",
    "React", "Vue.js", "Angular", "Next.js", "Node.js", "Express",
    "FastAPI", "Django", "Laravel", "Spring Boot", ".NET",
    "PostgreSQL", "MySQL", "MongoDB", "Redis", "Elasticsearch",
    "Docker", "Kubernetes", "AWS", "GCP", "Azure", "CI/CD",
    "Git", "REST API", "GraphQL", "Microservices",
    "Tailwind CSS", "HTML/CSS", "Figma", "UI/UX",
    "Machine Learning", "Data Science", "NLP",
]


@router.get("")
async def get_master_data(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    # Aggregate skills from existing jobs + candidates
    job_skills = await db.execute(text(
        "SELECT DISTINCT jsonb_array_elements_text(required_skills) AS skill FROM jobs"
    ))
    cand_skills = await db.execute(text(
        "SELECT DISTINCT jsonb_array_elements_text(structured_data->'skills') AS skill FROM candidates WHERE structured_data->'skills' IS NOT NULL"
    ))

    db_skills = {row[0] for row in job_skills.all()} | {row[0] for row in cand_skills.all()}
    all_skills = sorted(set(DEFAULT_SKILLS) | db_skills)

    # Aggregate locations from existing jobs
    loc_result = await db.execute(text("SELECT DISTINCT location FROM jobs WHERE location IS NOT NULL AND location != ''"))
    db_locations = [row[0] for row in loc_result.all()]
    all_locations = list(dict.fromkeys(DEFAULT_LOCATIONS + db_locations))  # preserve order, deduplicate

    # Aggregate salary ranges
    sal_result = await db.execute(text("SELECT DISTINCT salary_range FROM jobs WHERE salary_range IS NOT NULL AND salary_range != ''"))
    db_salaries = [row[0] for row in sal_result.all()]
    all_salaries = list(dict.fromkeys(DEFAULT_SALARY_RANGES + db_salaries))

    return {
        "skills": all_skills,
        "locations": all_locations,
        "salary_ranges": all_salaries,
    }
