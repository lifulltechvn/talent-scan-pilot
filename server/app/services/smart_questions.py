"""Smart Interview Questions — generate + translate + cache."""
import json
import logging
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.bedrock import invoke_claude

logger = logging.getLogger(__name__)

CATEGORIES = [
    ("technical_core", 3),
    ("problem_solving", 2),
    ("experience_validation", 2),
    ("culture_fit", 1),
]


def _classify_level(experience_years: int) -> str:
    if experience_years < 2:
        return "junior"
    elif experience_years < 5:
        return "mid"
    return "senior"


async def get_or_create_question_set(db: AsyncSession, job_id: str, job_skills: list, job_title: str, round_num: int, candidate_exp_years: int, locale: str = "en", job_category: str | None = None) -> dict:
    """Get cached question set or generate new one. Returns {id, questions, locale}."""
    level = _classify_level(candidate_exp_years)

    # 1. Check cache
    row = await db.execute(text("""
        SELECT id, questions_en, translations FROM interview_question_sets
        WHERE job_id = :jid AND round = :r AND level = :l AND is_template = true
        ORDER BY created_at DESC LIMIT 1
    """), {"jid": job_id, "r": round_num, "l": level})
    existing = row.mappings().first()

    if existing:
        await db.execute(text("UPDATE interview_question_sets SET usage_count = usage_count + 1 WHERE id = :id"), {"id": str(existing["id"])})
        await db.commit()
        questions = _get_localized(existing, locale)
        return {"id": str(existing["id"]), "questions": questions, "locale": locale, "cached": True}

    # 2. Generate
    questions_en = await _generate_questions(job_skills, job_title, level, round_num, job_category)
    if not questions_en:
        return None

    # 3. Always translate to VI (pre-cache both languages)
    translations = {}
    translated_vi = await _translate_questions(questions_en, "vi")
    if translated_vi:
        translations["vi"] = translated_vi

    # 4. Save
    result = await db.execute(text("""
        INSERT INTO interview_question_sets (job_id, round, level, num_questions, questions_en, translations, usage_count)
        VALUES (:jid, :r, :l, :n, :q, :t, 1) RETURNING id
    """), {"jid": job_id, "r": round_num, "l": level, "n": len(questions_en), "q": json.dumps(questions_en), "t": json.dumps(translations)})
    set_id = str(result.scalar())
    await db.commit()

    questions = translations.get(locale, questions_en)
    return {"id": set_id, "questions": questions, "locale": locale, "cached": False}


def _get_localized(row, locale: str) -> list:
    if locale == "en":
        return row["questions_en"] if isinstance(row["questions_en"], list) else json.loads(row["questions_en"])
    translations = row["translations"] if isinstance(row["translations"], dict) else json.loads(row["translations"] or "{}")
    if locale in translations:
        return translations[locale]
    return row["questions_en"] if isinstance(row["questions_en"], list) else json.loads(row["questions_en"])


async def ensure_translation(db: AsyncSession, set_id: str, locale: str) -> list | None:
    """Ensure a translation exists for the given locale. Returns translated questions."""
    row = await db.execute(text("SELECT questions_en, translations FROM interview_question_sets WHERE id = :id"), {"id": set_id})
    data = row.mappings().first()
    if not data:
        return None

    translations = data["translations"] if isinstance(data["translations"], dict) else json.loads(data["translations"] or "{}")
    if locale in translations:
        return translations[locale]

    questions_en = data["questions_en"] if isinstance(data["questions_en"], list) else json.loads(data["questions_en"])
    translated = await _translate_questions(questions_en, locale)
    if translated:
        translations[locale] = translated
        await db.execute(text("UPDATE interview_question_sets SET translations = :t WHERE id = :id"), {"t": json.dumps(translations), "id": set_id})
        await db.commit()
        return translated
    return questions_en  # fallback EN


async def _generate_questions(skills: list, job_title: str, level: str, round_num: int, job_category: str | None = None) -> list | None:
    """Generate interview questions in English via Claude Haiku, aligned with skill maps."""
    from app.skill_maps import SKILL_MAPS

    category_desc = {
        1: "Technical Core (test depth of knowledge), Problem Solving (real scenarios), Experience Validation (verify CV claims), Culture Fit (teamwork, communication)",
        2: "Culture Fit focused: leadership, conflict resolution, growth mindset, team collaboration. Plus advanced technical questions.",
        3: "Senior/Management: system design, decision making, strategic thinking, mentoring ability.",
    }
    round_focus = category_desc.get(round_num, category_desc[1])

    # Build skill map context for the prompt
    skill_map_context = ""
    if job_category and job_category in SKILL_MAPS:
        sm = SKILL_MAPS[job_category]
        domains = "\n".join(f"  - {d}" for d in sm["domains"])
        g_criteria = "\n".join(f"  {k}: {v}" for k, v in sm.get("g_criteria", {}).items())
        skill_map_context = f"""
IMPORTANT — Skill Map Assessment Context:
This position is category: {job_category} ({sm['title_vi']})
Skill domains to cover in questions:
{domains}

G-Level criteria (use these to tag each scoring criteria):
{g_criteria}
"""

    prompt = f"""Generate exactly 8 interview questions for a {level}-level candidate applying for "{job_title}".

Required skills: {', '.join(skills[:10])}
Round {round_num} focus: {round_focus}
Candidate level: {level} ({"<2 years" if level == "junior" else "2-5 years" if level == "mid" else "5+ years"} experience)
{skill_map_context}
Rules:
- Questions must be PRACTICAL (real work scenarios), NOT trick questions or algorithm puzzles
- Each question has exactly 5 scoring criteria, ordered from basic to advanced
- CRITICAL: Each criteria MUST include a "g_level" field (G0, G1, G2, G3, or G4) indicating what G-level that criteria demonstrates
  - Criteria 1-2: typically G0-G1 level (basic understanding)
  - Criteria 3: typically G2 level (applied knowledge, reusability, self-management)
  - Criteria 4: typically G3 level (optimization, cross-domain, architecture decisions)
  - Criteria 5: typically G4 level (advanced design, system-wide thinking)
- The g_level tagging should be HIDDEN from the interviewer — it's for system assessment only
- Questions should cover different skill domains from the skill map above
- Include red_flags (signs of weak candidate) and follow_up (bonus probe question)
- Categories: 3 technical_core + 2 problem_solving + 2 experience_validation + 1 culture_fit

Return JSON array:
[{{
  "id": 1,
  "category": "technical_core",
  "skill": "React",
  "question": "...",
  "criteria": [
    {{"id": "c1", "description": "...", "point": 1, "g_level": "G0"}},
    {{"id": "c2", "description": "...", "point": 1, "g_level": "G1"}},
    {{"id": "c3", "description": "...", "point": 1, "g_level": "G2"}},
    {{"id": "c4", "description": "...", "point": 1, "g_level": "G3"}},
    {{"id": "c5", "description": "...", "point": 1, "g_level": "G4"}}
  ],
  "max_score": 5,
  "red_flags": "...",
  "follow_up": "..."
}}]

Return ONLY the JSON array, no markdown."""

    try:
        response = invoke_claude(prompt, max_tokens=4096, temperature=0.3, feature="question_gen")
        # Parse JSON from response
        text_resp = response.strip()
        if text_resp.startswith("```"):
            text_resp = text_resp.split("\n", 1)[1].rsplit("```", 1)[0]
        return json.loads(text_resp)
    except Exception as e:
        logger.error(f"Question generation failed: {e}")
        return None



def assess_g_level(questions: list, scores: list) -> dict:
    """Calculate G-level from scored criteria. Returns {g_level, breakdown, confidence}."""
    # Count checked criteria per G-level
    g_counts = {"G0": 0, "G1": 0, "G2": 0, "G3": 0, "G4": 0}
    g_totals = {"G0": 0, "G1": 0, "G2": 0, "G3": 0, "G4": 0}

    for q in questions:
        score_item = next((s for s in scores if s.get("question_id") == q["id"]), None)
        if not score_item:
            continue
        checked = score_item.get("checked", [])
        for idx, c in enumerate(q.get("criteria", [])):
            g = c.get("g_level", "G1")  # default G1 if no tag
            if g in g_totals:
                g_totals[g] += 1
                if idx < len(checked) and checked[idx]:
                    g_counts[g] += 1

    # Determine G-level: highest level where ≥50% criteria are passed
    assessed_level = "G0"
    breakdown = {}
    for g in ["G0", "G1", "G2", "G3", "G4"]:
        total = g_totals[g]
        passed = g_counts[g]
        pct = round(passed / total * 100) if total > 0 else 0
        breakdown[g] = {"passed": passed, "total": total, "percentage": pct}
        if total > 0 and passed / total >= 0.5:
            assessed_level = g

    # Confidence based on how many criteria were actually evaluated
    total_evaluated = sum(g_totals.values())
    total_checked = sum(g_counts.values())
    confidence = round(total_checked / total_evaluated * 100) if total_evaluated > 0 else 0

    return {"g_level": assessed_level, "breakdown": breakdown, "confidence": confidence}

async def _translate_questions(questions_en: list, target_locale: str) -> list | None:
    """Translate questions to target language."""
    locale_names = {"vi": "Vietnamese", "ja": "Japanese", "ko": "Korean", "zh": "Chinese"}
    lang_name = locale_names.get(target_locale, target_locale)

    prompt = f"""Translate these interview questions to {lang_name}. Keep technical terms in English where natural.
Translate: question, criteria descriptions, red_flags, follow_up fields.
Keep: id, category, skill, point values, max_score unchanged.

Input:
{json.dumps(questions_en, ensure_ascii=False)}

Return ONLY the translated JSON array, same structure. No markdown."""

    try:
        response = invoke_claude(prompt, max_tokens=6000, temperature=0.1, feature="question_translate")
        text_resp = response.strip()
        if text_resp.startswith("```"):
            text_resp = text_resp.split("\n", 1)[1].rsplit("```", 1)[0]
        return json.loads(text_resp)
    except Exception as e:
        logger.error(f"Question translation failed: {e}")
        return None
