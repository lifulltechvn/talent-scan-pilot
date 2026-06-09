# TalentScan — Project Guide

## Overview

Hệ thống tuyển dụng AI: quét CV, ẩn danh PII, parse & normalize, matching JD, scoring ứng viên.
Gồm 3 phần: Server (FastAPI), Frontend (React SPA), Desktop App (Flet GUI).

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Docker Compose                              │
│                                                                    │
│  ┌─────────┐   ┌──────────────┐   ┌─────────┐   ┌────────────┐ │
│  │  Nginx  │──▶│  Frontend    │   │   API   │   │ PostgreSQL │ │
│  │  :80    │──▶│  :5173       │   │  :8000  │   │  +pgvector │ │
│  └─────────┘   │  React+Vite  │   │ FastAPI │   │  :5432     │ │
│                 └──────────────┘   └────┬────┘   └──────┬─────┘ │
│                                         │                │        │
│                                         └────────────────┘        │
└──────────────────────────────────────────────────────────────────┘

Desktop App (native, Flet GUI) → calls API :8000
```

### Services
| Service | Port | Role |
|---------|------|------|
| nginx | 80 | Reverse proxy (/ → frontend, /api → api) |
| frontend | 5173 | React SPA (dev server) |
| api | 8000 | FastAPI backend |
| db | 5432 | PostgreSQL 16 + pgvector (1024-dim vectors) |

## Tech Stack

### Backend
- Python 3.11, FastAPI, SQLAlchemy 2.0 (async), Alembic
- Auth: JWT HS256 (python-jose) + bcrypt
- AI: AWS Bedrock (Claude Sonnet 4.5, Claude Haiku 4.5, Titan Embed V2)
- Email: SMTP (Mailtrap for dev)
- Scheduler: APScheduler (interview reminders mỗi 1h)
- Vector search: pgvector (cosine distance)

### Frontend
- React 19 + TypeScript 6 + Vite 8
- Tailwind CSS v4 (KHÔNG prefix)
- TanStack Query v5
- react-router-dom v7
- Recharts (charts), lucide-react (icons), dnd-kit (drag&drop)
- Axios (API client, baseURL: `/api/v1`, token từ localStorage)

### Desktop App
- Python + Flet (Flutter-based GUI)
- PyMuPDF (PDF text extraction), python-docx (DOCX)
- Auto-updater (check server version → download → replace)

## Khởi động

```bash
cp .env.example .env
docker compose up -d
docker compose exec api alembic upgrade head  # Lần đầu
```

**Test account**: `hr@test.com` / `test1234`

| URL | Mô tả |
|-----|--------|
| http://localhost | Web Dashboard (qua Nginx) |
| http://localhost:8000/docs | Swagger UI |
| http://localhost:5173 | Frontend direct |

## Database Models

| Table | Mô tả |
|-------|--------|
| users | HR accounts (email, hashed_password, full_name) |
| jobs | Tin tuyển dụng (title, description, required_skills JSONB, embedding 1024-dim) |
| candidates | Ứng viên (structured_data JSONB, embedding 1024-dim, status, match_score) |
| scores | Kết quả scoring (rule_score, llm_score, final_score, classification) |
| job_candidates | Smart Pool matching (similarity_score, skill_score, combined_score) |
| quizzes | Verification quizzes cho ứng viên nghi ngờ AI CV |
| quiz_questions | Câu hỏi quiz (text/radio/checkbox) |
| quiz_responses | Câu trả lời + verdict (credible/vague/suspicious) |
| schedule_slots | Lịch phỏng vấn available |
| schedule_bookings | Booking lịch phỏng vấn (token-based) |
| outreach_logs | Email đã gửi (outreach/rejection/reminder) |
| ai_usage_logs | Track AI usage + cost (model, tokens, feature) |
| interview_feedback | Feedback sau phỏng vấn (rating 1-5, decision) |
| email_templates | Template email customizable |
| audit_logs | Audit trail mọi action |

### Candidate Status Flow
```
new → reviewed → approved / rejected / talent_pool
             ↓
         processing (đang parse CV)
```

### Score Classification
- `gold`: final_score >= 80
- `silver`: final_score >= 50
- `talent_pool`: < 50

## Core Features & API Routers

### 1. Auth (`/api/v1/auth`)
- Login → JWT access_token (30min) + refresh_token (7 days)
- Frontend lưu token vào localStorage, gắn `Authorization: Bearer` header

### 2. CV Upload (`/api/v1/cv`)
- Upload PDF/DOCX → extract text → PII filter (regex) → save file
- Background: AI parse (Claude Haiku tool_use) → structured_data + embedding
- Sau parse: auto Smart Pool matching (pgvector)

### 3. CV Batch (`/api/v1/cv-batch`)
- Upload nhiều CV cùng lúc (từ Desktop App hoặc web)
- Xử lý tuần tự trong worker thread

### 4. Jobs (`/api/v1/jobs`)
- CRUD jobs + auto embedding khi tạo/update
- Sau save: background match tất cả candidates (Smart Pool)

### 5. Candidates (`/api/v1/candidates`)
- List/detail candidates
- Update status, delete
- Compare candidates

### 6. Scoring (`/api/v1/scoring`)
- `POST /jobs/{id}/match`: Match & score tất cả candidates cho 1 job
- Hybrid: Rule-based 70% + Claude Haiku LLM 30%
- Rule components: skills (30%), cosine (25%), experience (20%), education (15%), language (10%)

### 7. Smart Pool (background service)
- Auto-match mỗi candidate mới với TẤT CẢ jobs (pgvector cosine + keyword overlap)
- Auto-match mỗi job mới với top 50 candidates
- Combined: similarity × 0.6 + skill_overlap × 0.4
- Table: `job_candidates`

### 8. Quiz (`/api/v1/quiz`)
- Generate personalized quiz (Claude Sonnet tool_use): 5 câu hỏi verify CV
- Public page (token-based, no auth): candidate trả lời
- AI evaluate → credibility_score 0-100

### 9. Schedule (`/api/v1/schedule`)
- HR tạo slots → gửi link cho candidate (token-based)
- Candidate book slot qua public page
- Scheduler: gửi reminder email 24h trước phỏng vấn

### 10. Outreach (`/api/v1/outreach`)
- Gửi email cho candidates (outreach/rejection/reminder)
- AI generate email content (Claude Haiku)

### 11. Dashboard (`/api/v1/dashboard`)
- Stats tổng quan (total candidates, jobs, scores)

### 12. AI Usage (`/api/v1/ai-usage`)
- Track & display AI cost per feature/model

### 13. Timeline (`/api/v1/timeline`)
- Activity timeline cho candidate (audit log based)

### 14. Email Templates (`/api/v1/email-templates`)
- CRUD email templates (greeting, body, closing, highlights, tips)

### 15. App Version (`/api/v1/app/version`)
- Desktop app auto-update endpoint
- Serve release files từ `server/releases/`

## Frontend Architecture

### Folder Structure
```
frontend/src/
├── app/          # Router + providers (AuthProvider wraps all routes)
├── domain/models/  # TypeScript interfaces (Candidate, Job, Score, User, Interview, TalentPool)
├── data/
│   ├── api/client.ts  # Axios instance (baseURL: /api/v1, token interceptor)
│   ├── di.ts          # Dependency injection (swap mock/real repos)
│   ├── mock/          # Mock data for dev
│   └── repositories/  # API implementations
├── features/
│   ├── auth/          # Login page + useAuth hook (AuthContext)
│   ├── dashboard/     # Overview stats
│   ├── candidates/    # List, detail, compare pages
│   ├── jobs/          # List, detail pages
│   ├── interviews/    # Interview management
│   ├── talent-pool/   # Talent pool view
│   ├── outreach/      # Email outreach
│   ├── cv-upload/     # Upload CV from web
│   ├── quiz/          # Public quiz page (token-based, no auth)
│   ├── schedule/      # Public schedule page (token-based, no auth)
│   └── settings/      # App settings
└── shared/
    ├── components/layout/  # AppLayout (sidebar + header)
    ├── components/ui/      # Badge, EmptyState, LoadingSkeleton, ScoreBar
    ├── hooks/
    └── utils/              # cn() (clsx+tailwind-merge), job-icon
```

### Routing
- Auth required: `/`, `/candidates`, `/candidates/:id`, `/candidates/compare`, `/jobs`, `/jobs/:id`, `/interviews`, `/talent-pool`, `/outreach`, `/cv-upload`, `/settings`
- Public (no auth): `/quiz/:token`, `/schedule/:token`
- Login: `/login`

### State Management
- Server state: TanStack Query v5
- Auth state: React Context (useAuth hook, localStorage token)
- No global state library (zustand/redux) — intentional simplicity

## AI Integration (AWS Bedrock)

| Model | Use Case | Dim |
|-------|----------|-----|
| Claude Sonnet 4.5 | OCR scanned PDF, quiz question generation | — |
| Claude Haiku 4.5 | CV parsing, scoring evaluation, quiz evaluation, outreach emails | — |
| Titan Embed V2 | Text → vector embedding | 1024 |

### Cost Tracking
- Mỗi API call → log vào `ai_usage_logs` (model, feature, tokens, cost_usd)
- Pricing hardcoded trong `bedrock.py`

## PII Filter

Regex-based, detect & mask trước khi gửi AI:
- Email, DOB (dd/mm/yyyy), CCCD (12 digits starting 0), Phone (VN format)
- Output: masked text + extracted PII dict

## Environment Variables (.env)

| Key | Mô tả |
|-----|--------|
| DATABASE_URL | PostgreSQL async connection string |
| SECRET_KEY | JWT signing key |
| APP_VERSION | Current desktop app version |
| AWS_ACCESS_KEY_ID/SECRET | Bedrock credentials |
| AWS_REGION | us-east-1 |
| BEDROCK_MODEL_SONNET/HAIKU/EMBEDDING | Model IDs |
| MAIL_* | SMTP settings (Mailtrap for dev) |

## Desktop App (Release Flow)

1. Sửa `CURRENT_VERSION` trong `app/updater.py`
2. `flet pack main.py --name TalentScan --product-version X.Y.Z`
3. Zip → `server/releases/TalentScan-vX.Y.Z-macos.zip`
4. Update `APP_VERSION` trong `.env`
5. Restart server → client tự detect & update

## Development Notes

- Frontend dùng lazy loading cho tất cả pages (React.lazy + Suspense)
- Backend dùng background threads cho heavy AI tasks (CV parsing, matching)
- Smart Pool matching chạy tự động sau mỗi CV upload hoặc job creation
- Nginx proxy: `/api` → api:8000, `/` → frontend:5173
- Hot reload: cả frontend (Vite HMR) và backend (volume mount) đều live reload
