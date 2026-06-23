"""Skill map reference data extracted from TechSkill PDFs."""

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

STEP 2 — ASSESS LEVEL:
You MUST evaluate the candidate against EACH domain of the matched category's skill map.
The final G-level = the OVERALL level where the candidate meets MOST criteria.
If the candidate only excels in 2-3 domains but lacks others, they CANNOT be rated at a high G.

{category_instruction}

STRICT RULES:
- To reach G3, candidate MUST show evidence in at least 7-8 of the 12 domains (Programming, Data Store, Testing, Architecture, Server/Middleware, Infra/Network, Security, Frontend, Requirements, Schedule, Data Analysis, Improvement)
- To reach G2, must show evidence in at least 4-5 domains with concrete depth
- To reach G1, must show 2-3 domains with basic competence
- A backend-only dev (even Senior title) with no Testing/Security/Architecture/Frontend evidence → G2 max
- A frontend-only dev with no Backend/Data Store/Security/Infra evidence → G2 max
- A specialist (ML/Data/Mobile only) covering 2-3 domains deeply → G2 max unless also shows breadth
- "Senior" title at a company does NOT equal G3 — G3 requires BREADTH across domains, not just depth in one area
- Most developers are G1-G2. G3+ is rare and requires demonstrable multi-domain expertise

DATA QUALITY:
- No specific technologies (only "Programming", "Teamwork") → MAX G0
- All companies UNKNOWN → MAX G0
- Years alone mean nothing without verifiable skill depth

Candidate:
- Skills: {skills}
- Experience: {experience_years} years
- Roles: {roles}
- Education: {education}

Respond EXACTLY (4 lines):
CATEGORY: <application_engineer|bridge_se|qa_engineer|admin|hr>
LEVEL: <G0|G1|G2|G3|G4|G5|G6>
REASON_VI: <2-3 câu tiếng Việt đầy đủ, chuyên nghiệp>
REASON_EN: <2-3 complete sentences in English>"""


def assess_skill_level(candidate_data: dict, candidate_id: str | None = None, job_category: str | None = None) -> dict | None:
    """Assess candidate skill level using AI + skill maps. Returns {category, level, reason} or None.
    If job_category is provided, forces assessment against that specific category."""
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

    if job_category and job_category in SKILL_MAPS:
        category_instruction = f"The candidate is being evaluated for the position category: {job_category} ({SKILL_MAPS[job_category]['title_vi']}). Use ONLY this category for assessment. Set CATEGORY to: {job_category}"
    else:
        category_instruction = "Determine the best matching category based on the candidate's skills and experience."

    # Add G-criteria for better assessment
    criteria_text = ""
    target_cat = job_category if (job_category and job_category in SKILL_MAPS) else None
    if not target_cat:
        # Try to guess category from skills for criteria
        for cat_key, cat_data in SKILL_MAPS.items():
            cat_skills_lower = {s.lower() for s in cat_data["key_skills"]}
            candidate_skills_lower = {s.lower() for s in skills[:15]}
            if len(cat_skills_lower & candidate_skills_lower) >= 2:
                target_cat = cat_key
                break
    if target_cat and "g_criteria" in SKILL_MAPS.get(target_cat, {}):
        g_crit = SKILL_MAPS[target_cat]["g_criteria"]
        criteria_text = f"\nDetailed G-level criteria for {target_cat}:\n" + "\n".join(f"- {k}: {v}" for k, v in g_crit.items())

    prompt = SKILL_LEVEL_PROMPT.format(
        categories=get_all_skill_maps_summary(),
        skills=", ".join(skills[:15]),
        experience_years=experience_years,
        roles=roles,
        education=edu_str,
        category_instruction=category_instruction + criteria_text,
    )

    try:
        result = invoke_claude(prompt, model=settings.BEDROCK_MODEL_HAIKU, max_tokens=500, feature="skill_level", candidate_id=candidate_id)
        category = ""
        level = ""
        reason_vi = ""
        reason_en = ""
        for line in result.strip().split("\n"):
            if line.startswith("CATEGORY:"):
                category = line.replace("CATEGORY:", "").strip()
            elif line.startswith("LEVEL:"):
                level = line.replace("LEVEL:", "").strip()
            elif line.startswith("REASON_VI:"):
                reason_vi = line.replace("REASON_VI:", "").strip()
            elif line.startswith("REASON_EN:"):
                reason_en = line.replace("REASON_EN:", "").strip()
            elif line.startswith("REASON:"):
                reason_vi = line.replace("REASON:", "").strip()
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
                "level_description": {"vi": level_desc_vi, "en": level_desc_en},
                "category_title": category_titles,
                "domains": domains,
            }
    except Exception as e:
        logger.warning(f"Skill level assessment failed: {e}")
    return None
