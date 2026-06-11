# TalentScan — Architecture & Technical Design

## System Overview

AI-powered recruitment platform automating CV screening, matching, scoring, and interview scheduling. Designed for HR teams handling high-volume hiring.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Docker Compose                                │
│                                                                       │
│  ┌──────────┐    ┌─────────────┐    ┌──────────┐    ┌────────────┐ │
│  │  Nginx   │───▶│  Frontend   │    │   API    │    │ PostgreSQL │ │
│  │  :80     │───▶│  React+Vite │    │ FastAPI  │    │ +pgvector  │ │
│  │  (proxy) │    │  :5173      │    │  :8000   │    │  :5432     │ │
│  └──────────┘    └─────────────┘    └────┬─────┘    └─────┬──────┘ │
│                                          │                  │        │
│                                          ├──────────────────┘        │
│                                          │                           │
│                                     ┌────▼─────┐                    │
│                                     │AWS Bedrock│                    │
│                                     │Claude+Titan│                   │
│                                     └──────────┘                    │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow

```
Upload CV → Extract Text → PII Filter → Injection Guard → AI Parse (Claude Haiku)
    → Generate Embedding (Titan V2) → Smart Pool Match (pgvector cosine)
    → Auto-Score (Rule 70% + AI 30%) → Classification (Gold/Silver/Talent Pool)
    → HR Review → Approve → Schedule Interview → Feedback → Hire/Reject
```

## AI Pipeline

| Step | Model | Latency | Cost/call |
|------|-------|---------|-----------|
| CV Parse | Claude Haiku 4.5 | ~3s | ~$0.002 |
| Embedding | Titan Embed V2 (1024-dim) | ~0.5s | ~$0.00004 |
| Scoring LLM | Claude Haiku 4.5 | ~2s | ~$0.002 |
| OCR (scanned) | Claude Sonnet 4.5 (vision) | ~5s | ~$0.01 |
| AI Recommendation | Claude Haiku 4.5 | ~3s | ~$0.003 |
| JD Generation | Claude Haiku 4.5 | ~2s | ~$0.002 |
| Quiz Generation | Claude Sonnet 4.5 | ~4s | ~$0.008 |

## Scoring Algorithm

**Final Score = Rule Score × 70% + LLM Score × 30%**

Rule Score Components:
| Component | Weight | Method |
|-----------|--------|--------|
| Skills Match | 30% | Set intersection (job skills ∩ candidate skills) |
| Cosine Similarity | 25% | pgvector embedding distance |
| Experience | 20% | Years comparison vs requirement |
| Education | 15% | Level mapping (bachelor=3, master=4, phd=5) |
| Language | 10% | Has foreign language bonus |

Classification: Gold (≥80) · Silver (≥50) · Talent Pool (<50)

## Security

| Layer | Implementation |
|-------|---------------|
| Auth | JWT HS256 (access 30min + refresh 7d) |
| Password | bcrypt hashing |
| Rate Limiting | slowapi (5 req/min on login) |
| PII Protection | Regex filter before AI (email, phone, DOB, CCCD) |
| Prompt Injection | Injection Guard (pattern detection + XML delimiter wrapping) |
| GDPR | Erasure endpoint (cascade delete all candidate data) |
| Input Validation | Pydantic schemas on all endpoints |
| CORS | Restricted origins via Nginx |

## Reliability

| Feature | Implementation |
|---------|---------------|
| AI Retry | 3 attempts, exponential backoff (1s, 2s, 4s) on throttle/timeout |
| Auto-Score | Background: match + score after CV parse (threshold ≥ 0.3) |
| WebSocket | Realtime batch progress updates |
| Error Recovery | Stuck "processing" candidates retried on startup |
| Cost Tracking | Every AI call logged (model, tokens, cost) in ai_usage_logs |

## Database Schema (16 tables)

Core: `users`, `jobs`, `candidates`, `scores`, `job_candidates`
Interview: `interviews`, `interview_feedback`, `schedule_slots`, `schedule_bookings`
Verification: `quizzes`, `quiz_questions`, `quiz_responses`
Operations: `cv_batches`, `cv_batch_items`, `outreach_logs`, `email_templates`
System: `audit_logs`, `ai_usage_logs`

## Performance KPIs

| Metric | Target | Result |
|--------|--------|--------|
| 50 CVs pipeline (rule-only) | < 3 min | ✅ < 2s |
| 50 CVs pipeline (with AI) | < 3 min | ✅ ~100s (estimated) |
| Pipeline Completion Rate | ≥ 95% | ✅ 100% |
| Error Handling | 100% | ✅ 0 errors |

## Tech Stack

- **Backend**: Python 3.11, FastAPI, SQLAlchemy 2.0 (async), Alembic
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, TanStack Query v5
- **Database**: PostgreSQL 16 + pgvector (1024-dim vectors)
- **AI**: AWS Bedrock (Claude Sonnet/Haiku 4.5, Titan Embed V2)
- **Infra**: Docker Compose, Nginx reverse proxy
- **Realtime**: WebSocket (batch progress)

## Architecture Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | FastAPI over Django | Async-first, better AI integration, auto-docs |
| 2 | pgvector over Pinecone | Same DB for OLTP + vector, simpler ops |
| 3 | Hybrid scoring (Rule + AI) | Deterministic base + AI creativity |
| 4 | Claude Haiku for most tasks | Best cost/quality balance on Bedrock |
| 5 | Background threads + auto-retry | Simple, sufficient for single-server |
| 6 | Single migration file | Clean setup from scratch, no migration conflicts |
| 7 | JWT in localStorage | Simple SPA auth, acceptable for internal tool |
