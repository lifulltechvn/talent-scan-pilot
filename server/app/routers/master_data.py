"""Master data endpoint — skills, locations, salary ranges. Editable from Settings."""
import json as json_mod

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import User

router = APIRouter(prefix="/master-data", tags=["master-data"])

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
    # Get custom config from DB
    try:
        custom = await db.execute(text("SELECT key, value FROM master_config WHERE key IN ('locations', 'salary_ranges')"))
        custom_map = {row[0]: json_mod.loads(row[1]) for row in custom.all()}
    except Exception:
        custom_map = {}

    locations = custom_map.get('locations', [])
    salary_ranges = custom_map.get('salary_ranges', [])

    # Aggregate skills
    job_skills = await db.execute(text("SELECT DISTINCT jsonb_array_elements_text(required_skills) AS skill FROM jobs"))
    cand_skills = await db.execute(text("SELECT DISTINCT jsonb_array_elements_text(structured_data->'skills') AS skill FROM candidates WHERE structured_data->'skills' IS NOT NULL"))
    db_skills = {row[0] for row in job_skills.all()} | {row[0] for row in cand_skills.all()}
    all_skills = sorted(set(DEFAULT_SKILLS) | db_skills)

    # Merge DB locations/salaries
    loc_result = await db.execute(text("SELECT DISTINCT location FROM jobs WHERE location IS NOT NULL AND location != ''"))
    all_locations = list(dict.fromkeys(locations + [row[0] for row in loc_result.all()]))

    sal_result = await db.execute(text("SELECT DISTINCT salary_range FROM jobs WHERE salary_range IS NOT NULL AND salary_range != ''"))
    all_salaries = list(dict.fromkeys(salary_ranges + [row[0] for row in sal_result.all()]))

    return {"skills": all_skills, "locations": all_locations, "salary_ranges": all_salaries}


class MasterConfigUpdate(BaseModel):
    locations: list[str] | None = None
    salary_ranges: list[str] | None = None


@router.put("")
async def update_master_config(
    body: MasterConfigUpdate,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Update location/salary config from Settings."""
    if body.locations is not None:
        await db.execute(text("INSERT INTO master_config (key, value) VALUES ('locations', :v) ON CONFLICT (key) DO UPDATE SET value = :v"), {"v": json_mod.dumps(body.locations)})
    if body.salary_ranges is not None:
        await db.execute(text("INSERT INTO master_config (key, value) VALUES ('salary_ranges', :v) ON CONFLICT (key) DO UPDATE SET value = :v"), {"v": json_mod.dumps(body.salary_ranges)})
    await db.commit()
    return {"status": "updated"}
