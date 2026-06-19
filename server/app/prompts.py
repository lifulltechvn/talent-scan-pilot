"""
Centralized AI prompt templates.
All prompts used with Bedrock LLMs are defined here for maintainability.
"""

# --- CV Parsing ---

CV_PARSE_SYSTEM = (
    "You are a CV parser. Extract structured data from the CV text below. "
    "Only extract information explicitly stated in the CV — do not infer or fabricate data. "
    "If a field is not mentioned, leave it null or empty. "
    "Be concise in insight fields (1-2 sentences each)."
)

CV_PARSE_USER = "Parse this CV:\n\n{text}"

# --- Scoring ---

SCORING_PROMPT = """Evaluate this candidate for the position "{job_title}".

Required skills: {job_skills}

<CANDIDATE_DATA>
- Skills: {skills}
- Experience: {exp_years} years
- Experience details: {experience}
- Insight: {insight}
</CANDIDATE_DATA>

Scoring rubric:
- 80-100: Skill match ≥80%, experience meets/exceeds requirement, strong career progression
- 60-79: Partial skill match (50-79%), relevant experience, minor gaps
- 40-59: Some relevant skills, limited experience in this domain
- 0-39: Few matching skills, insufficient experience, major concerns

Evaluate ONLY based on the data provided above. Do not assume or infer information not present.

Reply in exactly this format (each on its own line):
SCORE: <number 0-100>
SUMMARY: <one sentence, max 30 words>
STRENGTHS: <comma-separated list, max 5 items>
CONCERNS: <comma-separated list, max 5 items>
SUGGESTION: <one actionable recommendation for the interviewer>"""

# --- JD Import ---

JD_IMPORT_PROMPT = """Parse this job description and extract structured data.
Only extract information explicitly stated. If a field is not mentioned, use null.
Limit required_skills to a maximum of 10 items.

Reply in JSON only:
{{
  "title": "job title",
  "description": "2-3 sentence summary",
  "required_skills": ["skill1", "skill2", ...max 10],
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
  "description": "3-4 sentences describing the role, responsibilities, and team",
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

Do not fabricate details not present in the data. Be concise and actionable. Reply in Vietnamese."""

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
