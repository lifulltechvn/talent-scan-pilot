"""Email templates — branded HTML with editable text sections."""

from dataclasses import dataclass, field

ACCENT = "#ED6103"
BG = "#f8f9fb"


def _base(content: str) -> str:
    return f"""\
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:{BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:{BG};padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
  <tr><td style="background:{ACCENT};padding:28px 40px;text-align:center;">
    <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.5px;">LF Talent Scan</span>
  </td></tr>
  <tr><td style="padding:40px;">{content}</td></tr>
  <tr><td style="padding:24px 40px;background:#f9fafb;border-top:1px solid #eee;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9ca3af;">This email was sent by LF Talent Scan recruitment platform.</p>
    <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;">If you have questions, reply directly to this email.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>"""


def _button(text: str, url: str) -> str:
    return f"""\
<table cellpadding="0" cellspacing="0" style="margin:28px 0;">
<tr><td style="background:{ACCENT};border-radius:8px;padding:14px 32px;text-align:center;">
  <a href="{url}" style="color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;">{text}</a>
</td></tr>
</table>"""


def _nl2p(text: str) -> str:
    """Convert newlines to HTML paragraphs."""
    paras = [p.strip() for p in text.strip().split("\n") if p.strip()]
    return "".join(f'<p style="font-size:14px;color:#4b5563;line-height:1.6;margin:0 0 12px;">{p}</p>' for p in paras)


# --- Editable section models ---

@dataclass
class OutreachSections:
    greeting: str = ""
    body: str = ""
    highlights: list[str] = field(default_factory=list)
    closing: str = ""
    # Fixed (not editable by HR)
    job_title: str = ""
    company: str = ""
    schedule_url: str | None = None


@dataclass
class RejectionSections:
    greeting: str = ""
    body: str = ""
    feedback: str = ""
    closing: str = ""
    job_title: str = ""


@dataclass
class ReminderSections:
    greeting: str = ""
    body: str = ""
    tips: list[str] = field(default_factory=list)
    closing: str = ""
    job_title: str = ""
    interview_date: str = ""
    interview_time: str = ""
    interviewer: str | None = None


# --- Default text generators ---

def default_outreach(candidate_name: str, job_title: str, company: str, skills: list[str], schedule_url: str | None = None) -> OutreachSections:
    return OutreachSections(
        greeting=f"Hi {candidate_name}! 👋",
        body="We came across your profile and were impressed by your background. We'd love to explore an opportunity with you.",
        highlights=skills[:3] if skills else [f"Strong match for {job_title}"],
        closing="We look forward to connecting!",
        job_title=job_title,
        company=company,
        schedule_url=schedule_url,
    )


def default_rejection(candidate_name: str, job_title: str) -> RejectionSections:
    return RejectionSections(
        greeting=f"Hi {candidate_name},",
        body=f"Thank you for your interest in the {job_title} position and for taking the time to go through our process.\n\nAfter careful consideration, we've decided to move forward with other candidates whose experience more closely aligns with our current needs.",
        feedback="",
        closing="We've added your profile to our Talent Pool and will reach out if a more suitable role opens up. We genuinely appreciate your time and wish you the best.",
        job_title=job_title,
    )


def default_reminder(candidate_name: str, job_title: str, interview_date: str, interview_time: str, interviewer: str | None = None) -> ReminderSections:
    return ReminderSections(
        greeting=f"Hi {candidate_name}! 📅",
        body="Just a friendly reminder about your upcoming interview.",
        tips=["Review the job description and your application", "Prepare questions about the role and team", "Test your setup if it's a video call"],
        closing="If you need to reschedule, please reply to this email as soon as possible. Good luck! 🍀",
        job_title=job_title,
        interview_date=interview_date,
        interview_time=interview_time,
        interviewer=interviewer,
    )


# --- Renderers ---

def render_outreach(s: OutreachSections) -> tuple[str, str]:
    highlights_html = "".join(f'<li style="margin:4px 0;color:#374151;">{h}</li>' for h in s.highlights)

    content = f"""\
<h2 style="margin:0 0 8px;font-size:20px;color:#111827;">{s.greeting}</h2>
{_nl2p(s.body)}

<div style="background:#fff7ed;border-left:4px solid {ACCENT};border-radius:0 8px 8px 0;padding:16px 20px;margin:20px 0;">
  <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:{ACCENT};">Position</p>
  <p style="margin:0;font-size:16px;font-weight:600;color:#111827;">{s.job_title}</p>
  <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">at {s.company}</p>
</div>

{"<p style='font-size:14px;color:#374151;font-weight:600;margin:20px 0 8px;'>Why we're reaching out:</p><ul style='padding-left:20px;margin:0;'>" + highlights_html + "</ul>" if s.highlights else ""}

{_button("Schedule Interview", s.schedule_url) if s.schedule_url else ""}

{_nl2p(s.closing)}

<p style="font-size:14px;color:#4b5563;margin:24px 0 0;">Best regards,<br><span style="font-weight:600;color:#111827;">HR Team — {s.company}</span></p>"""

    subject = f"🚀 Exciting opportunity: {s.job_title} at {s.company}"
    return subject, _base(content)


def render_rejection(s: RejectionSections) -> tuple[str, str]:
    feedback_block = ""
    if s.feedback:
        feedback_block = f"""\
<div style="background:#f9fafb;border-radius:8px;padding:16px 20px;margin:20px 0;">
  <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#6b7280;">Feedback</p>
  <p style="margin:0;font-size:14px;color:#374151;line-height:1.5;">{s.feedback}</p>
</div>"""

    content = f"""\
<h2 style="margin:0 0 8px;font-size:20px;color:#111827;">{s.greeting}</h2>
{_nl2p(s.body)}
{feedback_block}
{_nl2p(s.closing)}
<p style="font-size:14px;color:#4b5563;margin:24px 0 0;">Warm regards,<br><span style="font-weight:600;color:#111827;">HR Team</span></p>"""

    subject = f"Update on your application — {s.job_title}"
    return subject, _base(content)


def render_reminder(s: ReminderSections) -> tuple[str, str]:
    interviewer_line = f'<p style="margin:4px 0 0;font-size:13px;color:#6b7280;">with {s.interviewer}</p>' if s.interviewer else ""
    tips_html = "".join(f'<li style="margin:4px 0;color:#374151;">{t}</li>' for t in s.tips)

    content = f"""\
<h2 style="margin:0 0 8px;font-size:20px;color:#111827;">{s.greeting}</h2>
{_nl2p(s.body)}

<div style="background:#ecfdf5;border-left:4px solid #10b981;border-radius:0 8px 8px 0;padding:16px 20px;margin:20px 0;">
  <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#059669;">Interview Details</p>
  <p style="margin:0;font-size:16px;font-weight:600;color:#111827;">{s.job_title}</p>
  <p style="margin:8px 0 0;font-size:14px;color:#374151;">📅 {s.interview_date}</p>
  <p style="margin:4px 0 0;font-size:14px;color:#374151;">🕐 {s.interview_time}</p>
  {interviewer_line}
</div>

{"<p style='font-size:14px;color:#374151;font-weight:600;margin:20px 0 8px;'>Tips to prepare:</p><ul style='padding-left:20px;margin:0;'>" + tips_html + "</ul>" if s.tips else ""}

{_nl2p(s.closing)}

<p style="font-size:14px;color:#4b5563;margin:24px 0 0;">Best regards,<br><span style="font-weight:600;color:#111827;">HR Team</span></p>"""

    subject = f"⏰ Reminder: Interview tomorrow — {s.job_title}"
    return subject, _base(content)
