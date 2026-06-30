"""Skill map reference data extracted from TechSkill PDFs."""
import json

SKILL_MAPS = {
    "application_engineer": {
        "title_vi": "Nhân viên phát triển phần mềm",
        "title_ja": "アプリケーションエンジニア",
        "domains": [
            "Programming (Backend, Frontend, optimization, error handling, async/multi-thread)",
            "Data Store (SQL, NoSQL, encryption, tuning, backup, cloud services)",
            "Testing (Unit test, testcase design, C0/C1/C2 coverage, performance test)",
            "Architecture (OOP, SOLID, DRY, KISS, loose coupling, domain model, Cloud Native, Microservices)",
            "Server-Middleware (Linux, middleware tuning, version up)",
            "Infrastructure-Network (routing, network, cloud, availability, fault tolerance)",
            "Security (SQL injection, XSS, CSRF, session hijacking, OAuth, SAML)",
            "Frontend (HTML, CSS, JavaScript, ES5+, cross-browser, W3C, UI-Thread)",
            "Requirements Definition (specs creation, client communication)",
            "Schedule Management (project planning, risk management)",
            "Data Analysis (data pipeline, analytics, visualization)",
            "Improvement Proposals (service optimization, market understanding)",
        ],
        "g_criteria": {
            "G0": "Có thể xây dựng trang e-commerce cơ bản (không có thanh toán/bảo mật). SQL cơ bản (SELECT/JOIN). Có thể làm theo tài liệu test. Hiểu OOP cơ bản. Linux cơ bản. Hiểu tại sao bảo mật quan trọng. HTML/CSS/JS cơ bản.",
            "G1": "Có thể code theo specs. Biết chuẩn hoá dữ liệu. Tạo được testcase thông thường. Hiểu mô hình MVC. Có thể giải thích cấu trúc server. Kiến thức mạng cơ bản. Xử lý validation/escape. Hoàn thành công việc với hướng dẫn lịch trình.",
            "G2": "Xem xét reusability, retry, xử lý lỗi. Sử dụng được nhiều loại data store. Viết unit test (C0/C1/C2). Áp dụng SOLID/DRY/KISS. Sử dụng middleware trên Linux. Biết troubleshoot mạng. Review code về bảo mật. Tự tạo lịch trình phù hợp team. Phân tích dữ liệu cho project của mình. Đề xuất cải tiến cho 1 trang/tính năng.",
            "G3": "Tối ưu memory/API call, output logging để debug. Thiết kế data store (physical+logical). Review specs về bảo mật và yêu cầu phi chức năng. Kiến trúc loose coupling. Phân tích hiệu năng server/middleware. Đề xuất cải tiến hạ tầng. Thiết kế auth an toàn (authentication vs authorization). Quản lý cross-browser, hiểu ES5+. Tạo requirements từ nhu cầu khách hàng. Lập lịch dự án có quản lý rủi ro. Đề xuất giải pháp cho thành công dự án.",
            "G4": "Lập trình async/multi-thread. Mã hoá, tuning, backup, fault tolerance. Tạo test plan cho dự án lớn. Domain model + Cloud Native design. Đánh giá và tune hiệu năng server/middleware. Thiết kế hạ tầng đảm bảo availability/maintainability/cost. Hiểu OAuth/SAML, thiết kế bảo mật toàn hệ thống web. JIT optimization, UI-Thread mastery. Xác định requirements trong budget. Lập lịch toàn dự án với phối hợp team. Thiết kế data pipeline. Đề xuất giải pháp cho toàn service.",
            "G5": "Thiết kế kiến trúc bền vững đáp ứng cả yêu cầu kỹ thuật và kinh doanh. Quản lý toàn bộ lifecycle data store. Dẫn dắt chiến lược QA. Quyết định Serverless/Microservices/DDD/Clean architecture. Xây dựng hạ tầng tối ưu bền vững. Thiết kế recovery flow. Review và hướng dẫn người khác về bảo mật. Tuning hiệu năng cross-platform. Đề xuất chiến lược dài hạn. Dẫn dắt phân tích dữ liệu across nhiều dự án.",
            "G6": "Dẫn dắt đổi mới kinh doanh, tạo giá trị mới cho toàn công ty.",
        },
        "g_criteria_en": {
            "G0": "Can build basic e-commerce page (no payment/security). Basic SQL (SELECT/JOIN). Can follow test docs. Basic OOP. Basic Linux. Understands why security matters. Basic HTML/CSS/JS.",
            "G1": "Can code to specs. Knows data normalization. Creates testcases. Understands MVC. Can explain server structure. Basic networking. Handles validation/escape. Completes tasks with schedule guidance.",
            "G2": "Considers reusability, retry, error handling. Uses multiple data stores. Writes unit tests (C0/C1/C2). Applies SOLID/DRY/KISS. Uses middleware on Linux. Network troubleshooting. Reviews code for security. Creates own schedule aligned with team. Analyzes data for own projects. Proposes improvements.",
            "G3": "Optimizes memory/API calls, logging for debugging. Designs data store (physical+logical). Reviews specs for security & non-functional requirements. Loose coupling architecture. Analyzes server/middleware performance. Proposes infra improvements. Designs secure auth. Manages cross-browser, ES5+. Creates requirements from client needs. Project scheduling with risk management.",
            "G4": "Async/multi-thread programming. Encryption, tuning, backup, fault tolerance. Test plans for large projects. Domain model + Cloud Native. Tunes server/middleware performance. Designs infra for availability/cost. OAuth/SAML, full web security. JIT optimization, UI-Thread. Defines requirements within budget. Full project scheduling. Data pipeline design.",
            "G5": "Future-proof architecture for technical and business needs. Full data store lifecycle management. Leads QA strategy. Serverless/Microservices/DDD/Clean architecture decisions. Sustainable optimization infra. Recovery flow design. Guides others on security. Cross-platform performance tuning. Long-term strategic proposals.",
            "G6": "Drives business innovation creating new value across the company.",
        },
        "key_skills": ["Python", "JavaScript", "TypeScript", "React", "Node.js", "SQL", "PostgreSQL", "Docker", "AWS", "Linux", "CI/CD", "Git", "REST API", "Microservices"],
    },
    "bridge_se": {
        "title_vi": "Kỹ sư cầu nối",
        "title_ja": "ブリッジSE",
        "domains": [
            "Project coordination & facilitation (schedule management, resource planning)",
            "Communication (Japanese-Vietnamese bridge, stakeholder alignment)",
            "Technical understanding (specs review, system design comprehension)",
            "Quality control (review process, issue escalation)",
            "Requirements analysis (business requirements, specs documentation)",
            "Risk management & problem solving",
        ],
        "key_skills": ["Japanese (JLPT N2+)", "Project Management", "Agile/Scrum", "Technical Documentation", "Communication", "JIRA", "Confluence", "System Design", "Business Analysis"],
    },
    "qa_engineer": {
        "title_vi": "Nhân viên kiểm soát chất lượng",
        "title_ja": "QAエンジニア",
        "domains": [
            "Test Planning (test strategy, scope, risk analysis, estimation)",
            "Test Case Design (equivalence partitioning, boundary value, condition coverage)",
            "Application Design Review (specs review, quality gate)",
            "Test Execution (functional test, integration test, regression test)",
            "Automation (test automation frameworks, CI integration)",
            "Performance Testing & Security Testing",
            "Bug Management & Reporting",
            "Quality Metrics & Process Improvement",
        ],
        "key_skills": ["Test Planning", "Test Automation", "Selenium", "Playwright", "API Testing", "Performance Testing", "SQL", "JIRA", "Agile Testing", "CI/CD", "Python", "Java"],
    },
    "admin": {
        "title_vi": "Nhân viên hành chính",
        "title_ja": "管理スタッフ",
        "domains": [
            "Labor procedures (onboarding, offboarding)",
            "External coordination (vendors, government agencies)",
            "Procurement & asset management",
            "Internal regulations & legal compliance",
            "Legal document drafting (ERC, IRC)",
            "Payroll accounting & mandatory insurance",
            "HR recruitment & personnel system",
        ],
        "key_skills": ["Office Administration", "MS Office", "ERP Systems", "Labor Law", "Procurement", "Asset Management", "Communication", "Document Management"],
    },
    "hr": {
        "title_vi": "Nhân viên nhân sự",
        "title_ja": "人事スタッフ",
        "domains": [
            "Confidential information & security management",
            "Labor procedures (onboarding, offboarding, contracts)",
            "External coordination (vendors, agencies, government)",
            "Cost reduction & budget management",
            "Internal regulations & legal compliance",
            "Recruitment & talent acquisition",
            "Performance management & evaluation",
            "Training & development",
        ],
        "key_skills": ["Recruitment", "Labor Law", "HRIS", "Payroll", "Training & Development", "Performance Management", "Employee Relations", "MS Office", "Communication"],
    },
}


def get_skill_map_context(category: str) -> str:
    """Return formatted skill map context for AI prompt."""
    data = SKILL_MAPS.get(category)
    if not data:
        return ""
    domains = "\n".join(f"  - {d}" for d in data["domains"])
    skills = ", ".join(data["key_skills"])
    return f"""
Position category: {data['title_vi']}
Key skill domains:
{domains}
Typical skills/tools: {skills}
"""


def get_all_skill_maps_summary() -> str:
    """Return a summary of all skill maps for level assessment."""
    parts = []
    for key, data in SKILL_MAPS.items():
        skills = ", ".join(data["key_skills"])
        parts.append(f"- {key} ({data['title_vi']}): Key skills = {skills}")
    return "\n".join(parts)


SKILL_LEVEL_PROMPT = """You are a strict HR assessor at LIFULL Tech Vietnam. Assess candidate skill level based on Technical Skill Maps.

STEP 1 — DETERMINE CATEGORY:
{categories}

Category rules:
- "application_engineer": Programming skills (Python, Java, JS, React, etc.), builds software
- "bridge_se": Japanese (JLPT N2+), JP-VN coordination, project management
- "qa_engineer": Testing, test automation, QA processes
- "admin": Office admin, procurement, asset management (NOT recruitment)
- "hr": Recruitment, labor law, payroll, training, employee relations
- "accounting": Accounting, financial reporting, bookkeeping

STEP 2 — SCORE EACH SKILL:
Below is the FULL Skill Map for the matched category with criteria for each G-level.
The skill map is structured as a table: each ROW is a skill domain, each COLUMN is a G-level (G0-G6).
You MUST score ONLY the skill domains listed in the skill map (e.g., Programming, Data Store, Testing, Architecture, etc.)
Do NOT invent your own skill names. Use EXACTLY the skill names from the map.

For EACH skill domain in the map, score the candidate:
- 0 points: No evidence the candidate meets the criteria at current level
- 3 points: Candidate meets the criteria described for THIS level
- 5 points: Candidate exceeds and meets criteria of the NEXT level

{skill_map_text}

STEP 3 — DETERMINE G-LEVEL using this STRICT scoring rule:
Starting from G0, check each level:
- Count how many skill domains have criteria at this level (some levels have fewer skills with criteria)
- If this level has FEWER than 10 skills with criteria: candidate MUST score >= 3 on ALL of them to advance
- If this level has 10 OR MORE skills with criteria: candidate needs >= 10 skills scored >= 3 AND total points >= 26 to advance
- G-level = the HIGHEST level where advancement criteria are MET
- If candidate does NOT meet G0 advancement criteria → G-level is G0

Example: G0 has 6 skills with criteria. If candidate only scores 3+ on 4 out of 6 → stays at G0 (NOT G1).

STRICT RULES:
- "Senior" title does NOT equal high G — G-level requires evidence across MULTIPLE skills
- Listing skills without evidence of USE = 0 points
- Internship < 6 months with only "studied/learned" language = 0 points for that skill
- Years alone mean nothing without verifiable skill depth

Candidate:
- Skills: {skills}
- Experience: {experience_years} years
- Roles: {roles}
- Education: {education}

Respond EXACTLY in this format:
CATEGORY: <application_engineer|bridge_se|qa_engineer|admin|hr|accounting>
SCORES: <skill_name:score, skill_name:score, ...> (score EVERY skill domain from the skill map at G0 and G1 level. Use the EXACT skill names from the map. Score 0, 3, or 5 for each.)
REASON_EN: <5-7 sentences explaining evidence for each score>
REASON_VI: <Dịch REASON_EN sang tiếng Việt>"""


def _load_skill_map_json() -> dict:
    """Load skill map data from JSON config file."""
    import os
    config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config", "skill_maps.json")
    if os.path.exists(config_path):
        with open(config_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def _get_skill_map_for_category(category: str) -> str:
    """Get the full skill map text for a category from JSON config."""
    data = _load_skill_map_json()
    cat_data = data.get(category, {})
    raw_text = cat_data.get("raw_text", "")
    if raw_text:
        # Truncate to fit in prompt (keep first 4000 chars which covers G0-G3 criteria)
        return raw_text[:4000]
    # Fallback to hardcoded if no JSON
    cat_data_old = SKILL_MAPS.get(category, {})
    if "g_criteria" in cat_data_old:
        return "\n".join(f"- {k}: {v}" for k, v in cat_data_old["g_criteria"].items())
    return ""


def assess_skill_level(candidate_data: dict, candidate_id: str | None = None, job_category: str | None = None) -> dict | None:
    """Assess candidate skill level using AI + skill maps with point-based scoring.
    
    Scoring rules:
    - Each skill: 0-5 points (3 = meets current level, 5 = exceeds to next level)
    - Advance G-level when:
      - If < 10 skills at level: ALL skills must score >= 3
      - If >= 10 skills at level: >= 10 skills scored AND total >= 26 points
    """
    import json
    import logging
    from app.bedrock import invoke_claude
    from app.config import settings

    logger = logging.getLogger(__name__)

    skills = candidate_data.get("skills", [])
    experience_years = candidate_data.get("experience_years", 0)
    experience = candidate_data.get("experience", [])
    education = candidate_data.get("education", [])

    if not skills:
        return None

    roles = ", ".join(f"{e.get('role_en', '') or e.get('role', '')} @ {e.get('company', '')}" for e in experience[:3]) or "N/A"
    edu_str = ", ".join(f"{e.get('degree_en', '') or e.get('degree', '')} {e.get('major_en', '') or e.get('major', '')} ({e.get('school', '')})" for e in education[:2]) or "N/A"

    # Determine target category
    target_cat = job_category if (job_category and job_category in SKILL_MAPS) else None
    if not target_cat:
        for cat_key, cat_data in SKILL_MAPS.items():
            if "key_skills" not in cat_data:
                continue
            cat_skills_lower = {s.lower() for s in cat_data["key_skills"]}
            candidate_skills_lower = {s.lower() for s in skills[:15]}
            if len(cat_skills_lower & candidate_skills_lower) >= 2:
                target_cat = cat_key
                break
    if not target_cat:
        target_cat = "application_engineer"

    # Get full skill map text for the category
    skill_map_text = _get_skill_map_for_category(target_cat)

    prompt = SKILL_LEVEL_PROMPT.format(
        categories=get_all_skill_maps_summary(),
        skills=", ".join(skills[:15]),
        experience_years=experience_years,
        roles=roles,
        education=edu_str,
        skill_map_text=skill_map_text,
    )

    try:
        result = invoke_claude(prompt, model=settings.BEDROCK_MODEL_HAIKU, max_tokens=2000, feature="skill_level", candidate_id=candidate_id)
        category = ""
        reason_vi = ""
        reason_en = ""
        scores_str = ""
        for line in result.strip().split("\n"):
            if line.startswith("CATEGORY:"):
                category = line.replace("CATEGORY:", "").strip()
            elif line.startswith("SCORES:"):
                scores_str = line.replace("SCORES:", "").strip()
            elif line.startswith("REASON_EN:"):
                reason_en = line.replace("REASON_EN:", "").strip()
            elif line.startswith("REASON_VI:"):
                reason_vi = line.replace("REASON_VI:", "").strip()
            elif line.startswith("REASON:"):
                reason_en = line.replace("REASON:", "").strip()

        # Parse scores
        skill_scores = {}
        if scores_str:
            for pair in scores_str.split(","):
                pair = pair.strip()
                if ":" in pair:
                    name, score = pair.rsplit(":", 1)
                    try:
                        skill_scores[name.strip()] = int(score.strip())
                    except ValueError:
                        pass

        if not category:
            category = target_cat

        # Calculate G-level from scores using the advancement rules
        # Rule: if < 10 skills at level → need ALL >= 3; if >= 10 → need >= 10 skills AND total >= 26
        skills_passing = sum(1 for s in skill_scores.values() if s >= 3)
        total_points = sum(skill_scores.values())
        total_skills = len(skill_scores)

        if total_skills < 10:
            # Less than 10 skills: need ALL to be >= 3 to advance from G0
            if skills_passing >= total_skills and total_skills > 0:
                level = "G1"
            else:
                level = "G0"
        else:
            # 10+ skills: need >= 10 passing AND total >= 26
            if skills_passing >= 10 and total_points >= 26:
                level = "G1"  # Passed G0, now at G1
            else:
                level = "G0"

        # For higher levels, we'd need to re-score at each level
        # For now, if passed G0→G1, check if we can go higher based on total score
        if level == "G1" and total_points >= 40:
            level = "G2"
        if level == "G2" and total_points >= 50:
            level = "G3"

        total_str = f"{total_points}/{total_skills * 5} ({skills_passing} skills scored >= 3)"

        # Always ensure VI exists - translate from EN if missing/short
        if reason_en and len(reason_vi.strip()) < 20:
            import time
            for attempt in range(3):
                try:
                    vi_r = invoke_claude(
                        f"Translate to Vietnamese. Output ONLY the translation, nothing else:\n{reason_en}",
                        model=settings.BEDROCK_MODEL_HAIKU, max_tokens=400, feature="skill_level", candidate_id=candidate_id
                    )
                    reason_vi = vi_r.strip().split("\n\n")[0].strip()
                    if len(reason_vi) >= 20:
                        break
                except Exception:
                    if attempt < 2:
                        time.sleep(2 * (attempt + 1))
                    else:
                        reason_vi = reason_en

        if level and category:
            # Enrich with description
            cat_data = SKILL_MAPS.get(category, {})
            level_desc_vi = cat_data.get("g_criteria", {}).get(level, "")
            level_desc_en = cat_data.get("g_criteria_en", {}).get(level, "")
            category_title_vi = cat_data.get("title_vi", category)
            category_titles = {"vi": category_title_vi, "en": category.replace("_", " ").title(), "ja": cat_data.get("title_ja", category_title_vi)}
            domains = cat_data.get("domains", [])
            return {
                "category": category,
                "level": level,
                "reason": {"vi": reason_vi, "en": reason_en},
                "scores": skill_scores,
                "total": total_str,
                "level_description": {"vi": level_desc_vi, "en": level_desc_en},
                "category_title": category_titles,
                "domains": domains,
            }
    except Exception as e:
        logger.warning(f"Skill level assessment failed: {e}")
    return None
