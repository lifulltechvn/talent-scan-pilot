"""
Centralized AI prompt templates.
All prompts used with Bedrock LLMs are defined here for maintainability.
"""

# --- CV Parsing ---

CV_PARSE_SYSTEM = (
    "You are a CV parser. Extract structured data from the CV text below. "
    "Only extract information explicitly stated in the CV — do not infer or fabricate data. "
    "If a field is not mentioned, leave it null or empty. NEVER use '<UNKNOWN>' or 'N/A' — use null instead. "
    "IMPORTANT: If the text is NOT a CV/resume (e.g. it's a job description, article, or other document), "
    "return name as null and skills as empty array. A CV must have a person's name and their personal skills/experience. "
    "Be concise in insight fields (1-2 sentences each)."
)

CV_PARSE_USER = "Parse this CV:\n\n{text}"

# --- Scoring ---

SCORING_PROMPT = """Evaluate this candidate for the position "{job_title}".

Required skills: {job_skills}
Job requirements: {job_description}

IMPORTANT: If job says "ONE OF (X/Y/Z)" or "at least one of", candidate only needs ONE skill from that group to score full marks for it.

<CANDIDATE_DATA>
- Skills: {skills}
- Experience: {exp_years} years
- Experience details: {experience}
- Insight: {insight}
</CANDIDATE_DATA>

Scoring rubric:
- 80-100: Meets job requirements (including "one of" conditions), experience meets/exceeds, strong fit
- 60-79: Partial match, relevant experience, minor gaps
- 40-59: Some relevant skills, limited experience in this domain
- 0-39: Few matching skills, insufficient experience, major concerns

Evaluate ONLY based on the data provided above. Do not assume or infer information not present.

Reply in exactly this format (each on its own line):
SCORE: <number 0-100>
SUMMARY_EN: <one sentence summary in English>
SUMMARY_VI: <one sentence summary in Vietnamese>
STRENGTHS_EN: <comma-separated strengths in English, max 5>
STRENGTHS_VI: <comma-separated strengths in Vietnamese, max 5>
CONCERNS_EN: <comma-separated concerns in English, max 5>
CONCERNS_VI: <comma-separated concerns in Vietnamese, max 5>
SUGGESTION_EN: <one actionable recommendation in English>
SUGGESTION_VI: <one actionable recommendation in Vietnamese>"""

# --- JD Import ---

JD_IMPORT_PROMPT = """Parse this job description and extract structured data.
Only extract information explicitly stated. If a field is not mentioned, use null.

IMPORTANT for required_skills:
- Extract ONLY concrete technologies, tools, languages, frameworks
- If JD says "one of X, Y, Z" or "X or Y", combine them as ONE item with "/" separator: "X/Y/Z"
- Example: "proficient in Go, Java, or Python" → "Go/Java/Python" (one item)
- Example: "PostgreSQL or MySQL" → "PostgreSQL/MySQL" (one item)
- Non-alternative skills stay as individual items: "Docker", "Redis", "Kafka"
- Do NOT include abstract concepts like "backend development", "API design"
- Maximum 10 items

IMPORTANT for description: Write a concise summary BUT preserve skill conditions:
- Mark "ONE OF (X/Y/Z)" for alternative skills (candidate needs only 1)
- Mark "REQUIRED:" for mandatory skills
- Mark "PREFERRED:" for nice-to-have skills
- Keep years requirement and any language requirement

Reply in JSON only:
{{
  "title": "job title",
  "description": "Concise summary preserving conditions. Example: 'Backend role. REQUIRED: 4+ yrs, ONE OF (Go/Java/Python). MUST: PostgreSQL, Docker. PREFERRED: AWS, K8s, Japanese N3+'",
  "required_skills": ["Go/Java/Python/Ruby", "PostgreSQL/MySQL", "Redis", "Docker", "Kafka", ...max 10],
  "location": "city or remote",
  "salary_range": "range if mentioned or null",
  "required_years": number or null,
  "required_education": "bachelor/master/phd or null",
  "deadline": "YYYY-MM-DD or null"
}}

{text}"""

# --- JD Generate ---

JD_GENERATE_PROMPT = """Generate a professional job description for the position: "{title}"
{context}

Reply in JSON format:
{{
  "title": "{title}",
  "description_en": "3-4 sentences in English describing the role, responsibilities, and team",
  "description_vi": "3-4 câu tiếng Việt mô tả vai trò, trách nhiệm, và team",
  "required_skills": ["skill1", "skill2", ...max 8 concrete technologies/tools],
  "required_years": number (minimum years of experience, be realistic),
  "required_education": "bachelor" or "master" or null,
  "salary_range": "estimated salary range in USD",
  "location": "suggested location or Remote"
}}

Be specific and realistic. Skills should be concrete technologies/tools, not soft skills."""

# --- HR Recommendation ---

RECOMMENDATION_PROMPT = """You are an HR advisor. Analyze ONLY the candidate data provided below.
For the job "{job_title}" (required skills: {job_skills}), here are the top candidates:

<CANDIDATE_LIST>
{candidates}
</CANDIDATE_LIST>

Give a brief recommendation based strictly on the data above:
1. Which 2-3 candidates should be interviewed first and why (1 sentence each)?
2. Any candidates to skip and why?
3. One interview focus suggestion.

Do not fabricate details not present in the data. Be concise and actionable. Reply in both Vietnamese and English, separated by ---EN--- marker:
[Vietnamese recommendation]
---EN---
[English recommendation]"""

# --- Outreach Email ---

OUTREACH_PROMPT = """Write a short, warm outreach email to a candidate.
Name: {name}
Position: {job_title}
Their skills: {skills}
Company: LIFULL Tech Vietnam

Requirements:
- Keep total email under 100 words
- Professional but friendly tone
- Personalize based on their specific skills

Reply in this exact format:
GREETING: <greeting line>
BODY: <2-3 sentences, personalized to their skills>
HIGHLIGHTS: <comma-separated list of exactly 3 role highlights>
CLOSING: <closing line>"""
