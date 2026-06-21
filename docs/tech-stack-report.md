# Tech Stack - Team Mansion
---
## 1. Requirements & Constraints
| Item | Content |
| --- | --- |
| Project | AI-powered HR Recruitment System: scan CVs, anonymize PII, parse & normalize, match JDs, score candidates, auto outreach, smart quiz verification |
| Contest Topic | AI CV Screening |
| Target Users | HR team / Recruiters at LFTV |
| Team Size | 3 members |
| Development Period | 4/2026 ~ 6/2026 |
| Development Approach | ☑ Sprint |
| Project Scale | ☑ Large |

**Key Technical Challenges:**
- Accurate text extraction from Vietnamese CVs (scanned PDFs, images) — requires Claude Sonnet Vision OCR via Bedrock
- Reliable PII detection and anonymization before sending data to AI — Regex pre-filter + structured masking
- Consistent CV parsing across varied formats — Claude Haiku with tool_use structured output + Skill Dictionary
- Meaningful semantic matching between CV and JD — Amazon Titan Embedding V2 1024-dim + cosine similarity + keyword overlap
- Keeping cost minimal for seasonal usage (only certain days/year) — EC2 Stop/Start + Haiku for simple tasks
- Detecting AI-generated CVs and verifying candidate credibility — Smart Quiz with AI-generated personalized questions

---
## 2. Architecture Overview
```
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND — React 19 SPA (Vite + Tailwind + i18n)               │
│                                                                  │
│  ├── CV Upload (batch drag-drop, 200 files/batch)                │
│  ├── Dashboard (stats, funnel, hiring analytics)                 │
│  ├── Candidates (Kanban, Compare, Detail + Sidebar)              │
│  ├── Jobs (CRUD, Import JD, Suggest, Assign)                     │
│  ├── Interviews (Calendar, Feedback, Round-based email)          │
│  ├── Settings (Email Templates editor)                           │
│  └── Public: Quiz + Schedule (token-based, no auth)              │
└─────────────────────────────────────┬───────────────────────────┘
                                      │ HTTPS
                                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  Docker Compose — 4 Containers                                   │
│                                                                  │
│  ├── Nginx (reverse proxy, serve React static)                   │
│  ├── FastAPI (Python 3.11, 16 API routers)                       │
│  │     ├── CV Upload: PyMuPDF extract → PII mask → AI parse      │
│  │     │   → inject PII back (AI never sees real email/phone)    │
│  │     ├── Matching (pgvector cosine + keyword overlap)           │
│  │     ├── Scoring (rule 70% + Claude Haiku 30%)                 │
│  │     ├── Smart Pool (auto re-match on new JD)                  │
│  │     ├── Email (SMTP/SES, branded templates, round-based)      │
│  │     ├── APScheduler (30min + 24h interview reminders)         │
│  │     └── Token usage logging (every AI call tracked)           │
│  ├── PostgreSQL 16 + pgvector (1024-dim vectors)                 │
│  └── Frontend (React static / Vite HMR dev)                      │
│                                                                  │
│   External: AWS Bedrock (Claude Haiku 4.5 + Sonnet Vision + Titan│
│   Email: Mailtrap (dev) / AWS SES (prod)                         │
└─────────────────────────────────────────────────────────────────┘
```

| Component | Technology | Purpose |
| --- | --- | --- |
| Language | Python 3.11+ / TypeScript | Python for backend + AI pipeline; TypeScript for React frontend |
| Frontend Framework | React 19 + Vite 8 + Tailwind CSS v4 | Web Dashboard SPA. Nginx serves static files |
| Backend Framework | FastAPI | REST API server (async, Pydantic validation, 16 routers) |
| AI Orchestration | Direct Bedrock API (boto3) | No LangChain — direct calls with retry + tool_use for structured output |
| AI / LLM | AWS Bedrock — Claude Haiku 4.5 + Sonnet 4.5 Vision | Parse + Score + Outreach + Quiz + OCR |
| Embedding | AWS Bedrock — Amazon Titan Embedding V2 | 1024-dim vectors for CV and JD matching |
| Database | PostgreSQL 16 + pgvector | Primary DB + vector storage for semantic matching |
| Infrastructure | AWS EC2 (Stop/Start) | LFTV AWS account |
| Repository | https://github.com/lifulltechvn | Private repo |

---
## 3. Evaluation Criteria
| Symbol | Meaning |
| --- | --- |
| ◎ | Very suitable |
| ○ | Suitable |
| △ | Has risks / needs consideration |
| ✗ | Not suitable |

| Criteria | Basis for judgment |
| --- | --- |
| **System** | Does it solve the technical challenges well? (OCR accuracy, PII safety, matching quality, performance) |
| **Business** | Does it contribute to business goals? (development speed, cost under 4M VND, time to release) |
| **Team** | Can the current team use it? (existing Python/React experience, learning cost) |
| **Organization** | Is it aligned with company direction? (LFTV common stack, AWS policy) |
| **Hiring** | Is it easy to hire people who know this technology? (market adoption) |

---
## 4. Technology Selection & Rationale

### A. Language → Python 3.11+ / TypeScript
| Option | System | Business | Team | Organization | Hiring |
| --- | --- | --- | --- | --- | --- |
| **Python + TypeScript** | ◎ | ◎ | ◎ | ○ | ◎ |
| Python only (+ Flet GUI) | ○ | ○ | ◎ | △ | ○ |
| TypeScript full-stack | ○ | ○ | ○ | ○ | ◎ |

| Option | Pros | Cons |
| --- | --- | --- |
| **Python + TypeScript** | Best AI ecosystem (boto3, PyMuPDF). React for rich dashboard UI | Two languages to maintain |
| Python only | Single language. Flet for desktop | Flet limited for complex dashboard UX |
| TypeScript full-stack | Unified language, Vercel AI SDK | Weaker PDF extraction libraries, no PyMuPDF |

→ Python backend (best AI/ML ecosystem + boto3 native) + TypeScript frontend (React team experience, rich UI components)

---
### B. Frontend Framework → React 19 + Vite 8
| Option | System | Business | Team | Organization | Hiring |
| --- | --- | --- | --- | --- | --- |
| **React 19 + Vite** | ◎ | ◎ | ◎ | ○ | ◎ |
| Next.js | ◎ | ○ | ○ | ○ | ◎ |
| Vue 3 | ○ | ○ | △ | ○ | ○ |

| Option | Pros | Cons |
| --- | --- | --- |
| **React 19 + Vite** | Team experienced. Fast HMR. Builds to static (no Node runtime on server). TanStack Query for data fetching | Need manual routing setup |
| Next.js | SSR, built-in routing | Overkill for internal tool. Needs Node.js runtime on server |
| Vue 3 | Simple, lightweight | Team less experienced. Smaller component ecosystem |

→ React + Vite: team most experienced, builds to static files served by Nginx, no Node.js needed on production server.

---
### C. Backend Framework → FastAPI
| Option | System | Business | Team | Organization | Hiring |
| --- | --- | --- | --- | --- | --- |
| **FastAPI** | ◎ | ◎ | ◎ | ○ | ○ |
| Django REST | ○ | ○ | ○ | ○ | ◎ |
| Express (Node) | ○ | ○ | ○ | ○ | ◎ |

| Option | Pros | Cons |
| --- | --- | --- |
| **FastAPI** | Pydantic validation critical for LLM JSON output. Native async. Auto OpenAPI docs. Same Python as AI pipeline | Smaller ecosystem than Django |
| Django REST | Mature, batteries included | Heavy for API-only. Sync by default. Pydantic not native |
| Express | Familiar, large ecosystem | Python AI libraries not accessible. Separate process needed for AI |

→ FastAPI: Pydantic validates LLM structured output, async for concurrent AI calls, auto docs for frontend integration.

---
### D. AI Orchestration → Direct Bedrock API (boto3)
| Option | System | Business | Team | Organization | Hiring |
| --- | --- | --- | --- | --- | --- |
| **Direct API (boto3)** | ◎ | ◎ | ○ | ◎ | ○ |
| LangChain | ○ | △ | ○ | ○ | ○ |
| LlamaIndex | ○ | △ | △ | ○ | △ |

| Option | Pros | Cons |
| --- | --- | --- |
| **Direct API (boto3)** | Full control. No abstraction overhead. Lightweight. IAM auth native. Custom retry logic | Must implement retry/streaming manually |
| LangChain | Rich RAG pipeline, chains | Heavy dependency (200+ packages). Abstraction hides errors. Overkill for our use case |
| LlamaIndex | Good for document Q&A | Not needed — we don't do RAG/Q&A. Heavy dependency |

→ Direct boto3: our pipeline is linear (extract→mask→parse→embed→score), no complex chains needed. Custom retry with exponential backoff. Full control over token logging and cost tracking.

---
### E. AI / LLM → Claude Haiku 4.5 + Sonnet 4.5 (AWS Bedrock)
| Option | System | Business | Team | Organization | Hiring |
| --- | --- | --- | --- | --- | --- |
| **Claude Haiku + Sonnet (Bedrock)** | ◎ | ◎ | ○ | ◎ | ○ |
| GPT-4o (OpenAI) | ◎ | ○ | ◎ | ○ | ◎ |
| Gemini (Google) | ○ | ◎ | ○ | △ | ○ |
| KEEL AI | △ | ○ | △ | ◎ | - |

| Option | Pros | Cons |
| --- | --- | --- |
| **Claude (Bedrock)** | Same AWS account — IAM auth, no API key. tool_use stable for structured output. Data stays within AWS. Two-tier: Sonnet (complex) + Haiku (simple) saves 40% cost | Smaller community than OpenAI |
| GPT-4o | Excellent quality. json_schema response_format | Separate vendor + API key. Data leaves AWS. Single pricing tier |
| Gemini | Large context window. Affordable | Structured output less reliable. Separate vendor |
| KEEL AI | Internal, no setup | Performance unknown. May not support tool_use |

→ Claude (Bedrock): same AWS ecosystem, IAM-based auth, data stays within AWS. Two-tier model strategy:
- **Claude Sonnet 4.5** ($3/$15 per 1M tokens) — complex tasks: Vision OCR, Quiz generation
- **Claude Haiku 4.5** ($1/$5 per 1M tokens) — simple tasks: CV parse, Scoring, Email generation
- Reduces cost by using cheaper model for ~60% of API calls.

⚠️ Confirmed compliance with [AIサービス利用一覧](https://docs.google.com/spreadsheets/d/1S8Vihnd9AQdA0anDi91mXNOineEWRBJoX-SJy14PyoA/edit?gid=0#gid=0) and [AIサービスの利用ガイドライン](https://jira.next-group.jp/wiki/pages/viewpage.action?pageId=353662683).

---
### F. Database → PostgreSQL 16 + pgvector
| Option | System | Business | Team | Organization | Hiring |
| --- | --- | --- | --- | --- | --- |
| **PostgreSQL + pgvector (on EC2)** | ◎ | ◎ | ◎ | ○ | ◎ |
| PostgreSQL (RDS) + pgvector | ◎ | △ | ◎ | ◎ | ◎ |
| Pinecone (managed vector DB) | ○ | △ | △ | △ | △ |

| Option | Pros | Cons |
| --- | --- | --- |
| **PostgreSQL + pgvector (EC2)** | Vector search native via SQL. Single DB for everything. Saves ~$15/mo vs RDS. Sufficient for internal tool with low concurrency | Must manage own backups |
| PostgreSQL (RDS) | Managed, auto backups | ~$15/month minimum. Overkill for seasonal usage |
| Pinecone | Purpose-built vector DB, scalable | Separate vendor. Cost ~$70/mo. Overkill for ~1000 vectors |

→ pgvector in PostgreSQL on EC2: vector search natively via SQL (`<=>` operator), no separate vector DB needed. Single database for all data + vectors. Cost = $0 (runs on same EC2).

---
### G. Infrastructure → AWS EC2 Stop/Start
| Option | System | Business | Team | Organization | Hiring |
| --- | --- | --- | --- | --- | --- |
| **AWS (LFTV account)** | ○ | ◎ | ◎ | ◎ | - |

All services hosted on **AWS using LFTV account**.

| Service | Purpose | Cost |
| --- | --- | --- |
| EC2 t3.medium (Stop/Start) | Backend hosting (FastAPI + Nginx + PostgreSQL + Frontend) | ~$10/year (seasonal) |
| EBS gp3 20GB | OS + Docker + DB data | ~$19/year |
| AWS Bedrock | AI services (Claude Haiku + Sonnet + Titan Embed V2) | ~$43-51/year (1000 CVs) |
| Let's Encrypt | SSL certificate via Nginx | $0 |

---
## 5. Cost Estimate
| Item | Service | Unit Cost | Monthly Estimate (VNĐ) |
| --- | --- | --- | --- |
| LLM API (parse+score) | Claude Haiku 4.5 (Bedrock) | ~$0.002/CV parse + $0.003/CV score | ~17K (~100 CVs/month during recruitment) |
| LLM API (OCR) | Claude Sonnet 4.5 Vision | ~$0.02/page (scanned only) | ~25K (est. 50 scanned CVs) |
| Embedding | Titan Embed V2 | ~$0.0004/CV | ~1K |
| Backend hosting | EC2 t3.medium (seasonal use) | $0.0416/hour | ~15K/month prorated |
| Database | PostgreSQL on EC2 (same instance) | $0 (included in EC2) | 0 |
| Storage | EBS gp3 20GB | $0.08/GB/month | ~40K |
| DNS + SSL | Let's Encrypt | $0 | 0 |
| Email (dev) | Mailtrap Free | $0 | 0 |
| **Total** | | | **~98K/month ≈ 1.2M VNĐ/year** |

**Budget limit: ≤ 4,000,000 VNĐ/năm** ✅ (actual ~1.2M VNĐ — well within budget)

---
## 6. Items for Detailed Design (to be discussed later)
| Item | Content |
| --- | --- |
| Authentication & Authorization | JWT (HS256), access 24h + refresh 7 days, role-based (admin/hr/interviewer) |
| Security | PII regex mask before AI, prompt injection guard, rate limiting (slowapi), file validation |
| Testing Strategy | Unit tests (pytest), integration test (matching+scoring), benchmark script |
| Environment Setup | Docker Compose (dev), EC2 deploy (prod), .env for secrets |
| Monitoring | AI Usage Log (per-call token tracking), request timing middleware (>100ms), WebSocket batch progress |
| Data Model | 15 tables: users, jobs, candidates, scores, quizzes, quiz_questions, quiz_responses, schedule_slots, schedule_bookings, outreach_logs, ai_usage_logs, interview_feedback, job_candidates, email_templates, cv_batches |

---
## 7. Library Reliability
| Technology | GitHub | ⭐ Stars | License |
| --- | --- | --- | --- |
| FastAPI | https://github.com/fastapi/fastapi | 82K+ | MIT |
| React | https://github.com/facebook/react | 233K+ | MIT |
| Vite | https://github.com/vitejs/vite | 71K+ | MIT |
| PyMuPDF | https://github.com/pymupdf/PyMuPDF | 5K+ | AGPL-3.0 ⚠️ |
| pgvector | https://github.com/pgvector/pgvector | 13K+ | PostgreSQL License |
| SQLAlchemy | https://github.com/sqlalchemy/sqlalchemy | 10K+ | MIT |
| Alembic | https://github.com/sqlalchemy/alembic | 3K+ | MIT |
| Pydantic | https://github.com/pydantic/pydantic | 22K+ | MIT |
| boto3 (AWS SDK) | https://github.com/boto/boto3 | 9K+ | Apache 2.0 |
| APScheduler | https://github.com/agronholm/apscheduler | 6K+ | MIT |
| python-docx | https://github.com/python-openxml/python-docx | 4.5K+ | MIT |
| slowapi | https://github.com/laurentS/slowapi | 1K+ | MIT |
| Tailwind CSS | https://github.com/tailwindlabs/tailwindcss | 85K+ | MIT |
| TanStack Query | https://github.com/TanStack/query | 43K+ | MIT |
| Recharts | https://github.com/recharts/recharts | 24K+ | MIT |
| React Router | https://github.com/remix-run/react-router | 53K+ | MIT |
| @dnd-kit | https://github.com/clauderic/dnd-kit | 13K+ | MIT |
| Lucide React | https://github.com/lucide-icons/lucide | 12K+ | ISC |
