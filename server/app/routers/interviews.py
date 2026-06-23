"""Interviews API — CRUD for calendar events + feedback."""
import json
import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/interviews", tags=["interviews"])


async def _pre_generate_question_bank(candidate_id: str):
    """Background task: generate question bank for candidate skills."""
    import re
    import uuid as _uuid
    from app.database import async_session_factory
    from app.models import Candidate
    from app.routers.question_bank import _determine_level, CATEGORIES
    from app.bedrock import invoke_claude
    from app.config import settings

    try:
        async with async_session_factory() as _db:
            candidate = await _db.get(Candidate, _uuid.UUID(candidate_id))
            if not candidate:
                return
            d = candidate.structured_data or {}
            skills = d.get("skills", [])[:6]
            if not skills:
                return
            level = _determine_level(d.get("experience_years", 0))
            for category in CATEGORIES:
                cached = await _db.execute(text("SELECT COUNT(*) FROM question_cache WHERE skill = ANY(:skills) AND level = :level AND category = :cat"), {"skills": [s.lower().strip() for s in skills], "level": level, "cat": category})
                if (cached.scalar() or 0) >= 5:
                    continue
                skills_str = ', '.join(skills[:5])
                prompt = f"""Generate exactly 5 interview questions for a {level}-level developer.\nCategory: {category}\nSkills to cover (pick from these): {skills_str}\n\nFor each question provide:\n- skill: which skill this question tests\n- question: the interview question (1-2 sentences)\n- answer: the correct/expected answer (2-3 sentences, specific and technical)\n- trap: red flag if candidate doesn't know (1 sentence)\n\nReply ONLY a valid JSON array of exactly 5 objects:\n[{{"skill": "...", "question": "...", "answer": "...", "trap": "..."}}]"""
                try:
                    import asyncio
                    loop = asyncio.get_event_loop()
                    raw = await loop.run_in_executor(None, lambda: invoke_claude(prompt, model=settings.BEDROCK_MODEL_HAIKU, max_tokens=1200, feature="question_bank", candidate_id=candidate_id))
                    cleaned = re.sub(r'^```(?:json)?\s*', '', raw.strip())
                    cleaned = re.sub(r'\s*```$', '', cleaned)
                    cleaned = re.sub(r',\s*]', ']', cleaned)
                    try:
                        questions = json.loads(cleaned)
                    except json.JSONDecodeError:
                        match = re.search(r'\[.*\]', cleaned, re.DOTALL)
                        questions = json.loads(match.group()) if match else []
                    for q in questions:
                        await _db.execute(text("INSERT INTO question_cache (skill, level, category, question, answer, trap) VALUES (:skill, :level, :cat, :q, :a, :t)"),
                            {"skill": q.get("skill", "").lower().strip(), "level": level, "cat": category, "q": q["question"], "a": q["answer"], "t": q["trap"]})
                    await _db.commit()
                except Exception:
                    pass
        logger.info(f"Question bank pre-generated for candidate {candidate_id}")
    except Exception as e:
        logger.warning(f"Question bank pre-generation failed: {e}")


class InterviewCreate(BaseModel):
    candidate_id: str
    job_id: str | None = None
    title: str
    start_time: str  # ISO
    end_time: str    # ISO
    notes: str | None = None
    interviewer_emails: list[str] = []
    interviewer_ids: list[str] = []
    round: int = 1
    proposed_salary: str | None = None
    meeting_link: str | None = None
    interview_type: str = "online"  # online / onsite


class InterviewUpdate(BaseModel):
    title: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    notes: str | None = None
    interviewer_emails: list[str] | None = None
    status: str | None = None
    round: int | None = None
    proposed_salary: str | None = None
    meeting_link: str | None = None
    interview_type: str | None = None


class FeedbackCreate(BaseModel):
    score: int  # 1-5
    notes: str | None = None
    decision: str  # pass / fail / next_round


class FeedbackNotesCreate(BaseModel):
    notes: str


@router.get("")
async def list_interviews(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all interviews as calendar events."""
    rows = await db.execute(text("""
        SELECT i.*, c.structured_data->>'name' as candidate_name, j.title as job_title
        FROM interviews i
        LEFT JOIN candidates c ON c.id = i.candidate_id
        LEFT JOIN jobs j ON j.id = i.job_id
        ORDER BY i.start_time
    """))
    out = [
        {
            "id": str(r["id"]),
            "candidate_id": str(r["candidate_id"]),
            "candidate_name": r["candidate_name"] or "Unknown",
            "job_id": str(r["job_id"]) if r["job_id"] else None,
            "job_title": r["job_title"],
            "title": r["title"],
            "start_time": r["start_time"].isoformat(),
            "end_time": r["end_time"].isoformat(),
            "notes": r["notes"],
            "interviewer_emails": r["interviewer_emails"] or [],
            "status": r["status"],
            "round": r["round"],
            "proposed_salary": r["proposed_salary"],
            "meeting_link": r["meeting_link"],
            "interview_type": r["interview_type"],
            "feedback_score": r["feedback_score"],
            "feedback_notes": r["feedback_notes"],
            "feedback_decision": r["feedback_decision"],
            "feedback_by": r.get("feedback_by"),
        }
        for r in rows.mappings().all()
    ]

    # Attach per-interviewer feedback for each interview
    if out:
        iids = [item["id"] for item in out]
        fb_rows = await db.execute(text("""
            SELECT ii.interview_id::text, ii.score, ii.notes, ii.submitted_at, u.full_name
            FROM interview_interviewers ii
            JOIN users u ON u.id = ii.user_id
            WHERE ii.interview_id::text = ANY(:iids) AND ii.score IS NOT NULL
            ORDER BY ii.submitted_at
        """), {"iids": iids})
        fb_map: dict = {}
        for fb in fb_rows.mappings().all():
            fb_map.setdefault(str(fb["interview_id"]), []).append({
                "name": fb["full_name"], "score": fb["score"], "notes": fb["notes"],
            })
        for item in out:
            item["interviewer_feedback"] = fb_map.get(item["id"], [])

    return out


@router.post("", status_code=201)
async def create_interview(
    body: InterviewCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a new interview event. Email sent separately via /send-invitation."""
    # Block scheduling if candidate was rejected for this specific job
    if body.job_id:
        rej_check = await db.execute(text("""
            SELECT 1 FROM job_candidates WHERE candidate_id = :cid AND job_id = :jid AND status = 'rejected'
        """), {"cid": body.candidate_id, "jid": body.job_id})
        if rej_check.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Candidate was rejected for this job")
    from datetime import datetime as dt
    start = dt.fromisoformat(body.start_time)
    end = dt.fromisoformat(body.end_time)

    # Check interviewer time conflicts
    if body.interviewer_ids:
        conflicts = await db.execute(text("""
            SELECT u.full_name, i.title, i.start_time, i.end_time
            FROM interview_interviewers ii
            JOIN interviews i ON i.id = ii.interview_id
            JOIN users u ON u.id = ii.user_id
            WHERE ii.user_id = ANY(:uids)
              AND i.status = 'scheduled'
              AND i.start_time < :end AND i.end_time > :start
        """), {"uids": body.interviewer_ids, "start": start, "end": end})
        conflict_list = conflicts.mappings().all()
        if conflict_list:
            names = list(set(c["full_name"] for c in conflict_list))
            raise HTTPException(status_code=400, detail=f"Interviewer bị trùng lịch: {', '.join(names)}")

    interview_id = uuid.uuid4()
    await db.execute(text("""
        INSERT INTO interviews (id, candidate_id, job_id, title, start_time, end_time, notes, interviewer_emails, round, proposed_salary, meeting_link, interview_type, created_by)
        VALUES (:id, :cid, :jid, :title, :start, :end, :notes, :emails, :round, :salary, :link, :type, :uid)
    """), {
        "id": str(interview_id), "cid": body.candidate_id,
        "jid": body.job_id, "title": body.title,
        "start": start, "end": end,
        "notes": body.notes, "emails": json.dumps(body.interviewer_emails),
        "round": body.round,
        "salary": body.proposed_salary, "link": body.meeting_link,
        "type": body.interview_type, "uid": str(user.id),
    })
    # Update candidate status to pending (interview scheduled)
    await db.execute(text("UPDATE candidates SET status = 'pending' WHERE id = :cid AND status = 'assigned'"), {"cid": body.candidate_id})
    # Link interviewers (user accounts)
    for uid in body.interviewer_ids:
        await db.execute(text("INSERT INTO interview_interviewers (interview_id, user_id) VALUES (:iid, :uid) ON CONFLICT DO NOTHING"), {"iid": str(interview_id), "uid": uid})
    await db.commit()

    # Pre-generate questions in background (non-blocking)
    if body.job_id:
        import threading
        def _gen_questions():
            import asyncio
            from app.services.smart_questions import get_or_create_question_set
            from app.database import async_session as _session
            async def _do():
                async with _session() as _db:
                    job_row = await _db.execute(text("SELECT title, required_skills, category FROM jobs WHERE id = :id"), {"id": body.job_id})
                    job = job_row.mappings().first()
                    if not job:
                        return
                    cand_row = await _db.execute(text("SELECT structured_data->>'experience_years' as ey FROM candidates WHERE id = :id"), {"id": body.candidate_id})
                    cand = cand_row.mappings().first()
                    exp = int(cand["ey"] or 0) if cand and cand["ey"] else 0
                    locale_row = await _db.execute(text("SELECT value FROM master_config WHERE key = 'app_locale'"))
                    locale = (locale_row.scalar() or "vi")
                    result = await get_or_create_question_set(_db, body.job_id, job["required_skills"] or [], job["title"] or "", body.round, exp, locale, job["category"])
                    if result:
                        await _db.execute(text("UPDATE interviews SET question_set_id = :qid WHERE id = :id"), {"qid": result["id"], "id": str(interview_id)})
                        await _db.commit()
            loop = asyncio.new_event_loop()
            try:
                loop.run_until_complete(_do())
            except Exception:
                pass
            finally:
                loop.close()
        threading.Thread(target=_gen_questions, daemon=True).start()

    # Pre-generate question bank (per candidate skills) in background
    background_tasks.add_task(_pre_generate_question_bank, body.candidate_id)

    return {"id": str(interview_id), "status": "scheduled", "round": body.round}


class InterviewEmailPreview(BaseModel):
    candidate_id: str
    round: int = 1
    start_time: str
    end_time: str
    title: str = "Interview"
    meeting_link: str | None = None


@router.post("/email-preview")
async def get_interview_email_preview(
    body: InterviewEmailPreview,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Generate email preview based on round number."""
    from app.models import Candidate
    candidate = await db.get(Candidate, body.candidate_id)
    name = candidate.structured_data.get("name", "Candidate") if candidate else "Candidate"
    email = candidate.structured_data.get("email", "") if candidate else ""
    from datetime import datetime as dt
    start = dt.fromisoformat(body.start_time)
    end = dt.fromisoformat(body.end_time)
    date_str = start.strftime("%A, %B %d, %Y")
    time_str = f"{start.strftime('%I:%M %p')} — {end.strftime('%I:%M %p')}"

    if body.round == 1:
        subject = f"📅 Interview Invitation — {body.title}"
        greeting = f"Hi {name}! 👋"
        email_body = f"We're pleased to invite you for an interview for the {body.title} position.\n\nPlease find the details below:"
        closing = "Looking forward to meeting you! If you need to reschedule, please reply to this email."
    elif body.round == 2:
        subject = f"🎉 Next Round — {body.title}"
        greeting = f"Congratulations {name}! 🎉"
        email_body = f"Great news! You've passed the first round. We'd like to invite you to the next stage of our interview process for {body.title}."
        closing = "Keep up the great work! Let us know if the time doesn't work for you."
    else:
        subject = f"⭐ Final Round — {body.title}"
        greeting = f"Hi {name},"
        email_body = f"You're in the final stage! We'd like to schedule a final discussion for the {body.title} position."
        closing = "Almost there! We're excited to have this conversation with you."

    return {
        "to_email": email,
        "subject": subject,
        "greeting": greeting,
        "body": email_body,
        "date": date_str,
        "time": time_str,
        "meeting_link": body.meeting_link,
        "closing": closing,
    }


class SendInvitationRequest(BaseModel):
    candidate_id: str
    to_email: str
    subject: str
    greeting: str
    body: str
    date: str
    time: str
    meeting_link: str | None = None
    closing: str
    bcc: list[str] = []


@router.post("/send-invitation", status_code=201)
async def send_invitation_email(
    body: SendInvitationRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Send interview invitation email (HR-edited content)."""
    from app.services.email import get_email_service
    from app.services.email_templates import _base, _button, ACCENT

    meeting_block = f'<p style="font-size:14px;color:#374151;margin:8px 0;">🔗 <a href="{body.meeting_link}" style="color:{ACCENT}">{body.meeting_link}</a></p>' if body.meeting_link else ""

    html_content = f"""\
<h2 style="margin:0 0 8px;font-size:20px;color:#111827;">{body.greeting}</h2>
<p style="font-size:14px;color:#4b5563;line-height:1.6;margin:0 0 16px;">{body.body}</p>
<div style="background:#ecfdf5;border-left:4px solid #10b981;border-radius:0 8px 8px 0;padding:16px 20px;margin:20px 0;">
  <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#059669;">Interview Details</p>
  <p style="margin:8px 0 0;font-size:14px;color:#374151;">📅 {body.date}</p>
  <p style="margin:4px 0 0;font-size:14px;color:#374151;">🕐 {body.time}</p>
  {meeting_block}
</div>
<p style="font-size:14px;color:#4b5563;line-height:1.6;margin:20px 0;">{body.closing}</p>
<p style="font-size:14px;color:#4b5563;margin:24px 0 0;">Best regards,<br><span style="font-weight:600;color:#111827;">HR Team</span></p>"""

    html = _base(html_content)

    try:
        get_email_service().send(to=body.to_email, subject=body.subject, html_body=html, bcc=body.bcc)
        return {"status": "sent"}
    except Exception as e:
        raise HTTPException(502, f"Email delivery failed: {e}")


@router.put("/{interview_id}")
async def update_interview(
    interview_id: uuid.UUID,
    body: InterviewUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update an interview (reschedule, change status)."""
    sets = []
    params = {"id": str(interview_id)}
    if body.title: sets.append("title = :title"); params["title"] = body.title
    if body.start_time: sets.append("start_time = :start"); params["start"] = datetime.fromisoformat(body.start_time)
    if body.end_time: sets.append("end_time = :end"); params["end"] = datetime.fromisoformat(body.end_time)
    if body.notes is not None: sets.append("notes = :notes"); params["notes"] = body.notes
    if body.status: sets.append("status = :status"); params["status"] = body.status
    if body.round is not None: sets.append("round = :round"); params["round"] = body.round
    if body.proposed_salary is not None: sets.append("proposed_salary = :salary"); params["salary"] = body.proposed_salary
    if body.meeting_link is not None: sets.append("meeting_link = :link"); params["link"] = body.meeting_link
    if body.interview_type is not None: sets.append("interview_type = :type"); params["type"] = body.interview_type
    if body.interviewer_emails is not None: sets.append("interviewer_emails = :emails"); params["emails"] = json.dumps(body.interviewer_emails)
    if not sets:
        raise HTTPException(400, "Nothing to update")
    await db.execute(text(f"UPDATE interviews SET {', '.join(sets)} WHERE id = :id"), params)
    await db.commit()
    return {"status": "updated"}


@router.post("/{interview_id}/notes")
async def add_interview_notes(
    interview_id: uuid.UUID,
    body: FeedbackNotesCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Save interview notes (during or after interview, before final decision)."""
    await db.execute(text("UPDATE interviews SET feedback_notes = :notes WHERE id = :id"), {"notes": body.notes, "id": str(interview_id)})
    await db.commit()
    return {"status": "notes_saved"}


@router.post("/{interview_id}/feedback")
async def add_feedback(
    interview_id: uuid.UUID,
    body: FeedbackCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Add interviewer feedback (score + notes). Each interviewer has their own feedback."""
    # Save per-interviewer feedback
    await db.execute(text("""
        INSERT INTO interview_interviewers (interview_id, user_id, score, notes, submitted_at)
        VALUES (:iid, :uid, :score, :notes, NOW())
        ON CONFLICT (interview_id, user_id) DO UPDATE SET score = :score, notes = :notes, submitted_at = NOW()
    """), {"iid": str(interview_id), "uid": str(user.id), "score": body.score, "notes": body.notes})

    # Also update interview-level feedback (latest, for backward compat)
    await db.execute(text("""
        UPDATE interviews SET feedback_score = :score, feedback_notes = :notes,
            feedback_by = :by, status = 'completed'
        WHERE id = :id
    """), {"score": body.score, "notes": body.notes, "by": user.full_name, "id": str(interview_id)})

    await db.commit()
    return {"status": "feedback_added"}


@router.get("/{interview_id}/feedback")
async def get_all_feedback(
    interview_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get all interviewers' feedback for an interview. HR/Admin see all, interviewer sees only own."""
    if user.role in ('admin', 'hr'):
        rows = await db.execute(text("""
            SELECT ii.score, ii.notes, ii.submitted_at, u.full_name, u.email
            FROM interview_interviewers ii
            JOIN users u ON u.id = ii.user_id
            WHERE ii.interview_id = :iid AND ii.score IS NOT NULL
            ORDER BY ii.submitted_at
        """), {"iid": str(interview_id)})
    else:
        rows = await db.execute(text("""
            SELECT ii.score, ii.notes, ii.submitted_at, u.full_name, u.email
            FROM interview_interviewers ii
            JOIN users u ON u.id = ii.user_id
            WHERE ii.interview_id = :iid AND ii.user_id = :uid AND ii.score IS NOT NULL
        """), {"iid": str(interview_id), "uid": str(user.id)})

    return [
        {"score": r["score"], "notes": r["notes"], "submitted_at": r["submitted_at"].isoformat() if r["submitted_at"] else None, "name": r["full_name"], "email": r["email"]}
        for r in rows.mappings().all()
    ]


class DecisionRequest(BaseModel):
    decision: str  # pass / next_round / fail


@router.post("/{interview_id}/decision")
async def hr_decision(
    interview_id: uuid.UUID,
    body: DecisionRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """HR makes final decision on candidate after reviewing interviewer feedback."""
    if user.role not in ('admin', 'hr'):
        raise HTTPException(403, "Only HR/Admin can make decisions")
    if body.decision not in ('pass', 'fail', 'next_round'):
        raise HTTPException(400, "Invalid decision")

    await db.execute(text("""
        UPDATE interviews SET feedback_decision = :decision, status = 'completed' WHERE id = :id
    """), {"decision": body.decision, "id": str(interview_id)})

    # Update candidate status
    if body.decision in ('pass', 'fail'):
        new_status = 'approved' if body.decision == 'pass' else 'rejected'
        await db.execute(text("""
            UPDATE job_candidates SET status = :status
            WHERE candidate_id = (SELECT candidate_id FROM interviews WHERE id = :iid)
              AND job_id = (SELECT job_id FROM interviews WHERE id = :iid)
        """), {"status": new_status, "iid": str(interview_id)})
        await db.execute(text("""
            UPDATE candidates SET status = :status
            WHERE id = (SELECT candidate_id FROM interviews WHERE id = :iid)
              AND NOT EXISTS (
                SELECT 1 FROM job_candidates jc
                WHERE jc.candidate_id = (SELECT candidate_id FROM interviews WHERE id = :iid)
                  AND jc.job_id != (SELECT job_id FROM interviews WHERE id = :iid)
                  AND jc.status IN ('assigned', 'scored')
              )
        """), {"status": new_status, "iid": str(interview_id)})

    await db.commit()
    return {"status": "decided", "decision": body.decision}


@router.delete("/{interview_id}")
async def delete_interview(
    interview_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Cancel/delete an interview."""
    # Get candidate_id before deleting
    row = await db.execute(text("SELECT candidate_id FROM interviews WHERE id = :id"), {"id": str(interview_id)})
    interview = row.mappings().first()
    await db.execute(text("DELETE FROM interviews WHERE id = :id"), {"id": str(interview_id)})
    # Revert candidate status from pending to assigned if no other interviews exist
    if interview:
        cid = str(interview["candidate_id"])
        remaining = await db.execute(text("SELECT 1 FROM interviews WHERE candidate_id = :cid LIMIT 1"), {"cid": cid})
        if not remaining.first():
            await db.execute(text("UPDATE candidates SET status = 'assigned' WHERE id = :cid AND status = 'pending'"), {"cid": cid})
    await db.commit()
    return {"status": "deleted"}


@router.get("/my")
async def my_interviews(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get interviews assigned to current user (for interviewer role)."""
    rows = await db.execute(text("""
        SELECT i.*, c.structured_data as candidate_data, c.structured_data->>'name' as candidate_name, c.cv_file_path, j.title as job_title, j.required_skills as job_skills
        FROM interviews i
        LEFT JOIN candidates c ON c.id = i.candidate_id
        LEFT JOIN jobs j ON j.id = i.job_id
        WHERE i.id IN (
            SELECT interview_id FROM interview_interviewers WHERE user_id = :uid
        ) OR i.interviewer_emails::text LIKE :email_pattern
        ORDER BY i.start_time
    """), {"uid": str(user.id), "email_pattern": f"%{user.email}%"})
    results = []
    for r in rows.mappings().all():
        # Get this interviewer's own feedback only
        own_fb = await db.execute(text("""
            SELECT score, notes, submitted_at FROM interview_interviewers
            WHERE interview_id = :iid AND user_id = :uid
        """), {"iid": str(r["id"]), "uid": str(user.id)})
        own = own_fb.mappings().first()

        # Get smart question score + G-level
        qs_row = await db.execute(text("SELECT iqs.total_score, iqs.max_score, iqs.percentage, iqs.scores, iqset.questions_en FROM interview_question_scores iqs LEFT JOIN interview_question_sets iqset ON iqset.id = iqs.question_set_id WHERE iqs.interview_id = :iid"), {"iid": str(r["id"])})
        qs_score = qs_row.mappings().first()
        question_score_data = None
        if qs_score:
            from app.services.smart_questions import assess_g_level
            g_assessment = None
            if qs_score["questions_en"] and qs_score["scores"]:
                questions_en = qs_score["questions_en"] if isinstance(qs_score["questions_en"], list) else json.loads(qs_score["questions_en"])
                scores_data = qs_score["scores"] if isinstance(qs_score["scores"], list) else json.loads(qs_score["scores"])
                g_assessment = assess_g_level(questions_en, scores_data)
            question_score_data = {"total": float(qs_score["total_score"]), "max": float(qs_score["max_score"]), "percentage": float(qs_score["percentage"]), "g_level": g_assessment["g_level"] if g_assessment else None}
        results.append({
            "id": str(r["id"]),
            "candidate_id": str(r["candidate_id"]),
            "candidate_name": r["candidate_name"] or "Unknown",
            "candidate_profile": {
                "skills": (r["candidate_data"] or {}).get("skills", []),
                "experience": (r["candidate_data"] or {}).get("experience", []),
                "education": (r["candidate_data"] or {}).get("education", []),
                "experience_years": (r["candidate_data"] or {}).get("experience_years", 0),
                "languages": (r["candidate_data"] or {}).get("languages", []),
                "insight": (r["candidate_data"] or {}).get("insight"),
            },
            "cv_file_path": r.get("cv_file_path"),
            "job_title": r["job_title"],
            "job_skills": r["job_skills"] or [],
            "title": r["title"],
            "start_time": r["start_time"].isoformat(),
            "end_time": r["end_time"].isoformat(),
            "notes": r["notes"],
            "status": r["status"],
            "round": r["round"],
            "meeting_link": r["meeting_link"],
            "interview_type": r["interview_type"],
            "feedback_score": own["score"] if own else None,
            "feedback_notes": own["notes"] if own else None,
            "feedback_decision": None,
            "feedback_by": None,
            "question_score": question_score_data,
            "previous_feedback": [],
        })
    return results
