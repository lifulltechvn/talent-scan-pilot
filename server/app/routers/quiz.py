"""Quiz endpoints — admin (generate, results) + public (get, submit)."""

import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.deps import get_current_user
from app.models import Candidate, Job, Quiz, QuizQuestion, QuizResponse, User

router = APIRouter(prefix="/quiz", tags=["quiz"])

QUIZ_DEADLINE_HOURS = 48


# --- Schemas ---

class QuizGenerateRequest(BaseModel):
    candidate_id: str
    reason: str  # insufficient_data / suspected_ai_cv


class QuestionOut(BaseModel):
    id: str
    question_type: str  # text / radio / checkbox
    question: str
    options: list[str] | None = None
    sort_order: int

    model_config = {"from_attributes": True}


class QuizPublicOut(BaseModel):
    quiz_id: str
    job_title: str
    questions: list[QuestionOut]
    deadline: str


class AnswerIn(BaseModel):
    question_id: str
    answer: str


class QuizSubmitRequest(BaseModel):
    answers: list[AnswerIn]


class ResponseOut(BaseModel):
    question_id: str
    question: str
    answer: str
    verdict: str | None
    verdict_reason: str | None


class QuizResultOut(BaseModel):
    quiz_id: str
    status: str
    reason: str
    credibility_score: float | None
    responses: list[ResponseOut]
    created_at: str


# --- Admin endpoints (require auth) ---

@router.post("/generate", status_code=status.HTTP_201_CREATED)
async def generate_quiz(
    body: QuizGenerateRequest,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Generate a personalized quiz for a candidate. Creates questions based on CV + JD."""
    candidate = await db.get(Candidate, body.candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    job = await db.get(Job, candidate.job_id) if candidate.job_id else None

    # Generate token
    token = secrets.token_urlsafe(32)
    deadline = datetime.now(timezone.utc) + timedelta(hours=QUIZ_DEADLINE_HOURS)

    quiz = Quiz(
        candidate_id=candidate.id,
        job_id=candidate.job_id,
        token=token,
        reason=body.reason,
        deadline=deadline,
    )
    db.add(quiz)
    await db.flush()

    # Generate questions based on CV skills + reason
    skills = candidate.structured_data.get("skills", [])
    experience = candidate.structured_data.get("experience", [])
    job_title = job.title if job else "the position"

    questions = _generate_questions(skills, experience, job_title, body.reason)
    for i, q in enumerate(questions):
        db.add(QuizQuestion(
            quiz_id=quiz.id,
            question_type=q["type"],
            question=q["question"],
            options=q.get("options"),
            purpose=q["purpose"],
            eval_criteria=q["eval_criteria"],
            sort_order=i,
        ))

    await db.commit()
    return {"quiz_id": str(quiz.id), "token": token, "deadline": deadline.isoformat()}


@router.get("/results/{candidate_id}", response_model=list[QuizResultOut])
async def get_quiz_results(
    candidate_id: str,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Get all quiz results for a candidate (admin view)."""
    result = await db.execute(
        select(Quiz)
        .where(Quiz.candidate_id == candidate_id)
        .options(selectinload(Quiz.questions).selectinload(QuizQuestion.response))
        .order_by(Quiz.created_at.desc())
    )
    quizzes = result.scalars().all()

    out = []
    for quiz in quizzes:
        responses = []
        for q in quiz.questions:
            r = q.response
            responses.append(ResponseOut(
                question_id=str(q.id),
                question=q.question,
                answer=r.answer if r else "",
                verdict=r.verdict if r else None,
                verdict_reason=r.verdict_reason if r else None,
            ))
        out.append(QuizResultOut(
            quiz_id=str(quiz.id),
            status=quiz.status,
            reason=quiz.reason,
            credibility_score=quiz.credibility_score,
            responses=responses,
            created_at=quiz.created_at.isoformat(),
        ))
    return out


# --- Public endpoints (token-based, no auth) ---

@router.get("/public/{token}", response_model=QuizPublicOut)
async def get_public_quiz(token: str, db: AsyncSession = Depends(get_db)):
    """Public endpoint: candidate opens quiz link."""
    quiz = await _get_quiz_by_token(db, token)

    questions = [
        QuestionOut(id=str(q.id), question_type=q.question_type, question=q.question, options=q.options, sort_order=q.sort_order)
        for q in quiz.questions
    ]

    return QuizPublicOut(
        quiz_id=str(quiz.id),
        job_title=quiz.job.title if quiz.job else "Unknown",
        questions=questions,
        deadline=quiz.deadline.isoformat(),
    )


@router.post("/public/{token}/submit")
async def submit_quiz(token: str, body: QuizSubmitRequest, db: AsyncSession = Depends(get_db)):
    """Public endpoint: candidate submits answers. AI evaluates responses."""
    quiz = await _get_quiz_by_token(db, token)

    if quiz.status != "pending":
        raise HTTPException(status_code=400, detail="Quiz already submitted")

    # Save responses
    question_map = {str(q.id): q for q in quiz.questions}
    for ans in body.answers:
        if ans.question_id not in question_map:
            raise HTTPException(status_code=400, detail=f"Invalid question_id: {ans.question_id}")
        db.add(QuizResponse(question_id=ans.question_id, answer=ans.answer))

    quiz.status = "submitted"
    await db.flush()

    # AI evaluation via Claude Haiku
    credibility_score = await _evaluate_quiz(quiz, body.answers, question_map, db)
    quiz.credibility_score = credibility_score
    quiz.status = "evaluated"

    await db.commit()
    return {"status": "evaluated", "credibility_score": credibility_score, "message": "Thank you for completing the quiz."}


# --- Helpers ---

async def _evaluate_quiz(quiz, answers: list, question_map: dict, db: AsyncSession) -> float:
    """Evaluate quiz answers using Claude Haiku. Returns credibility score 0-100."""
    import logging
    from app.bedrock import invoke_claude
    from app.config import settings

    if not settings.AWS_ACCESS_KEY_ID:
        return 60.0  # Credentials required

    qa_text = ""
    for ans in answers:
        q = question_map.get(ans.question_id)
        if q:
            qa_text += f"Q: {q.question}\nCriteria: {q.eval_criteria}\nA: {ans.answer}\n\n"

    prompt = f"""Evaluate these quiz responses for candidate credibility.
Quiz reason: {quiz.reason}

{qa_text}

For each answer, assess if it demonstrates real experience (specific details, numbers, tools) vs generic/vague responses.
Reply in this format:
SCORE: <0-100 credibility score>
VERDICT: <credible / suspicious / insufficient>
REASON: <one sentence explanation>"""

    try:
        result = invoke_claude(prompt, model=settings.BEDROCK_MODEL_HAIKU, max_tokens=300, feature="quiz")
        for line in result.strip().split("\n"):
            if line.startswith("SCORE:"):
                score = float(line.replace("SCORE:", "").strip())
                return max(0, min(100, score))
        return 60.0
    except Exception as e:
        logging.warning(f"Quiz evaluation failed: {e}")
        return 60.0


async def _get_quiz_by_token(db: AsyncSession, token: str) -> Quiz:
    result = await db.execute(
        select(Quiz)
        .where(Quiz.token == token)
        .options(selectinload(Quiz.questions), selectinload(Quiz.job))
    )
    quiz = result.scalar_one_or_none()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    if quiz.deadline < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Quiz has expired")
    return quiz


def _generate_questions(skills: list, experience: list, job_title: str, reason: str) -> list[dict]:
    """Generate quiz questions via Claude Sonnet (Bedrock) or fallback to templates."""
    import json
    import logging
    from app.bedrock import invoke_claude_with_tools
    from app.config import settings

    top_skills = skills[:3] if skills else ["your main skill"]
    latest_role = experience[0].get("role", "your role") if experience else "your role"

    # Try AI generation if credentials available
    if settings.AWS_ACCESS_KEY_ID:
        try:
            tools = [{
                "name": "save_questions",
                "description": "Save generated quiz questions",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "questions": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "type": {"type": "string", "enum": ["text", "radio", "checkbox"]},
                                    "question": {"type": "string"},
                                    "options": {"type": "array", "items": {"type": "string"}},
                                    "purpose": {"type": "string"},
                                    "eval_criteria": {"type": "string"},
                                },
                                "required": ["type", "question", "purpose", "eval_criteria"],
                            },
                        },
                    },
                    "required": ["questions"],
                },
            }]

            prompt = f"""Generate 5 personalized verification questions for a candidate.

Candidate skills: {', '.join(skills[:5])}
Latest role: {latest_role}
Job position: {job_title}
Reason for quiz: {reason}

Requirements:
- Mix of question types: 1 radio, 1 checkbox, 3 text
- Questions must reference specific skills from the CV
- Text questions should require concrete details (numbers, timelines, specific tools)
- If reason is "suspected_ai_cv", add questions that are hard to answer without real experience
- Each question needs eval_criteria for automated evaluation"""

            result = invoke_claude_with_tools(prompt, tools, model=settings.BEDROCK_MODEL_SONNET, feature="quiz")
            if result and "questions" in result:
                return result["questions"]
        except Exception as e:
            logging.warning(f"AI quiz generation failed, using templates: {e}")

    # Fallback: template-based questions
    questions = [
        {
            "type": "radio",
            "question": f"How many years of hands-on experience do you have with {top_skills[0]}?",
            "options": ["Less than 1 year", "1-2 years", "3-5 years", "More than 5 years"],
            "purpose": "Quick verification of experience level",
            "eval_criteria": "Cross-reference with CV timeline",
        },
        {
            "type": "checkbox",
            "question": "Which of the following have you used in a production environment?",
            "options": top_skills + ["CI/CD Pipeline", "Unit Testing", "Code Review"],
            "purpose": "Verify breadth of practical experience",
            "eval_criteria": "Selections should align with CV claims",
        },
        {
            "type": "text",
            "question": f"You listed {', '.join(top_skills)} on your CV. Describe a specific technical challenge you solved using these skills.",
            "purpose": "Verify hands-on experience with claimed skills",
            "eval_criteria": "Must mention specific tools/patterns, not generic answers",
        },
        {
            "type": "text",
            "question": f"As a {latest_role}, describe a time when a project deadline was at risk. What did you do?",
            "purpose": "Assess problem-solving and real experience",
            "eval_criteria": "Should include specific timeline, actions taken, and measurable outcome",
        },
        {
            "type": "text",
            "question": f"For the {job_title} position: What is the largest project you've worked on? Describe team size, your contribution, and tech stack.",
            "purpose": "Verify project experience with concrete details",
            "eval_criteria": "Must have specific numbers. Vague answers suggest fabrication",
        },
    ]

    if reason == "suspected_ai_cv":
        questions.append({
            "type": "radio",
            "question": f"Which best describes your typical debugging workflow with {top_skills[0]}?",
            "options": ["Print/log → isolate → fix", "Debugger with breakpoints", "Write failing test → fix → verify", "Ask AI/colleagues first"],
            "purpose": "AI-generated CVs often lack workflow details",
            "eval_criteria": "Any specific answer is acceptable; vague or no preference is suspicious",
        })

    return questions
