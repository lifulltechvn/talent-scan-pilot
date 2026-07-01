"""Skill map reference data extracted from TechSkill PDFs.

V2: Full rewrite fixing critical bugs:
- Truncation: removed 4000 char limit, sends full skill map to AI
- Thresholds: proportional per category instead of absolute 40/50
- Added accounting category
- Multi-pass evaluation: scores all levels, not just G0/G1
- Evidence-based scoring with structured output
"""
from __future__ import annotations

import json
import logging
import os

logger = logging.getLogger(__name__)

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
    "accounting": {
        "title_vi": "Nhân viên kế toán",
        "title_ja": "会計スタッフ",
        "domains": [
            "Nghiệp vụ hạch toán kế toán, lập báo cáo tài chính",
            "Nghiệp vụ phát hành hoá đơn, lập báo cáo thuế",
            "Nghiệp vụ quản lý công nợ phải thu phải trả",
            "Nghiệp vụ quản lý chứng từ kế toán",
            "Đối ứng thanh tra thuế, kiểm toán",
            "Kỹ năng khác (ngoại ngữ, phần mềm kế toán)",
        ],
        "g_criteria": {
            "G0": "Hiểu cơ bản về nghiệp vụ với sự trợ giúp. Có thể học hỏi chuẩn mực kế toán. Đọc hiểu báo cáo VAT/PIT. Lập danh sách theo dõi doanh thu. Giúp đỡ lưu chứng từ. Cung cấp dữ liệu theo chỉ thị cấp trên.",
            "G1": "Hạch toán nghiệp vụ phát sinh hàng ngày. Phát hành hoá đơn đúng kỳ hạn, hỗ trợ lập báo cáo thuế. Hiểu và giải thích công nợ. Hiểu cách phân loại chứng từ. Cung cấp dữ liệu cho kiểm toán nội bộ. Sử dụng phần mềm kế toán.",
            "G2": "Xác nhận tính hợp lý chứng từ, phân bổ TSCĐ/CCDC. Lập báo cáo thuế VAT/CIT/PIT đầy đủ. Soát xét chứng từ thanh toán, xây dựng dự toán. Đảm bảo sổ sách đúng thời hạn. Chuẩn bị hồ sơ cho cơ quan thuế. Đọc hiểu tài liệu tiếng Anh.",
            "G3": "Lập BCTC hàng tháng, phân tích số liệu cho Giám đốc. Lập báo cáo quyết toán thuế hàng năm, hoàn thuế VAT. Theo dõi dự toán, thu hồi công nợ. Yêu cầu bộ phận cung cấp hồ sơ. Giải thích số liệu kế toán cho cơ quan thuế/kiểm toán. Liên lạc và báo cáo bằng tiếng Anh.",
            "G4": "Phán đoán và xử lý tất cả nghiệp vụ kế toán. Cập nhật chính sách thuế mới, đảm bảo nghiệp vụ đúng luật. Kiểm tra tính pháp lý hợp đồng. Quản lý đảm bảo bảo mật chứng từ. Phán đoán xử lý phù hợp luật định theo kết quả thanh tra. Trình bày báo cáo mạch lạc trước Giám đốc.",
            "G5": "Soát xét tất cả nghiệp vụ đã hạch toán. Hiểu yêu cầu Công ty mẹ, tạo báo cáo phù hợp. Phân công nhiệm vụ, quản lý tiến độ bộ phận. Hướng dẫn nghiệp vụ cho cấp dưới. Tạo quy tắc và quy trình làm việc. Đề xuất phương pháp phù hợp trước khi nhận điều chỉnh kiểm toán.",
            "G6": "Lập báo cáo dự báo tài chính theo chiến lược kinh doanh. Đề xuất kế hoạch trung dài hạn và chiến lược kế toán tài chính. Phân tích pháp lý thuế/kế toán cho chiến lược kinh doanh mới.",
        },
        "g_criteria_en": {
            "G0": "Basic understanding with assistance. Can learn accounting standards. Reads VAT/PIT reports. Tracks revenue lists. Helps store documents. Provides data per supervisor's instruction.",
            "G1": "Posts daily transactions. Issues invoices on time, assists tax reports. Understands and explains receivables/payables. Classifies documents. Provides data for internal audit. Uses accounting software.",
            "G2": "Verifies document validity, allocates fixed assets. Prepares full VAT/CIT/PIT reports. Reviews payment documents, builds estimates. Ensures books meet deadlines. Prepares files for tax authority. Reads English documents.",
            "G3": "Prepares monthly financial statements, analyzes for Director. Annual tax finalization, VAT refunds. Monitors budget and debt collection. Requests documents from departments. Explains accounting to tax/audit authorities. Reports in English.",
            "G4": "Judges and handles all accounting transactions. Updates tax policies, ensures legal compliance. Reviews contract legality. Manages document confidentiality. Handles audit findings per law. Presents reports clearly to Director.",
            "G5": "Reviews all posted transactions. Understands parent company requirements, creates appropriate reports. Assigns tasks, manages department progress. Guides subordinates. Creates work rules and processes. Proposes solutions before audit adjustments.",
            "G6": "Financial forecasting based on business strategy. Proposes mid/long-term accounting strategy. Analyzes legal tax/accounting aspects for new business strategies.",
        },
        "key_skills": ["Accounting", "Tax", "Financial Reporting", "VAT", "CIT", "PIT", "Bookkeeping", "ERP", "Excel", "Audit", "English"],
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


def _load_skill_map_json() -> dict:
    """Load skill map data from JSON config file."""
    config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config", "skill_maps.json")
    if os.path.exists(config_path):
        with open(config_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def _get_skill_map_for_category(category: str) -> str:
    """Get the full skill map text for a category from JSON config.

    FIX: Previously truncated at 4000 chars which caused only 25-50% of domains
    to be visible to AI, making G2+ assessment IMPOSSIBLE. Now sends full text
    (Claude Haiku supports 200K context, skill maps are max 16K chars = ~5K tokens).
    Truncates at sentence boundary only if exceeding 15000 chars.
    """
    data = _load_skill_map_json()
    cat_data = data.get(category, {})
    raw_text = cat_data.get("raw_text", "")
    if raw_text:
        # Send full text — Claude Haiku handles 200K context easily
        if len(raw_text) <= 15000:
            return raw_text
        # Only truncate extremely long texts, and at line boundary
        truncated = raw_text[:15000]
        last_newline = truncated.rfind('\n')
        if last_newline > 12000:
            return truncated[:last_newline]
        return truncated
    # Fallback to hardcoded g_criteria if no JSON
    cat_data_old = SKILL_MAPS.get(category, {})
    if "g_criteria" in cat_data_old:
        return "\n".join(f"- {k}: {v}" for k, v in cat_data_old["g_criteria"].items())
    return ""


SKILL_LEVEL_PROMPT = """You are a strict HR assessor at LIFULL Tech Vietnam. Assess candidate skill level based on Technical Skill Maps.

STEP 1 — DETERMINE CATEGORY:
{categories}

Category rules:
- "application_engineer": Programming skills (Python, Java, JS, React, etc.), builds software
- "bridge_se": Japanese (JLPT N2+), JP-VN coordination, project management
- "qa_engineer": Testing, test automation, QA processes
- "admin": Office admin, procurement, asset management (NOT recruitment)
- "hr": Recruitment, labor law, payroll, training, employee relations
- "accounting": Accounting, financial reporting, bookkeeping, tax

STEP 2 — SCORE EACH SKILL DOMAIN AT EACH G-LEVEL:
Below is the FULL Skill Map for the matched category. It is structured as a table: each ROW is a skill domain, each COLUMN is a G-level (G0-G6).

You MUST score ONLY the skill domains listed in the skill map.
Do NOT invent your own skill names. Use EXACTLY the domain names from the map.

For EACH skill domain, score the candidate AT G0 level on a scale of 0-9:
- If the skill map has NO criteria/content for a domain at G0 (empty cell), use -1 (skip)
- 0: No evidence at all
- 1-2: Partial evidence, not fully meeting G0 criteria
- 3: Fully meets G0 criteria
- 4-5: Exceeds G0, meets G1 criteria (score 5 = fully meets G1)
- 6-7: Far exceeds, meets G2 criteria (score 7 = fully meets G2)
- 8-9: Meets G3+ criteria (score 9 = fully meets G3)

CRITICAL: Score reflects the HIGHEST level the candidate demonstrates for each domain.
Example: G0 Programming requires "basic e-commerce page". If candidate has 8 years building complex web apps with optimization → they exceed G0 AND G1 AND likely meet G2 → score 7.

IMPORTANT:
- If a domain's cell is EMPTY at G0 in the skill map, score -1
- Score based on EVIDENCE in the CV
- Listing a skill without context of USE = score 1-2
- "Used X in production for Y years" with outcomes = score 4-6
- "Led/architected/optimized X across teams" = score 6-8
- Title alone does NOT guarantee high score — need evidence of DEPTH

{skill_map_text}

STEP 3 — G-LEVEL is calculated by the system from your scores (you don't need to calculate it).

Candidate:
- Skills: {skills}
- Experience: {experience_years} years
- Roles: {roles}
- Experience Details:
{experience_details}
- Education: {education}
- Certifications: {certifications}

Respond EXACTLY in this format (each field on its own line):
CATEGORY: <application_engineer|bridge_se|qa_engineer|admin|hr|accounting>
G0_SCORES: <domain_name:score, domain_name:score, ...> (score every domain at G0, 0-9 scale, or -1 if no criteria)
STRENGTHS_EN: <3-4 specific strengths with evidence from CV>
STRENGTHS_VI: <Same in Vietnamese>
GAPS_EN: <2-3 specific weak areas or missing skills based on skill map>
GAPS_VI: <Same in Vietnamese>
SUMMARY_EN: <2-3 sentences: What level they are, why, and what would bring them to next level>
SUMMARY_VI: <Same in Vietnamese>"""


def _calculate_g_level(skill_scores: dict) -> str:
    """Calculate G-level from domain scores using proportional logic.

    FIX: Previous logic used absolute thresholds (40/50 points) which made G2+
    impossible for categories with fewer domains (accounting max=30, hr max=40).
    New logic uses percentage-based thresholds relative to number of domains.

    Scoring scale: 0-5 per domain where:
      0=no evidence, 1=meets G0, 2=meets G1, 3=meets G2, 4=meets G3, 5=meets G4+

    Level determination (score N+1 = meets G-level N):
      G0: default (cannot demonstrate even basic skills)
      G1: >= 70% domains scored >= 2 (meets G1 criteria)
      G2: >= 70% domains scored >= 3 (meets G2 criteria)
      G3: >= 70% domains scored >= 4 (meets G3 criteria)
      G4: >= 80% domains scored >= 5 (meets G4 criteria)
      G5: >= 90% domains scored >= 5 AND average >= 4.5
    """
    if not skill_scores:
        return "G0"

    total_skills = len(skill_scores)
    scores = list(skill_scores.values())
    avg_score = sum(scores) / total_skills

    def pct_at_or_above(threshold):
        count = sum(1 for s in scores if s >= threshold)
        return count / total_skills

    # Check from highest to lowest
    if avg_score >= 4.5 and pct_at_or_above(5) >= 0.90:
        return "G5"
    if pct_at_or_above(5) >= 0.80:
        return "G4"
    if pct_at_or_above(4) >= 0.70:
        return "G3"
    if pct_at_or_above(3) >= 0.70:
        return "G2"
    if pct_at_or_above(2) >= 0.70:
        return "G1"
    return "G0"


def assess_skill_level(candidate_data: dict, candidate_id: str | None = None, job_category: str | None = None) -> dict | None:
    """Assess candidate skill level using AI + skill maps.

    V2 improvements:
    - Full skill map sent to AI (no truncation)
    - Scoring scale 0-5 covering G0 through G4+
    - Proportional G-level calculation (fair across all categories)
    - Evidence-based assessment
    - AI recommends level, code verifies with proportional rules
    """
    from app.bedrock import invoke_claude
    from app.config import settings

    skills = candidate_data.get("skills", [])
    experience_years = candidate_data.get("experience_years", 0)
    experience = candidate_data.get("experience", [])
    education = candidate_data.get("education", [])

    if not skills:
        return None

    roles = ", ".join(
        f"{e.get('role_en', '') or e.get('role', '')} @ {e.get('company', '')}"
        for e in experience[:5]
    ) or "N/A"
    
    # Build detailed experience text for better assessment
    exp_details = []
    for e in experience[:4]:
        role = e.get('role_en', '') or e.get('role', '')
        company = e.get('company', '')
        duration = e.get('duration', '')
        desc = e.get('description', '') or e.get('description_en', '') or e.get('description_vi', '')
        exp_line = f"- {role} @ {company} ({duration})"
        if desc:
            exp_line += f": {desc[:200]}"
        exp_details.append(exp_line)
    exp_text = "\n".join(exp_details) if exp_details else "N/A"
    
    edu_str = ", ".join(
        f"{e.get('degree_en', '') or e.get('degree', '')} {e.get('major_en', '') or e.get('major', '')} ({e.get('school', '')})"
        for e in education[:3]
    ) or "N/A"
    
    # Include certifications if available
    certs = candidate_data.get("certifications", [])
    certs_str = ", ".join(c.get("name", "") for c in certs[:5]) if certs else "None"

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

    # Get full skill map text for the category (NO truncation)
    skill_map_text = _get_skill_map_for_category(target_cat)

    prompt = SKILL_LEVEL_PROMPT.format(
        categories=get_all_skill_maps_summary(),
        skills=", ".join(skills[:20]),
        experience_years=experience_years,
        roles=roles,
        education=edu_str,
        skill_map_text=skill_map_text,
        experience_details=exp_text,
        certifications=certs_str,
    )

    try:
        result = invoke_claude(
            prompt,
            model=settings.BEDROCK_MODEL_HAIKU,
            max_tokens=3000,
            feature="skill_level",
            candidate_id=candidate_id,
        )

        # Parse response — handle multi-line fields
        category = ""
        ai_level = ""
        reason_vi = ""
        reason_en = ""
        scores_str = ""
        g_level_scores: dict[str, str] = {}
        strengths_en = ""
        strengths_vi = ""
        gaps_en = ""
        gaps_vi = ""
        summary_en = ""
        summary_vi = ""

        # Known field prefixes (order matters for multi-line parsing)
        FIELD_PREFIXES = ["CATEGORY:", "LEVEL:", "G0_SCORES:", "G1_SCORES:", "G2_SCORES:", "G3_SCORES:", "G4_SCORES:", "SCORES:", "STRENGTHS_EN:", "STRENGTHS_VI:", "GAPS_EN:", "GAPS_VI:", "SUMMARY_EN:", "SUMMARY_VI:", "REASON_EN:", "REASON_VI:", "REASON:"]

        # Split into field blocks
        lines = result.strip().split("\n")
        current_field = None
        current_content = []
        fields: dict[str, str] = {}

        for line in lines:
            # Check if this line starts a new field
            matched_prefix = None
            for prefix in FIELD_PREFIXES:
                if line.startswith(prefix):
                    matched_prefix = prefix
                    break

            if matched_prefix:
                # Save previous field
                if current_field:
                    fields[current_field] = " ".join(current_content).strip()
                # Start new field
                current_field = matched_prefix.rstrip(":")
                current_content = [line.replace(matched_prefix, "").strip()]
            elif current_field:
                # Continue current field (multi-line)
                current_content.append(line.strip())

        # Save last field
        if current_field:
            fields[current_field] = " ".join(current_content).strip()

        # Map to variables
        category = fields.get("CATEGORY", "")
        ai_level = fields.get("LEVEL", "")
        g_level_scores["G0"] = fields.get("G0_SCORES", "")
        g_level_scores["G1"] = fields.get("G1_SCORES", "")
        g_level_scores["G2"] = fields.get("G2_SCORES", "")
        g_level_scores["G3"] = fields.get("G3_SCORES", "")
        g_level_scores["G4"] = fields.get("G4_SCORES", "")
        scores_str = fields.get("SCORES", "")
        strengths_en = fields.get("STRENGTHS_EN", "")
        strengths_vi = fields.get("STRENGTHS_VI", "")
        gaps_en = fields.get("GAPS_EN", "")
        gaps_vi = fields.get("GAPS_VI", "")
        summary_en = fields.get("SUMMARY_EN", "")
        summary_vi = fields.get("SUMMARY_VI", "")
        reason_en = fields.get("REASON_EN", "") or fields.get("REASON", "")
        reason_vi = fields.get("REASON_VI", "")

        # Build rich reason from structured fields
        if strengths_en or gaps_en or summary_en:
            parts_en = []
            if summary_en:
                parts_en.append(summary_en)
            if strengths_en:
                parts_en.append(f"✅ Strengths: {strengths_en}")
            if gaps_en:
                parts_en.append(f"⚠️ Gaps: {gaps_en}")
            reason_en = "\n".join(parts_en)

            parts_vi = []
            if summary_vi:
                parts_vi.append(summary_vi)
            if strengths_vi:
                parts_vi.append(f"✅ Điểm mạnh: {strengths_vi}")
            if gaps_vi:
                parts_vi.append(f"⚠️ Thiếu sót: {gaps_vi}")
            reason_vi = "\n".join(parts_vi)

        # Parse G0 scores (0-9 scale, AI scores ALL domains based on overall ability)
        def _parse_scores_line(line: str) -> dict:
            scores = {}
            for pair in line.split(","):
                pair = pair.strip()
                if ":" in pair:
                    name, score_val = pair.rsplit(":", 1)
                    try:
                        s = int(score_val.strip())
                        scores[name.strip()] = max(-1, min(9, s))
                    except ValueError:
                        pass
            return scores

        g0_scores = {}
        if "G0" in g_level_scores:
            g0_scores = _parse_scores_line(g_level_scores["G0"])
        elif scores_str:
            g0_scores = _parse_scores_line(scores_str)

        # Apply experience baseline: senior devs have implicit knowledge not written in CV
        # Only boost domains where candidate has at least some evidence (score >= 1)
        EXPERIENCE_BASELINE = {
            (0, 1): 0,    # 0-1 years: no boost
            (2, 3): 3,    # 2-3 years: at least G0
            (4, 5): 5,    # 4-5 years: at least G1
            (6, 8): 7,    # 6-8 years: at least G2
            (9, 99): 8,   # 9+ years: at least G2-G3
        }
        baseline = 0
        for (low, high), val in EXPERIENCE_BASELINE.items():
            if low <= experience_years <= high:
                baseline = val
                break

        if baseline > 0 and g0_scores:
            for domain in g0_scores:
                score = g0_scores[domain]
                if score >= 3 and score < baseline:  # Meets G0 criteria → full boost
                    g0_scores[domain] = baseline
                elif score >= 1 and score < baseline:  # Partial evidence → boost to baseline - 2
                    g0_scores[domain] = max(score, baseline - 2)

        # Derive higher level scores: score at G(N) = G0_score - 2*N (min 0)
        level_scores = {}
        if g0_scores:
            for g_idx, g in enumerate(["G0", "G1", "G2", "G3", "G4"]):
                derived = {}
                for domain, score in g0_scores.items():
                    if score == -1:
                        derived[domain] = -1
                    else:
                        derived[domain] = max(0, score - 2 * g_idx)
                level_scores[g] = derived

        skill_scores = g0_scores

        if not category:
            category = target_cat

        # Calculate G-level: avg >= 3 at each level to advance (3 = meets criteria)
        # Only count domains that have criteria at this level (from domain_criteria_map)
        G_THRESHOLD = 3.0

        # Load domain criteria map
        _skill_map_data = _load_skill_map_json()
        _criteria_map = _skill_map_data.get(category, {}).get("domain_criteria_map", {})

        if level_scores:
            level = "G0"
            level_avgs = {}
            for g in ["G0", "G1", "G2", "G3", "G4"]:
                scores_at_level = level_scores.get(g, {})
                if not scores_at_level:
                    break

                # Filter: only domains that have criteria at this G-level
                applicable = {}
                for domain, score in scores_at_level.items():
                    # Check criteria map - normalize domain name
                    domain_normalized = domain.replace("_", " ").replace("-", "-").strip()
                    domain_map = _criteria_map.get(domain, {}) or _criteria_map.get(domain_normalized, {})
                    if not domain_map:
                        for config_domain in _criteria_map:
                            if config_domain.replace("-", " ").replace("_", " ").lower() == domain.replace("-", " ").replace("_", " ").lower():
                                domain_map = _criteria_map[config_domain]
                                break
                    has_criteria = domain_map.get(g, True) if domain_map else True
                    if has_criteria and score >= 0:
                        applicable[domain] = score

                if len(applicable) < 2:
                    break

                avg = sum(applicable.values()) / len(applicable)
                level_avgs[g] = round(avg, 2)
                print(f"[G-CALC] {g}: {len(applicable)} applicable / {len(scores_at_level)} total, avg={avg:.2f}, pass={avg>=G_THRESHOLD}", flush=True)
                if avg >= G_THRESHOLD:
                    g_order = ["G0", "G1", "G2", "G3", "G4", "G5"]
                    g_idx = g_order.index(g)
                    if g_idx + 1 < len(g_order):
                        level = g_order[g_idx + 1]
                else:
                    break
            logger.info(f"G-level calc: avgs={level_avgs}, threshold={G_THRESHOLD}, result={level}")
        else:
            # Fallback to old logic with single scores
            calculated_level = _calculate_g_level(skill_scores)
            g_order = ["G0", "G1", "G2", "G3", "G4", "G5", "G6"]
            ai_idx = g_order.index(ai_level) if ai_level in g_order else -1
            calc_idx = g_order.index(calculated_level) if calculated_level in g_order else 0
            if ai_idx >= 0:
                if calc_idx == 0 and ai_idx > 2:
                    level = "G2"
                else:
                    level = ai_level
            else:
                level = calculated_level
            level_avgs = {}

        # Build total string
        total_skills = len(skill_scores)
        total_points = sum(v for v in skill_scores.values() if v >= 0)
        max_points = total_skills * 9
        avg_score = round(total_points / total_skills, 2) if total_skills > 0 else 0
        level_avgs_str = ", ".join(f"{k}={v}" for k, v in level_avgs.items()) if level_avgs else f"avg={avg_score}"
        total_str = f"{total_points}/{max_points} ({level_avgs_str}, {total_skills} domains)"

        # Ensure Vietnamese reason exists
        if reason_en and len(reason_vi.strip()) < 20:
            import time
            for attempt in range(2):
                try:
                    vi_r = invoke_claude(
                        f"Translate to Vietnamese. Output ONLY the translation:\n{reason_en}",
                        model=settings.BEDROCK_MODEL_HAIKU,
                        max_tokens=400,
                        feature="skill_level",
                        candidate_id=candidate_id,
                    )
                    reason_vi = vi_r.strip().split("\n\n")[0].strip()
                    if len(reason_vi) >= 20:
                        break
                except Exception:
                    if attempt < 1:
                        time.sleep(2)
                    else:
                        reason_vi = reason_en

        if level and category:
            # Post-process: fix first G-level mention in reason to match calculated level
            # Only replace the description of current state, not "advance to next level"
            import re
            if reason_en:
                reason_en = re.sub(
                    r'\b(demonstrates?|shows?|is at|is a|at early|at solid|at strong)\s+(G\d)(?:\s*-\s*G\d)?',
                    lambda m: f"{m.group(1)} {level}",
                    reason_en,
                    count=1
                )
            if reason_vi:
                reason_vi = re.sub(
                    r'\b(thể hiện|đạt|ở mức)\s+(G\d)(?:\s*-\s*G\d)?',
                    lambda m: f"{m.group(1)} {level}",
                    reason_vi,
                    count=1
                )

            cat_data = SKILL_MAPS.get(category, {})
            level_desc_vi = cat_data.get("g_criteria", {}).get(level, "")
            level_desc_en = cat_data.get("g_criteria_en", {}).get(level, "")
            category_title_vi = cat_data.get("title_vi", category)
            category_titles = {
                "vi": category_title_vi,
                "en": category.replace("_", " ").title(),
                "ja": cat_data.get("title_ja", category_title_vi),
            }
            domains = cat_data.get("domains", [])
            result_data = {
                "category": category,
                "level": level,
                "reason": {"vi": reason_vi, "en": reason_en},
                "scores": skill_scores,
                "level_scores": level_scores if level_scores else None,
                "total": total_str,
                "level_description": {"vi": level_desc_vi, "en": level_desc_en},
                "category_title": category_titles,
                "domains": domains,
            }
            return result_data
    except Exception as e:
        import traceback
        logger.warning(f"Skill level assessment failed: {e}\n{traceback.format_exc()}")
    return None
