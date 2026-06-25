# TalentScan — Kịch bản Test Case đầy đủ

## Thông tin môi trường
- URL: http://localhost
- Test account: `hr@test.com` / `test1234`
- Hỗ trợ 3 ngôn ngữ: English, Tiếng Việt, 日本語

---

## 1. Authentication (Đăng nhập / Xác thực)

| # | Test Case | Bước thực hiện | Kết quả mong đợi |
|---|-----------|----------------|-------------------|
| 1.1 | Đăng nhập thành công | Nhập `hr@test.com` / `test1234` → Login | Chuyển sang Dashboard |
| 1.2 | Email rỗng | Bỏ trống email → Login | Hiện lỗi theo ngôn ngữ: "Email is required" / "Email không được để trống" / "メールアドレスは必須です" |
| 1.3 | Email sai format | Nhập `abc` → Login | Hiện lỗi: "Email is invalid" / "Email không hợp lệ" / "メールアドレスが無効です" |
| 1.4 | Mật khẩu rỗng | Bỏ trống password → Login | Hiện lỗi theo ngôn ngữ |
| 1.5 | Mật khẩu < 6 ký tự | Nhập password `123` | Hiện lỗi: min 6 chars |
| 1.6 | Sai thông tin đăng nhập | Nhập sai password | Hiện "Login failed" |
| 1.7 | Logout | Click Logout | Quay về trang Login |

---

## 2. Đa ngôn ngữ (i18n)

| # | Test Case | Bước thực hiện | Kết quả mong đợi |
|---|-----------|----------------|-------------------|
| 2.1 | Chuyển sang English | Click language switcher → English | Tất cả UI labels hiển thị tiếng Anh |
| 2.2 | Chuyển sang Tiếng Việt | Click language switcher → Tiếng Việt | Tất cả UI labels hiển thị tiếng Việt |
| 2.3 | Chuyển sang 日本語 | Click language switcher → 日本語 | Tất cả UI labels hiển thị tiếng Nhật |
| 2.4 | Nhớ ngôn ngữ | Chọn VI → refresh trang | Vẫn giữ tiếng Việt |
| 2.5 | AI content theo locale (EN) | Chọn EN → xem candidate detail → AI Insight / G-level reason | Hiển thị tiếng Anh |
| 2.6 | AI content theo locale (VI) | Chọn VI → xem candidate detail → AI Insight / G-level reason | Hiển thị tiếng Việt |
| 2.7 | AI content locale JA | Chọn JA → xem candidate detail → AI Insight / G-level reason | Hiển thị tiếng Anh (fallback) |
| 2.8 | Category title 3 ngôn ngữ | Chọn từng ngôn ngữ → xem phần G-level badge | EN: "Application Engineer" / VI: "Nhân viên phát triển phần mềm" / JA: "アプリケーションエンジニア" |
| 2.9 | G-criteria description | Chọn EN/VI → xem "Level Standard" box | Hiển thị mô tả cấp độ đúng ngôn ngữ |

---

## 3. Dashboard

| # | Test Case | Bước thực hiện | Kết quả mong đợi |
|---|-----------|----------------|-------------------|
| 3.1 | Hiển thị tổng quan | Mở Dashboard | Thấy: Total CVs, Gold Candidates, Active Jobs, Avg Score |
| 3.2 | Hiring Funnel | Xem phần Hiring Funnel | Hiển thị biểu đồ phễu theo ngôn ngữ |
| 3.3 | Today's tasks | Xem panel action items | Hiển thị danh sách tasks cần xử lý |
| 3.4 | Recent candidates | Xem danh sách recent | Hiện danh sách ứng viên mới |

---

## 4. CV Upload

| # | Test Case | Bước thực hiện | Kết quả mong đợi |
|---|-----------|----------------|-------------------|
| 4.1 | Upload 1 file PDF | Drag/drop hoặc chọn 1 file PDF | Hiện progress → xử lý thành công |
| 4.2 | Upload nhiều file (batch) | Chọn 3-5 file PDF | Hiện batch progress: "AI is analyzing CV..." / steps (Read file, AI Analysis, G-level) |
| 4.3 | Progress text đa ngôn ngữ | Upload file khi locale=VI | Steps hiển thị: "Đọc file", "Phân tích AI", "Đánh giá G-level" |
| 4.4 | File không hỗ trợ | Upload file .txt hoặc .png | Hiện thông báo skip |
| 4.5 | CV trùng lặp | Upload cùng file đã có | Hiện duplicate warning + actions (Update/Skip/Create new) |
| 4.6 | CV blacklisted | Upload CV của người đã blacklist | Hiện cảnh báo "Candidate is blacklisted" |
| 4.7 | Upload widget | Trong khi processing, chuyển sang page khác | Widget ở góc phải hiện progress |
| 4.8 | Batch done notification | Chờ batch xong | Widget hiện "Processing done" hoặc "{n} duplicates — click to resolve" |

---

## 5. Candidates (Ứng viên)

| # | Test Case | Bước thực hiện | Kết quả mong đợi |
|---|-----------|----------------|-------------------|
| 5.1 | Danh sách ứng viên | Mở trang Candidates | Hiện danh sách với name, skills, score, G-level badge |
| 5.2 | Tìm kiếm | Nhập tên/skill vào search | Filter kết quả |
| 5.3 | Sort | Click sort by name/score/date | Sắp xếp đúng |
| 5.4 | G-level badge đa ngôn ngữ | Chọn EN/VI/JA → xem badge | Category title hiển thị đúng ngôn ngữ |
| 5.5 | Xem chi tiết | Click vào ứng viên | Mở trang detail đầy đủ |

---

## 6. Candidate Detail (Chi tiết ứng viên)

| # | Test Case | Bước thực hiện | Kết quả mong đợi |
|---|-----------|----------------|-------------------|
| 6.1 | Thông tin cơ bản | Mở candidate detail | Hiện name, email, phone, skills, experience |
| 6.2 | G-Level Assessment | Xem panel "Skill Level Assessment" | Hiện: G badge, progress bar G0-G6, category title, level description |
| 6.3 | AI Reason (EN) | Locale=EN → xem "AI Reason" | Hiện nhận xét bằng tiếng Anh |
| 6.4 | AI Reason (VI) | Locale=VI → xem "AI Reason" | Hiện nhận xét bằng tiếng Việt |
| 6.5 | AI Insight | Xem panel "AI Insight" | Hiện: Strengths, Weaknesses, Recommendation |
| 6.6 | AI Insight đa ngôn ngữ | Chuyển EN↔VI | Strengths/Weaknesses hiển thị đúng ngôn ngữ |
| 6.7 | Experience & Education | Scroll xuống | Hiện danh sách experience (role, company, duration) + education |
| 6.8 | Xem CV gốc | Click "View CV" | Mở/tải file CV gốc |
| 6.9 | Blacklist candidate | Click "Blacklist" → nhập lý do → confirm | Ứng viên bị blacklist, toast thông báo |
| 6.10 | Gỡ blacklist | Vào candidate bị blacklist → Click "Gỡ blacklist" | Confirm dialog → gỡ thành công |
| 6.11 | Navigation prev/next | Click arrow prev/next | Chuyển sang candidate trước/sau |

---

## 7. AI Advanced Analysis

| # | Test Case | Bước thực hiện | Kết quả mong đợi |
|---|-----------|----------------|-------------------|
| 7.1 | CV Authenticity Check | Mở candidate → Click "Check CV" | Hiện kết quả: score, verdict, reasons, red_flags, green_flags |
| 7.2 | Authenticity đa ngôn ngữ | Chuyển EN↔VI | reasons/red_flags/green_flags hiển thị đúng ngôn ngữ |
| 7.3 | Culture Fit Assessment | Click "Assess Culture Fit" | Hiện: retention_risk, career_trajectory, work_style, strengths, risk_factors, recommendation |
| 7.4 | Culture Fit đa ngôn ngữ | Chuyển EN↔VI | strengths/risk_factors/recommendation hiển thị đúng ngôn ngữ |

---

## 8. Jobs (Công việc)

| # | Test Case | Bước thực hiện | Kết quả mong đợi |
|---|-----------|----------------|-------------------|
| 8.1 | Danh sách jobs | Mở trang Jobs | Hiện danh sách jobs với title, skills, deadline |
| 8.2 | Tạo job mới (manual) | Click Create → nhập thông tin → Save | Job được tạo thành công |
| 8.3 | Import JD từ text | Click Import → paste JD text → Import | Parse tự động: title, skills, years, education |
| 8.4 | AI Generate JD | Click Generate → nhập title → Generate | AI tạo description_en + description_vi, skills, salary |
| 8.5 | Xem job detail | Click vào job | Hiện chi tiết + danh sách candidates matched |
| 8.6 | Candidates matched | Xem panel "Suggested/Assigned" | Hiện danh sách ứng viên + match score |
| 8.7 | Assign candidate | Click Assign cho candidate | Candidate chuyển sang "Assigned" + chạy scoring |
| 8.8 | Score detail | Click vào score của candidate đã assign | Hiện breakdown: Skill match, Experience, Education, AI evaluation |
| 8.9 | Score detail đa ngôn ngữ | Chuyển EN↔VI xem score labels | Labels hiển thị đúng: "Kỹ năng phù hợp"/"Skill match", etc. |
| 8.10 | AI Recommend | Click "AI Recommend" | Hiện rankings với action, reason, strengths, concerns |
| 8.11 | AI Recommend đa ngôn ngữ | Chuyển EN↔VI | summary/reason/strengths/concerns hiển thị đúng ngôn ngữ |
| 8.12 | Remove candidate from job | Click "Remove" → confirm | Candidate quay lại suggest list |
| 8.13 | Delete job | Click Delete → confirm | Job bị xóa |

---

## 9. Scoring (Chấm điểm)

| # | Test Case | Bước thực hiện | Kết quả mong đợi |
|---|-----------|----------------|-------------------|
| 9.1 | Auto scoring khi assign | Assign candidate vào job | Score được tính: rule_score (70%) + llm_score (30%) |
| 9.2 | Score classification | Xem classification | ≥80: Gold, ≥50: Silver, <50: Bronze |
| 9.3 | LLM summary đa ngôn ngữ | Xem "AI comment" trong score detail | EN: summary tiếng Anh, VI: summary tiếng Việt |
| 9.4 | Matched/Missing skills | Xem skills panel | Hiện đúng matched (xanh) và missing (đỏ) |

---

## 10. Interviews (Phỏng vấn)

| # | Test Case | Bước thực hiện | Kết quả mong đợi |
|---|-----------|----------------|-------------------|
| 10.1 | Đặt lịch phỏng vấn | Từ Job detail → Click schedule → chọn ngày/giờ/interviewer → Submit | Lịch được tạo thành công |
| 10.2 | Validation ngày quá khứ | Chọn ngày trong quá khứ | Hiện lỗi theo ngôn ngữ |
| 10.3 | Validation end < start | Chọn end time trước start | Hiện lỗi theo ngôn ngữ |
| 10.4 | Gửi email mời | Sau khi tạo lịch → Click "Send email" | Email được gửi cho candidate |
| 10.5 | Danh sách interviews | Mở trang Interviews | Hiện calendar/list view các buổi phỏng vấn |
| 10.6 | Interviewer Dashboard | Login bằng interviewer account → /interviewer | Hiện upcoming interviews, cần feedback |
| 10.7 | Submit feedback | Click Feedback → nhập score + notes → Submit | Feedback được lưu |
| 10.8 | Interviewer conflict | Đặt lịch trùng giờ interviewer | Hiện cảnh báo "conflict" theo ngôn ngữ |

---

## 11. Interview Questions (Câu hỏi phỏng vấn)

| # | Test Case | Bước thực hiện | Kết quả mong đợi |
|---|-----------|----------------|-------------------|
| 11.1 | Question Bank | Từ interviewer dashboard → Click "Questions" | Hiện danh sách câu hỏi theo category |
| 11.2 | Questions đa ngôn ngữ | Locale=VI: câu hỏi tiếng Việt, EN: tiếng Anh | Hiển thị đúng ngôn ngữ |
| 11.3 | View correct answer | Click show answer | Hiện answer + red flags |
| 11.4 | Answer đa ngôn ngữ | Chuyển locale → xem answer | answer_en hoặc answer_vi theo locale |
| 11.5 | Smart Questions (scoring) | Mở Smart Questions panel → đánh giá criteria | Score + G-level assessment |

---

## 12. Outreach (Email ứng viên)

| # | Test Case | Bước thực hiện | Kết quả mong đợi |
|---|-----------|----------------|-------------------|
| 12.1 | AI Generate outreach email | Mở Outreach → chọn candidate → Generate | AI tạo email: greeting, body, highlights, closing |
| 12.2 | Send email | Chỉnh sửa nếu cần → Send | Email được gửi, log được lưu |
| 12.3 | Email templates | Xem/sửa email templates | Template được cập nhật |

---

## 13. Blacklist

| # | Test Case | Bước thực hiện | Kết quả mong đợi |
|---|-----------|----------------|-------------------|
| 13.1 | Xem danh sách blacklist | Mở trang Blacklist hoặc Settings → Blacklist tab | Hiện danh sách candidates bị block |
| 13.2 | Blacklist labels đa ngôn ngữ | Chuyển ngôn ngữ | Headers (Candidate/Reason/Date), buttons hiển thị đúng |
| 13.3 | Unblock candidate | Click "Unblock" → confirm | Candidate được gỡ blacklist |
| 13.4 | Upload CV blacklisted | Upload CV của candidate đã blacklist | Cảnh báo blacklisted |

---

## 14. Settings (Cài đặt)

| # | Test Case | Bước thực hiện | Kết quả mong đợi |
|---|-----------|----------------|-------------------|
| 14.1 | Quản lý users | Xem danh sách users | Hiện users với role (admin/hr/interviewer) |
| 14.2 | Email templates | Xem/sửa email templates | Templates editable |
| 14.3 | AI Usage dashboard | Xem thống kê AI usage | Hiện token count, cost, by feature |
| 14.4 | Blacklist management | Xem tab Blacklist trong Settings | Hiện danh sách + actions đa ngôn ngữ |

---

## 15. Candidate Compare

| # | Test Case | Bước thực hiện | Kết quả mong đợi |
|---|-----------|----------------|-------------------|
| 15.1 | So sánh ứng viên | Chọn 2-3 candidates → Compare | Hiện bảng so sánh side-by-side |
| 15.2 | Compare skills | Xem skills section | Highlight matched/missing cho từng candidate |

---

## 16. Talent Pool (Smart Pool)

| # | Test Case | Bước thực hiện | Kết quả mong đợi |
|---|-----------|----------------|-------------------|
| 16.1 | Xem talent pool | Mở trang Talent Pool | Hiện candidates chưa được assign job |
| 16.2 | Auto-match | Upload CV mới | Candidate tự động match với jobs phù hợp |

---

## 17. Performance & Error Handling

| # | Test Case | Bước thực hiện | Kết quả mong đợi |
|---|-----------|----------------|-------------------|
| 17.1 | Loading states | Mở các page khi data đang load | Hiện skeleton loading |
| 17.2 | Empty states | Mở page không có data | Hiện empty state message đa ngôn ngữ |
| 17.3 | API error | Tắt API → thao tác | Hiện error toast/message phù hợp |
| 17.4 | Auto-refresh | Upload CV → xem candidate detail | Data tự cập nhật khi AI xử lý xong |
| 17.5 | Batch processing lớn | Upload 10+ files cùng lúc | Xử lý tuần tự, progress cập nhật real-time |

---

## 18. Security & Access Control

| # | Test Case | Bước thực hiện | Kết quả mong đợi |
|---|-----------|----------------|-------------------|
| 18.1 | Unauthorized access | Truy cập /candidates mà không login | Redirect về /login |
| 18.2 | Token expired | Chờ token hết hạn → thao tác | Redirect về login |
| 18.3 | PII filtering | Xem candidate data | Không hiện SĐT/email/địa chỉ trực tiếp (masked) |
| 18.4 | Injection guard | Upload CV có injection attempt | Bị filter, không ảnh hưởng hệ thống |

---

## Ghi chú

- **Đa ngôn ngữ AI content**: Khi locale = EN hoặc JA → hiển thị tiếng Anh. Khi locale = VI → hiển thị tiếng Việt.
- **Đa ngôn ngữ UI labels**: Hiển thị đúng 3 ngôn ngữ (EN/VI/JA) theo locale đang chọn.
- **Category titles** (Application Engineer, etc.): Có đủ 3 ngôn ngữ, hiển thị theo locale.
- **G-criteria description**: Chỉ có EN+VI, locale=JA fallback sang EN.
