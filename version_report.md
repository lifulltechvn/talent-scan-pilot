# Version Report — 2026-05-22

## Summary

Major update: Email system, Quiz redesign, UI/UX improvements, APScheduler, Talent Pool re-match.

---

## Setup after pull

```bash
# 1. Rebuild containers (new dependency: apscheduler)
docker compose up -d --build

# 2. Run migrations (0005 → 0007)
docker compose exec api alembic upgrade head

# 3. Copy env if first time
cp .env.example .env
# Then fill in MAIL_USERNAME and MAIL_PASSWORD with Mailtrap credentials
```

---

## Changes

### Server

| File | Change |
|------|--------|
| `requirements.txt` | Added `apscheduler==3.11.0` |
| `app/config.py` | Added MAIL_* settings (read from env) |
| `app/main.py` | Added lifespan + scheduler startup |
| `app/database.py` | Added `async_session_factory` alias |
| `app/models.py` | `QuizQuestion`: added `options` (JSONB). `ScheduleBooking`: added `reminder_sent`. `OutreachLog`: `candidate_id` nullable, added `to_email` |
| `app/scheduler.py` | **New** — APScheduler: interview reminders (hourly) |
| `app/services/email.py` | **New** — Abstract EmailService + SMTP/SES implementations |
| `app/services/email_templates.py` | **New** — Branded HTML templates (outreach/rejection/reminder) with editable sections |
| `app/routers/outreach.py` | Rewritten — `POST /preview` (get default text), `POST /send` (send with edited sections), `GET /logs` |
| `app/routers/quiz.py` | `question_type` now `text/radio/checkbox`, added `options` to schema, mixed question generation |
| `app/routers/jobs.py` | Added Talent Pool re-match background task on job creation |

### Migrations

| Migration | Description |
|-----------|-------------|
| `0005_add_quiz_options.py` | Add `options` JSONB column to `quiz_questions` |
| `0006_outreach_nullable_candidate.py` | Make `outreach_logs.candidate_id` nullable, add `to_email` |
| `0007_add_reminder_sent.py` | Add `reminder_sent` boolean to `schedule_bookings` |

### Frontend

| File | Change |
|------|--------|
| `features/jobs/pages/JobDetailPage.tsx` | Added: Outreach modal, Edit Job modal, Quiz modal (hidden), Approve/Reject with ActionModal + EmailCompose, candidate count from real data |
| `features/jobs/pages/JobsPage.tsx` | Fixed candidate count (was hardcoded 0, now from API) |
| `features/jobs/hooks/useJobs.ts` | Added `useUpdateJob` hook |
| `features/candidates/pages/CandidateDetailPage.tsx` | Removed Approve/Reject/Email buttons (moved to Job Detail) |
| `features/quiz/pages/QuizPublicPage.tsx` | Redesigned: supports radio/checkbox/text, card layout, gradient bg |
| `features/schedule/pages/SchedulePublicPage.tsx` | Redesigned: card wrapper, better empty state, gradient bg |
| `features/settings/pages/SettingsPage.tsx` | **New** — Settings page (Email/Reminders/Security info) |
| `app/router.tsx` | Added `/settings` route |
| `data/repositories/jobs.api.ts` | Added `update` method |
| `domain/models/repositories.ts` | Added `update` to `IJobRepository` |

### Config

| File | Change |
|------|--------|
| `.env` | Added MAIL_* variables |
| `.env.example` | **New** — Template with placeholder credentials |

---

## Architecture decisions

- **Email**: Abstract `EmailService` interface → switch SMTP/SES via `MAIL_PROVIDER` env var
- **Quiz types**: `question_type` = `text` | `radio` | `checkbox`, options stored as JSONB array
- **Approve/Reject flow**: Moved to Job Detail with modal: "Action Only" or "Action + Send Email" (opens compose modal)
- **Outreach**: Sent from Job Detail (external candidates, HR inputs email). Rejection/Reminder sent from Approve/Reject flow
- **Talent Pool re-match**: Background task on job creation, matches candidates with ≥2 overlapping skills
- **APScheduler**: Runs hourly, sends reminder 24h before interview (checks `schedule_bookings` joined with `schedule_slots`)

---

## API endpoints (new/changed)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/outreach/preview` | Get default editable text for template |
| POST | `/api/v1/outreach/send` | Send email with HR-edited sections |
| GET | `/api/v1/outreach/logs` | List sent emails |
| PUT | `/api/v1/jobs/{id}` | Update job (existing, now used by frontend) |
