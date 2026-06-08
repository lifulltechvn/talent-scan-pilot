"""Email template CRUD — HR can customize default templates."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import EmailTemplate, User

router = APIRouter(prefix="/email-templates", tags=["email-templates"])


class TemplateOut(BaseModel):
    template_type: str
    greeting: str
    body: str
    closing: str
    highlights: list[str] | None
    tips: list[str] | None


class TemplateUpdate(BaseModel):
    greeting: str
    body: str
    closing: str
    highlights: list[str] | None = None
    tips: list[str] | None = None


# Defaults when no DB record exists
DEFAULTS = {
    "outreach": TemplateOut(template_type="outreach", greeting="Hi {name}! 👋", body="We came across your profile and were impressed by your background. We'd love to explore an opportunity with you.", closing="We look forward to connecting!", highlights=["Strong match for {job_title}"], tips=None),
    "rejection": TemplateOut(template_type="rejection", greeting="Hi {name},", body="Thank you for your interest in the {job_title} position.\n\nAfter careful consideration, we've decided to move forward with other candidates.", closing="We've added your profile to our Talent Pool and will reach out if a more suitable role opens up.", highlights=None, tips=None),
    "reminder": TemplateOut(template_type="reminder", greeting="Hi {name}! 📅", body="Just a friendly reminder about your upcoming interview.", closing="If you need to reschedule, please reply to this email. Good luck! 🍀", highlights=None, tips=["Review the job description", "Prepare questions about the role", "Test your setup if video call"]),
}


@router.get("", response_model=list[TemplateOut])
async def list_templates(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    result = await db.execute(select(EmailTemplate))
    db_templates = {t.template_type: t for t in result.scalars().all()}

    out = []
    for ttype, default in DEFAULTS.items():
        if ttype in db_templates:
            t = db_templates[ttype]
            out.append(TemplateOut(template_type=t.template_type, greeting=t.greeting, body=t.body, closing=t.closing, highlights=t.highlights, tips=t.tips))
        else:
            out.append(default)
    return out


@router.put("/{template_type}", response_model=TemplateOut)
async def update_template(
    template_type: str,
    body: TemplateUpdate,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    result = await db.execute(select(EmailTemplate).where(EmailTemplate.template_type == template_type))
    template = result.scalar_one_or_none()

    if template:
        template.greeting = body.greeting
        template.body = body.body
        template.closing = body.closing
        template.highlights = body.highlights
        template.tips = body.tips
    else:
        template = EmailTemplate(template_type=template_type, greeting=body.greeting, body=body.body, closing=body.closing, highlights=body.highlights, tips=body.tips)
        db.add(template)

    await db.commit()
    return TemplateOut(template_type=template.template_type, greeting=template.greeting, body=template.body, closing=template.closing, highlights=template.highlights, tips=template.tips)
