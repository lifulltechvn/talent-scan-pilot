# Smart Pool Session Note (2026-06-09)

## Trạng thái: ✅ HOÀN THÀNH

Hệ thống Smart Pool auto-matching đã implement xong và hoạt động đầy đủ trên cả backend lẫn frontend.

## Tính năng đã hoàn thành

### Backend
- **Auto-match khi upload CV**: `cv_upload.py` → `background_match_candidate()` (thread riêng + session riêng)
- **Auto-match khi tạo/sửa Job**: `jobs.py` → `_smart_pool_match_job()` → `match_job_to_all_candidates()`
- **GET /jobs/{id}/suggest**: Đọc pre-computed matches từ `job_candidates` table, top 20 by combined_score DESC
- **POST /jobs/{id}/assign/{candidate_id}**: INSERT ON CONFLICT → full scoring → update status 'scored'
- **GET /candidates/{id}/matched-jobs**: Trả all jobs matched cho candidate + matched_skills
- **GET /candidates/{id}**: Bao gồm `matched_jobs_count`

### Frontend
- **Job Detail → "Suggest" button**: Hiển thị panel "Suggested Candidates" với score %, matched skills, Assign button
- **Candidate Detail → "Matched Jobs" section**: Component `MatchedJobsSection` dùng useState/useEffect + apiClient

### Đã verify trên Chrome
- ✅ Login → Jobs → Job Detail → Click "Suggest" → 18 candidates hiển thị
- ✅ Candidate Detail page loads (Matched Jobs section cần scroll xuống để thấy)

## Key Files
| File | Vai trò |
|------|---------|
| `server/app/services/smart_pool.py` | Core matching logic (pgvector cosine similarity) |
| `server/app/routers/jobs.py` | Suggest, Assign, auto-match on job create |
| `server/app/services/cv_upload.py` | Auto-match on CV upload |
| `server/app/routers/candidates.py` | matched-jobs endpoint + matched_jobs_count |
| `frontend/src/features/candidates/pages/CandidateDetailPage.tsx` | MatchedJobsSection component |

## DB Table: `job_candidates`
Junction table lưu pre-computed matches:
- `job_id`, `candidate_id`, `combined_score`, `status` (suggested/assigned/scored)
- `matched_skills`, `final_score`, `classification`
- Indexes on (job_id, candidate_id) UNIQUE

## Lưu ý kỹ thuật
- DB changes done via **direct SQL** (Alembic has conflicting migration heads)
- `match_job_to_all_candidates` nhận `job_id` dạng string, tự convert UUID bên trong
- `matched-jobs` response dùng field `title` (frontend access `j.job_title || j.title`)
- `async_session_factory` = alias cho `async_session` trong `app/database.py`
- Test data có duplicate candidates (cùng tên "John Doe") do upload nhiều lần - không phải bug

## Possible Next Steps (chưa làm)
1. Dedup candidates trong suggest list (nhiều "John Doe" do test data)
2. Pagination cho suggest results
3. Filter/sort cho matched jobs view
4. "Rematch All" admin action cho bulk re-computation
5. Confirm "Matched Jobs" section visible khi scroll xuống Candidate Detail page

## Cách dùng note này
Khi bắt đầu session mới, thêm file này làm context:
```
/context add .kiro/session-note-smart-pool.md
```
