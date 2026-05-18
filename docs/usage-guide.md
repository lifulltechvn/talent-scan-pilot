# TalentScan - Hướng dẫn sử dụng

## 1. Cài đặt & Khởi chạy

### Yêu cầu
- Docker & Docker Compose
- (Optional) Python 3.11+ nếu chạy local không dùng Docker

### Khởi chạy bằng Docker (khuyến nghị)

```bash
cd ~/Documents/talent-scan-pilot

# Copy env
cp .env.example .env

# Start all services (DB + API + Frontend + Nginx)
docker compose up -d

# Kiểm tra
docker compose ps
```

Services:
| Service | URL | Mô tả |
|---------|-----|--------|
| API | http://localhost:8000 | FastAPI backend |
| Frontend | http://localhost:5173 | React frontend |
| App | http://localhost:80 | Nginx proxy (production-like) |
| DB | localhost:5432 | PostgreSQL + pgvector |

### Chạy local (không Docker)

```bash
cd server
pip install -r requirements.txt

# Start DB
docker compose up db -d

# Run migrations
alembic upgrade head

# Start API
uvicorn app.main:app --reload --port 8000
```

---

## 2. Tạo dữ liệu mẫu

```bash
# Trong Docker
docker compose exec api python seed.py

# Hoặc local
cd server && python seed.py
```

---

## 3. Sử dụng API

### 3.1 Đăng ký & Đăng nhập

```bash
# Đăng ký
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","full_name":"Test User"}'

# Đăng nhập → lấy token
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

Response:
```json
{"access_token": "eyJ...", "refresh_token": "eyJ...", "token_type": "bearer"}
```

Sử dụng token cho các request tiếp theo:
```bash
export TOKEN="eyJ..."
```

### 3.2 Tạo Job

```bash
curl -X POST http://localhost:8000/api/v1/jobs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Senior Backend Engineer",
    "description": "Build scalable APIs",
    "required_skills": ["python", "fastapi", "postgresql", "docker"],
    "salary_range": "3000-5000 USD",
    "location": "Remote"
  }'
```

### 3.3 Tạo Candidate

```bash
curl -X POST http://localhost:8000/api/v1/candidates \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "job_id": "<job_id từ bước trên>",
    "structured_data": {
      "skills": ["python", "fastapi", "docker", "aws"],
      "experience_years": 5,
      "education_level": "bachelor",
      "summary": "5 years backend development experience"
    }
  }'
```

### 3.4 Chạy Matching & Scoring

```bash
# Score tất cả candidates của 1 job
curl -X POST http://localhost:8000/api/v1/scoring/jobs/<job_id>/match \
  -H "Authorization: Bearer $TOKEN"
```

Response:
```json
{
  "job_id": "...",
  "candidates_scored": 2,
  "results": [
    {
      "candidate_id": "...",
      "match_score": 0.72,
      "rule_score": 85.0,
      "final_score": 78.5,
      "classification": "silver"
    }
  ]
}
```

### 3.5 Xem Score chi tiết

```bash
curl http://localhost:8000/api/v1/scoring/candidates/<candidate_id>/score \
  -H "Authorization: Bearer $TOKEN"
```

### 3.6 Cập nhật trạng thái Candidate

```bash
curl -X PATCH "http://localhost:8000/api/v1/candidates/<id>/status?new_status=approved" \
  -H "Authorization: Bearer $TOKEN"
```

Trạng thái hợp lệ: `new`, `reviewed`, `approved`, `rejected`, `talent_pool`

---

## 4. API Docs (Swagger)

Truy cập: http://localhost:8000/docs

---

## 5. Chạy Tests

```bash
# Trong Docker
docker compose exec api pytest tests/ -v

# Local
cd server && pytest tests/ -v
```

---

## 6. Scoring Logic

```
Final Score = (Match Score × 100 + Rule Score) / 2

Match Score = Cosine Similarity × 0.6 + Keyword Overlap × 0.4
Rule Score  = Skills × 0.5 + Experience × 0.3 + Education × 0.2

Classification:
  ≥ 80 → Gold
  ≥ 60 → Silver
  < 60 → Talent Pool
```
