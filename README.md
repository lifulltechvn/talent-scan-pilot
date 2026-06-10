# TalentScan — AI CV Screening System

Hệ thống tuyển dụng AI: upload CV → parse & ẩn danh PII → auto-matching Jobs → scoring → interview scheduling.

## Tech Stack

- **Backend:** FastAPI + SQLAlchemy 2.0 (async) + Alembic
- **Database:** PostgreSQL 16 + pgvector (vector search 1024-dim)
- **AI:** AWS Bedrock (Claude Sonnet/Haiku + Titan Embed V2)
- **Auth:** JWT (python-jose HS256) + bcrypt
- **Infra:** Docker Compose (4 containers: Nginx + FastAPI + PostgreSQL + React)
- **Frontend:** React 19 + Vite + TypeScript + Tailwind CSS v4 + TanStack Query v5

---

## Yêu cầu

- Docker & Docker Compose
- AWS credentials (cho AI features: parse CV, scoring, embedding)

---

## Setup lần đầu

```bash
# 1. Clone & config
git clone <repo-url>
cd talent-scan-pilot
cp .env.example .env
# Sửa .env: thêm AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY

# 2. Start services
docker compose up -d

# 3. Tạo database tables
docker compose exec api alembic upgrade head

# 4. (Optional) Seed data test
docker compose exec api python seed.py
```

Truy cập: http://localhost

**Test account:** `hr@test.com` / `test1234`

---

## Cấu trúc Project

```
talent-scan-pilot/
├── docker-compose.yml              # 4 services: db, api, frontend, nginx
├── .env                            # Biến môi trường (không commit)
├── .env.example                    # Template env
├── reset-db.sh                     # Script reset DB giữ users
├── nginx/nginx.conf                # Reverse proxy
├── server/                         # Backend — FastAPI
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── seed.py                     # Seed test data
│   ├── alembic/                    # DB migrations
│   └── app/
│       ├── main.py                 # FastAPI entrypoint
│       ├── config.py               # Settings từ .env
│       ├── database.py             # Async SQLAlchemy session
│       ├── models.py               # ORM models
│       ├── auth.py                 # JWT + bcrypt
│       ├── schemas.py              # Pydantic schemas
│       ├── deps.py                 # Auth dependency
│       ├── bedrock.py              # AWS Bedrock client (AI)
│       ├── extractor.py            # PDF/DOCX text extraction
│       ├── pii_filter.py           # PII anonymization (regex)
│       ├── scheduler.py            # APScheduler (reminders)
│       ├── routers/
│       │   ├── auth.py             # Login/register/refresh
│       │   ├── candidates.py       # CRUD + matched-jobs
│       │   ├── jobs.py             # CRUD + suggest/assign/score
│       │   ├── cv_upload.py        # Single CV upload
│       │   ├── cv_batch.py         # Batch CV upload (200 files)
│       │   ├── interviews.py       # Interview calendar CRUD + feedback
│       │   ├── scoring.py          # Score endpoints
│       │   ├── dashboard.py        # Dashboard overview API
│       │   ├── quiz.py             # Quiz verify ứng viên
│       │   ├── schedule.py         # Public booking slots
│       │   ├── outreach.py         # Email outreach
│       │   └── ...
│       └── services/
│           ├── cv_upload.py        # CV processing pipeline
│           ├── cv_batch_worker.py  # Background batch processor
│           ├── smart_pool.py       # pgvector auto-matching
│           ├── scoring.py          # Rule + LLM scoring
│           └── matching.py         # Embedding similarity
└── frontend/                       # Web Dashboard — React
    ├── Dockerfile
    ├── vite.config.ts
    └── src/
        ├── app/                    # Router + providers
        ├── domain/models/          # TypeScript interfaces
        ├── data/                   # API client, repositories
        ├── features/
        │   ├── auth/               # Login page
        │   ├── dashboard/          # Tổng quan
        │   ├── candidates/         # Danh sách & chi tiết ứng viên
        │   ├── jobs/               # Tin tuyển dụng & scoring detail
        │   ├── interviews/         # Calendar phỏng vấn
        │   ├── cv-upload/          # Upload CV (single & batch)
        │   └── ...
        └── shared/                 # Layout, UI components, utils
```

---

## Luồng hoạt động chính

```
Upload CV → Extract text → PII filter → AI Parse → Embedding
                                                        ↓
                                              Smart Pool auto-match
                                                        ↓
Job Detail → Suggest → Assign → Full Scoring (Rule 70% + AI 30%)
                                                        ↓
                                        Gold / Silver / Talent Pool
                                                        ↓
                                HR review → Approve → Book Interview
                                                        ↓
                                              Feedback → Hire / Reject
```

---

## Commands thường dùng

```bash
# Start/stop
docker compose up -d              # Start tất cả
docker compose stop               # Dừng (giữ data)
docker compose down               # Dừng + xóa containers
docker compose down -v            # ⚠️ Xóa tất cả kể cả data

# Logs
docker compose logs api -f        # Xem log API realtime
docker compose logs frontend -f   # Xem log frontend

# Database
docker compose exec api alembic upgrade head    # Chạy migrations
docker compose exec db psql -U talent -d talentscan  # Truy cập DB
./reset-db.sh                     # Reset DB, giữ users

# Frontend
docker compose exec frontend npm install <pkg>  # Cài package mới

# Restart sau khi sửa code
docker compose restart api        # Backend (auto-reload có sẵn)
docker compose restart frontend   # Frontend (HMR có sẵn)
```

---

## Truy cập

| URL | Mô tả |
|-----|-------|
| http://localhost | Web Dashboard (qua Nginx) |
| http://localhost:8000/docs | Swagger UI — test API |
| http://localhost:5173 | Frontend dev (direct, bypass nginx) |

---

## Environment Variables

| Variable | Mô tả | Bắt buộc |
|----------|--------|----------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `SECRET_KEY` | JWT signing key | ✅ |
| `AWS_ACCESS_KEY_ID` | AWS credentials cho Bedrock | ✅ (cho AI) |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials | ✅ (cho AI) |
| `AWS_REGION` | AWS region | ✅ |
| `MAIL_SERVER` | SMTP server | Optional |
| `MAIL_USERNAME` | SMTP username | Optional |
| `MAIL_PASSWORD` | SMTP password | Optional |

---

## Scoring System

**Final Score** = Rule Score × 70% + LLM Score × 30%

| Thành phần | Trọng số | Mô tả |
|---|---|---|
| Skills | 30% | % skill ứng viên khớp với job |
| Experience | 20% | Số năm kinh nghiệm vs yêu cầu |
| Education | 15% | Trình độ học vấn vs yêu cầu |
| Language | 10% | Có ngoại ngữ |
| LLM (AI) | 30% | AI phân tích tổng quan |

**Classification:** Gold (≥80) · Silver (≥50) · Talent Pool (<50)
