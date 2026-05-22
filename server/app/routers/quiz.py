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
    """Public endpoint: candidate submits answers."""
    quiz = await _get_quiz_by_token(db, token)

    if quiz.status != "pending":
        raise HTTPException(status_code=400, detail="Quiz already submitted")

    # Save responses
    question_ids = {str(q.id) for q in quiz.questions}
    for ans in body.answers:
        if ans.question_id not in question_ids:
            raise HTTPException(status_code=400, detail=f"Invalid question_id: {ans.question_id}")
        db.add(QuizResponse(question_id=ans.question_id, answer=ans.answer))

    quiz.status = "submitted"
    await db.commit()

    return {"status": "submitted", "message": "Thank you for completing the quiz."}


# --- Helpers ---

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
    """Generate quiz questions. In production, this calls Claude Sonnet via Bedrock.
    For now, returns template-based questions personalized with CV data."""
    top_skills = skills[:3] if skills else ["your main skill"]
    latest_role = experience[0].get("role", "your role") if experience else "your role"

    questions = [
        {
            "type": "radio",
            "question": f"How many years of hands-on experience do you have with {top_skills[0] if top_skills else 'your primary skill'}?",
            "options": ["Less than 1 year", "1-2 years", "3-5 years", "More than 5 years"],
            "purpose": "Quick verification of experience level",
            "eval_criteria": "Cross-reference with CV timeline",
        },
        {
            "type": "checkbox",
            "question": f"Which of the following have you used in a production environment?",
            "options": top_skills + ["CI/CD Pipeline", "Unit Testing", "Code Review"],
            "purpose": "Verify breadth of practical experience",
            "eval_criteria": "Selections should align with CV claims",
        },
        {
            "type": "text",
            "question": f"You listed {', '.join(top_skills)} on your CV. Describe a specific technical challenge you solved using these skills. Include the approach, tools used, and outcome.",
            "purpose": "Verify hands-on experience with claimed skills",
            "eval_criteria": "Must mention specific tools/patterns, not generic answers",
        },
        {
            "type": "text",
            "question": f"As a {latest_role}, describe a time when a project deadline was at risk. What did you do to address it? What was the result?",
            "purpose": "Assess problem-solving and real experience",
            "eval_criteria": "Should include specific timeline, actions taken, and measurable outcome",
        },
        {
            "type": "text",
            "question": f"For the {job_title} position: What is the largest project you've worked on? Describe the team size, your specific contribution, tech stack used, and number of users/scale.",
            "purpose": "Verify project experience with concrete details",
            "eval_criteria": "Must have specific numbers (team size, users, duration). Vague answers suggest fabrication",
        },
    ]

    if reason == "suspected_ai_cv":
        questions.append({
            "type": "radio",
            "question": f"Which best describes your typical debugging workflow with {top_skills[0] if top_skills else 'your main tool'}?",
            "options": [
                "Print/log statements → isolate → fix",
                "Debugger with breakpoints → step through",
                "Write a failing test → fix → verify",
                "Ask AI/colleagues first → then investigate",
            ],
            "purpose": "AI-generated CVs often lack workflow details",
            "eval_criteria": "Any specific answer is acceptable; vague or no preference is suspicious",
        })

    return questions
