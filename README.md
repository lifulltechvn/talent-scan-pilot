# TalentScan — AI CV Screening System

Hệ thống tuyển dụng AI: quét CV, ẩn danh PII, parse & normalize, matching JD, scoring ứng viên.

Gồm 3 phần:

- **Server** (Docker) — FastAPI + PostgreSQL + Nginx: API, matching, scoring, dashboard
- **Frontend** (Docker) — React SPA: dashboard cho HR
- **Desktop App** (native) — Flet GUI: quét CV trên máy HR, trích xuất text từ PDF/DOCX

## Yêu cầu

- Docker & Docker Compose
- Python 3.11–3.13 (cho Desktop App)

---

## Khởi động

### 1. Server + Frontend (Docker)

```bash
cd talent-scan-pilot
cp .env.example .env                          # Lần đầu
docker compose up -d                          # Start tất cả
docker compose exec api alembic upgrade head  # Tạo DB tables (lần đầu)
```

### 2. Desktop App (native trên máy)

```bash
cd app
python3.13 -m venv .venv        # Tạo venv (lần đầu)
source .venv/bin/activate       # macOS/Linux
# .venv\Scripts\activate        # Windows
pip install -r requirements.txt # Cài dependencies (lần đầu)
python main.py                  # Chạy app
```

App mở cửa sổ native → nhấn **"📂 Chọn file CV"** → chọn PDF/DOCX → xem kết quả trích xuất.

- **Digital PDF/DOCX** → trích xuất text ngay (PyMuPDF / python-docx)
- **Scanned PDF** (ảnh, không có text) → đánh dấu "cần OCR" (GPT-4o Vision — sẽ tích hợp ở W6)

---

## Truy cập

| URL | Mô tả |
|-----|-------|
| http://localhost | Web Dashboard (qua Nginx) |
| http://localhost:8000/docs | Swagger UI — test API trên trình duyệt |
| http://localhost:5173 | Frontend dev (direct) |

**Test account:** `hr@test.com` / `test1234`

---

## Dừng / Khởi động lại

```bash
docker compose stop     # Dừng (giữ data)
docker compose start    # Khởi động lại
docker compose down     # Dừng + xóa containers (data vẫn giữ trong volume)
docker compose down -v  # ⚠️ Xóa tất cả kể cả data
```

---

## Cấu trúc project

```
talent-scan-pilot/
├── docker-compose.yml          # 4 services: db, api, frontend, nginx
├── .env                        # Biến môi trường (không commit)
├── nginx/nginx.conf            # Reverse proxy
├── server/                     # Backend — FastAPI (Docker)
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── releases/               # App binaries cho client download (.zip)
│   ├── alembic/                # DB migrations
│   └── app/
│       ├── main.py             # FastAPI entrypoint
│       ├── config.py           # Settings từ .env
│       ├── database.py         # Async SQLAlchemy session
│       ├── models.py           # User, Job, Candidate, Score, AuditLog
│       ├── auth.py             # JWT + bcrypt
│       ├── schemas.py          # Pydantic schemas
│       ├── deps.py             # Auth dependency
│       └── routers/
│           ├── auth.py         # Auth endpoints
│           └── app_version.py  # App version + download endpoints
├── frontend/                   # Web Dashboard — React (Docker)
│   ├── Dockerfile
│   ├── vite.config.ts
│   └── src/
│       ├── app/                # Router + providers
│       ├── domain/models/      # Candidate, Job, Score, User, Interview, TalentPool
│       ├── data/               # API client, mock data, DI
│       ├── features/           # auth, dashboard, candidates, jobs, interviews, talent-pool
│       └── shared/             # Layout, UI components, utils
└── app/                        # Desktop App — Flet GUI (native)
    ├── requirements.txt        # flet, PyMuPDF, python-docx, pydantic
    ├── main.py                 # Flet GUI: file picker, progress, results
    ├── extractor.py            # Text extraction: PDF (PyMuPDF) + DOCX (python-docx)
    └── updater.py              # Auto-updater: check version, download, replace
```

---

## Build & Release Desktop App

### Build (macOS)

```bash
cd app
source .venv/bin/activate
pip install pyinstaller        # Lần đầu
flet pack main.py \
  --name "TalentScan" \
  --product-name "TalentScan" \
  --product-version "1.0.5" \
  --bundle-id "com.lifull.talentscan" \
  -y
```

Output: `app/dist/TalentScan.app`

### Đưa lên server để client download

```bash
cd app/dist
zip -r ../../server/releases/TalentScan-v1.0.5-macos.zip TalentScan.app
```

Cập nhật `APP_VERSION` trong `.env` cho khớp version mới.

### API phân phối

| Endpoint | Mô tả |
|----------|--------|
| `GET /api/v1/app/version` | Trả version mới nhất + download URLs |
| `GET /api/v1/app/download/{filename}` | Download file release |

### Flow release version mới

1. Sửa `CURRENT_VERSION` trong `app/updater.py`
2. Build app bằng `flet pack`
3. Nén zip vào `server/releases/`
4. Cập nhật `APP_VERSION` trong `.env`
5. Restart server → client tự detect và cập nhật

---

## Tech Stack

- **Backend:** FastAPI + SQLAlchemy 2.0 (async) + Alembic
- **Database:** PostgreSQL 16 + pgvector (vector search 1536-dim)
- **Auth:** JWT (python-jose HS256) + bcrypt
- **Infra:** Docker Compose (4 containers: Nginx + FastAPI + PostgreSQL + Frontend)
- **Frontend:** React 19 + Vite + TypeScript + Tailwind CSS v4 + TanStack Query v5
- **Desktop App:** Python + Flet (Flutter-based GUI) + PyMuPDF + python-docx
