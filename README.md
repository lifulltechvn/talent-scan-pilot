# TalentScan — AI CV Screening System

Hệ thống tuyển dụng AI: quét CV, ẩn danh PII, parse & normalize, matching JD, scoring ứng viên.

## Yêu cầu

- Docker & Docker Compose

## Khởi động

```bash
# 1. Clone và vào thư mục project
cd talent-scan-pilot

# 2. Tạo file .env (lần đầu)
cp .env.example .env

# 3. Start toàn bộ (PostgreSQL + pgvector, FastAPI, Nginx)
docker compose up -d

# 4. Chạy migration tạo database tables (lần đầu)
docker compose exec api alembic upgrade head
```

Xong! Truy cập:

| URL | Mô tả |
|-----|-------|
| http://localhost:8000/docs | Swagger UI — test API trực tiếp trên trình duyệt |
| http://localhost/api/v1/health | Health check qua Nginx |

## Dừng / Khởi động lại

```bash
docker compose stop     # Dừng (giữ data)
docker compose start    # Khởi động lại
docker compose down     # Dừng + xóa containers (data PostgreSQL vẫn giữ trong volume)
docker compose down -v  # Dừng + xóa tất cả kể cả data (⚠️ mất hết DB)
```

## Sử dụng API

### 1. Tạo tài khoản

```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "hr@company.com", "password": "MyPass123!", "full_name": "HR Admin"}'
```

### 2. Đăng nhập (lấy token)

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -d "username=hr@company.com&password=MyPass123!"
```

Response trả về `access_token` và `refresh_token`.

### 3. Gọi API có xác thực

```bash
curl http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer <access_token>"
```

### 4. Refresh token

```bash
curl -X POST http://localhost:8000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "<refresh_token>"}'
```

> 💡 **Tip:** Mở http://localhost:8000/docs trên trình duyệt để dùng Swagger UI — không cần gõ curl, click thẳng để test.

## Cấu trúc project

```
talent-scan-pilot/
├── docker-compose.yml        # 3 services: db, api, nginx
├── .env                      # Biến môi trường (không commit)
├── nginx/nginx.conf          # Reverse proxy config
└── server/
    ├── Dockerfile
    ├── requirements.txt
    ├── alembic.ini
    ├── alembic/              # DB migrations
    └── app/
        ├── main.py           # FastAPI entrypoint
        ├── config.py         # Settings từ .env
        ├── database.py       # Async SQLAlchemy session
        ├── models.py         # DB models (User, Job, Candidate, Score, AuditLog)
        ├── auth.py           # JWT + bcrypt
        ├── schemas.py        # Pydantic schemas
        ├── deps.py           # Auth dependency
        └── routers/auth.py   # Auth endpoints
```

## Tech Stack

- **Backend:** FastAPI + SQLAlchemy 2.0 (async) + Alembic
- **Database:** PostgreSQL 16 + pgvector (vector search 1536-dim)
- **Auth:** JWT (python-jose HS256) + bcrypt
- **Infra:** Docker Compose (3 containers: Nginx + FastAPI + PostgreSQL)
