"""Outreach email endpoints — preview (editable) + send + log."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.deps import get_current_user
from app.models import Candidate, EmailTemplate, Job, OutreachLog, User
from app.services.email import get_email_service
from app.services.email_templates import (
    OutreachSections, RejectionSections, ReminderSections,
    default_outreach, default_rejection, default_reminder,
    render_outreach, render_rejection, render_reminder,
)

router = APIRouter(prefix="/outreach", tags=["outreach"])


# --- Schemas ---

class OutreachLogOut(BaseModel):
    id: str
    candidate_id: str
    candidate_name: str
    template_type: str
    subject: str | None
    content: str
    status: str
    sent_at: str


class PreviewRequest(BaseModel):
    candidate_id: str
    template_type: str  # outreach / rejection / reminder
    job_title: str | None = None
    schedule_url: str | None = None
    interview_date: str | None = None
    interview_time: str | None = None
    interviewer: str | None = None


class PreviewResponse(BaseModel):
    greeting: str
    body: str
    highlights: list[str] = []
    tips: list[str] = []
    feedback: str = ""
    closing: str
    subject: str


class SendRequest(BaseModel):
    candidate_id: str | None = None
    to_email: str
    template_type: str
    subject: str | None = None
    # Editable text sections
    greeting: str
    body: str
    closing: str
    highlights: list[str] = []
    tips: list[str] = []
    feedback: str = ""
    # Fixed context
    job_title: str
    company: str = "LIFULL Tech Vietnam"
    schedule_url: str | None = None
    interview_date: str | None = None
    interview_time: str | None = None
    interviewer: str | None = None


# --- Endpoints ---

@router.get("/logs", response_model=list[OutreachLogOut])
async def list_outreach_logs(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(OutreachLog)
        .options(selectinload(OutreachLog.candidate))
        .order_by(OutreachLog.sent_at.desc())
    )
    logs = result.scalars().all()
    return [
        OutreachLogOut(
            id=str(log.id),
            candidate_id=str(log.candidate_id),
            candidate_name=log.candidate.structured_data.get("name", "Unknown") if log.candidate else "Unknown",
            template_type=log.template_type,
            subject=log.subject,
            content=log.content,
            status=log.status,
            sent_at=log.sent_at.isoformat(),
        )
        for log in logs
    ]


@router.post("/preview", response_model=PreviewResponse)
async def get_preview(
    body: PreviewRequest,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Get default editable text for a template. HR edits these before sending."""
    candidate = await db.get(Candidate, body.candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    name = candidate.structured_data.get("name", "Candidate")
    skills = candidate.structured_data.get("skills", [])
    job_title = body.job_title or "the position"

    if not body.job_title and candidate.job_id:
        job = await db.get(Job, candidate.job_id)
        if job:
            job_title = job.title

    if body.template_type == "outreach":
        s = await _get_template_or_default(db, "outreach", name, job_title, skills, body.schedule_url)
        subject = f"🚀 Exciting opportunity: {job_title} at LIFULL Tech Vietnam"
        return PreviewResponse(greeting=s.greeting, body=s.body, highlights=s.highlights, closing=s.closing, subject=subject)

    elif body.template_type == "rejection":
        s = await _get_template_or_default(db, "rejection", name, job_title, skills)
        subject = f"Update on your application — {job_title}"
        return PreviewResponse(greeting=s.greeting, body=s.body, feedback="", closing=s.closing, subject=subject)

    elif body.template_type == "reminder":
        s = await _get_template_or_default(db, "reminder", name, job_title, skills)
        subject = f"⏰ Reminder: Interview tomorrow — {job_title}"
        return PreviewResponse(greeting=s.greeting, body=s.body, tips=s.tips if hasattr(s, 'tips') and s.tips else ["Review the job description", "Prepare questions about the role", "Test your setup if video call"], closing=s.closing, subject=subject)

    raise HTTPException(status_code=400, detail="Invalid template_type")


@router.post("/send", status_code=201)
async def send_email(
    body: SendRequest,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Send email with HR-edited text sections."""
    candidate = None
    job_id = None
    if body.candidate_id:
        candidate = await db.get(Candidate, body.candidate_id)
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found")
        job_id = candidate.job_id

    # Build sections from HR-edited text
    if body.template_type == "outreach":
        sections = OutreachSections(
            greeting=body.greeting, body=body.body, highlights=body.highlights,
            closing=body.closing, job_title=body.job_title, company=body.company,
            schedule_url=body.schedule_url,
        )
        subject, html = render_outreach(sections)

    elif body.template_type == "rejection":
        sections = RejectionSections(
            greeting=body.greeting, body=body.body, feedback=body.feedback,
            closing=body.closing, job_title=body.job_title,
        )
        subject, html = render_rejection(sections)

    elif body.template_type == "reminder":
        sections = ReminderSections(
            greeting=body.greeting, body=body.body, tips=body.tips,
            closing=body.closing, job_title=body.job_title,
            interview_date=body.interview_date or "", interview_time=body.interview_time or "",
            interviewer=body.interviewer,
        )
        subject, html = render_reminder(sections)
    else:
        raise HTTPException(status_code=400, detail="Invalid template_type")

    # Use custom subject if provided
    if body.subject:
        subject = body.subject

    # Send
    email_service = get_email_service()
    try:
        email_service.send(to=body.to_email, subject=subject, html_body=html)
        email_status = "sent"
    except Exception as e:
        import logging
        logging.error(f"Email send failed: {e}")
        email_status = "failed"

    # Log
    log = OutreachLog(
        candidate_id=body.candidate_id,
        job_id=job_id,
        to_email=body.to_email,
        template_type=body.template_type,
        subject=subject,
        content=html,
        status=email_status,
    )
    db.add(log)
    await db.commit()

    if email_status == "failed":
        raise HTTPException(status_code=502, detail="Email delivery failed")

    return {"id": str(log.id), "status": email_status}


def _ai_generate_outreach(name: str, job_title: str, skills: list[str]) -> OutreachSections | None:
    """Generate personalized outreach email using Claude Haiku."""
    import logging
    from app.bedrock import invoke_claude
    from app.config import settings

    if not settings.AWS_ACCESS_KEY_ID:
        return None

    try:
        from app.prompts import OUTREACH_PROMPT

        prompt = OUTREACH_PROMPT.format(
            name=name,
            job_title=job_title,
            skills=", ".join(skills[:5]),
        )

        result = invoke_claude(prompt, model=settings.BEDROCK_MODEL_HAIKU, max_tokens=400, feature="outreach")
        parts = {}
        for line in result.strip().split("\n"):
            for key in ["GREETING", "BODY", "HIGHLIGHTS", "CLOSING"]:
                if line.startswith(f"{key}:"):
                    parts[key.lower()] = line.split(":", 1)[1].strip()

        if all(k in parts for k in ["greeting", "body", "closing"]):
            highlights = [h.strip() for h in parts.get("highlights", "").split(",") if h.strip()]
            return OutreachSections(
                greeting=parts["greeting"], body=parts["body"],
                highlights=highlights or ["Great team", "Competitive salary", "Growth opportunities"],
                closing=parts["closing"], job_title=job_title, company="LIFULL Tech Vietnam",
            )
    except Exception as e:
        logging.warning(f"AI outreach generation failed: {e}")
    return None


async def _get_template_or_default(db: AsyncSession, template_type: str, name: str, job_title: str, skills: list[str], schedule_url: str | None = None):
    """Read custom template from DB, apply variable substitution, fallback to hardcoded default."""
    result = await db.execute(select(EmailTemplate).where(EmailTemplate.template_type == template_type))
    tmpl = result.scalar_one_or_none()

    if tmpl:
        # Substitute variables
        def sub(text: str) -> str:
            return text.replace("{name}", name).replace("{job_title}", job_title).replace("{company}", "LIFULL Tech Vietnam")

        class _Sections:
            pass
        s = _Sections()
        s.greeting = sub(tmpl.greeting)
        s.body = sub(tmpl.body)
        s.closing = sub(tmpl.closing)
        s.highlights = tmpl.highlights or []
        s.tips = tmpl.tips or []
        return s

    # Fallback to hardcoded defaults
    if template_type == "outreach":
        return default_outreach(name, job_title, "LIFULL Tech Vietnam", skills, schedule_url)
    elif template_type == "rejection":
        return default_rejection(name, job_title)
    else:
        return default_reminder(name, job_title, "TBD", "TBD")
