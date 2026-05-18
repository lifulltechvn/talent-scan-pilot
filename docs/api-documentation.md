# TalentScan Pilot - API Documentation

## Tổng quan

Backend API cho hệ thống quét và đánh giá ứng viên tự động. Xây dựng trên FastAPI + SQLAlchemy (async) + PostgreSQL.

**Base URL:** `/api/v1`  
**Auth:** Bearer token (JWT)

---

## Kiến trúc

```
server/app/
├── main.py              # FastAPI app, router registration
├── schemas.py           # Pydantic models (request/response)
├── routers/
│   ├── candidates.py    # CRUD ứng viên
│   ├── jobs.py          # CRUD công việc
│   └── scoring.py       # Matching & scoring endpoints
├── services/
│   ├── matching.py      # Cosine similarity + keyword matching
│   └── scoring.py       # Rule-based scoring engine
├── seed.py              # Script tạo dữ liệu mẫu
└── tests/
    └── test_w4_matching.py  # Unit tests
```

---

## API Endpoints

### Jobs (`/api/v1/jobs`)

| Method | Path | Mô tả |
|--------|------|--------|
| POST | `/jobs` | Tạo job mới |
| GET | `/jobs` | Danh sách jobs |
| GET | `/jobs/{id}` | Chi tiết job |
| PUT | `/jobs/{id}` | Cập nhật job |
| DELETE | `/jobs/{id}` | Xóa job |

**JobCreate:**
```json
{
  "title": "Backend Engineer",
  "description": "...",
  "required_skills": ["python", "fastapi", "postgresql"],
  "salary_range": "1000-1500 USD",
  "location": "Remote",
  "deadline": "2026-06-01T00:00:00"
}
```

### Candidates (`/api/v1/candidates`)

| Method | Path | Mô tả |
|--------|------|--------|
| POST | `/candidates` | Tạo candidate |
| GET | `/candidates` | Danh sách (filter by job_id, status) |
| GET | `/candidates/{id}` | Chi tiết candidate |
| PATCH | `/candidates/{id}/status` | Cập nhật trạng thái |

**Trạng thái:** `new` → `reviewed` → `approved` / `rejected` / `talent_pool`

**CandidateCreate:**
```json
{
  "job_id": "uuid",
  "structured_data": {
    "skills": ["python", "fastapi"],
    "experience_years": 5,
    "education_level": "bachelor",
    "summary": "..."
  }
}
```

### Scoring (`/api/v1/scoring`)

| Method | Path | Mô tả |
|--------|------|--------|
| POST | `/scoring/jobs/{job_id}/match` | Chạy matching + scoring cho tất cả candidates của job |
| GET | `/scoring/candidates/{id}/score` | Lấy kết quả score của candidate |

---

## Scoring Engine

### 1. Matching (services/matching.py)

Kết hợp 2 phương pháp:

- **Cosine Similarity** (weight: 0.6): So sánh embedding vectors giữa job và candidate
- **Keyword Overlap** (weight: 0.4): Tỷ lệ skills trùng khớp

```
combined_score = cosine_score × 0.6 + keyword_score × 0.4
```

Khi chưa có real embeddings (OpenAI), sử dụng mock embedding (deterministic, dựa trên hash text).

### 2. Rule-based Scoring (services/scoring.py)

Đánh giá theo 3 tiêu chí:

| Tiêu chí | Weight | Logic |
|-----------|--------|-------|
| Skills | 50% | % skills trùng khớp với job requirements |
| Experience | 30% | So sánh số năm kinh nghiệm |
| Education | 20% | So sánh trình độ học vấn (high_school → phd) |

```
rule_score = skills × 0.5 + experience × 0.3 + education × 0.2
```

### 3. Final Score & Classification

```
final_score = (match_combined × 100 + rule_score) / 2
```

| Score | Classification |
|-------|---------------|
| ≥ 80 | 🥇 Gold |
| ≥ 60 | 🥈 Silver |
| < 60 | 📋 Talent Pool |

---

## Response Example (POST /scoring/jobs/{id}/match)

```json
{
  "job_id": "uuid",
  "candidates_scored": 3,
  "results": [
    {
      "candidate_id": "uuid",
      "match_score": 0.72,
      "rule_score": 85.0,
      "final_score": 78.5,
      "classification": "silver"
    }
  ]
}
```

---

## Seed Data

`server/seed.py` tạo dữ liệu mẫu gồm:
- Jobs với required_skills
- Candidates với structured_data (skills, experience, education)
- Chạy: `python server/seed.py`

---

## Tests

```bash
pytest server/tests/test_w4_matching.py -v
```

Covers:
- Cosine similarity calculation
- Keyword match scoring
- Combined match score
- Rule-based scoring (skills, experience, education)
- Classification logic
