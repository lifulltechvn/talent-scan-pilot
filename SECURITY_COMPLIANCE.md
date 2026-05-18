# Security & Compliance Notes — AI CV Screening

Tài liệu ghi nhận yêu cầu bảo mật từ 機密情報管理委員会 và gap analysis với hiện trạng project.

**Nguồn:** [Confluence - 機密情報管理委員会への相談](https://jira.next-group.jp/wiki/pages/viewpage.action?pageId=508807515)

---

## 1. Phân loại thông tin

- Project thuộc **No.8 採用候補者の個人情報** (Thông tin cá nhân ứng viên tuyển dụng)
- Mức độ mật: **社外秘〜機密**
- Dữ liệu CV chứa: họ tên, địa chỉ, SĐT, email, kinh nghiệm, bằng cấp, mức lương mong muốn
- Có thể chứa 要配慮個人情報 (thông tin nhạy cảm: bệnh sử, tôn giáo...)

---

## 2. Yêu cầu bắt buộc (必須管理策)

| # | Yêu cầu | Hiện trạng | Status |
|---|---------|-----------|--------|
| 1 | Chống truy cập trái phép (2FA, IP auth) | Chỉ có JWT + bcrypt | ❌ TODO |
| 2 | Mã hóa lưu trữ (AES 128bit+) | PostgreSQL plaintext, JSONB không encrypt | ❌ TODO |
| 3 | Audit log (ai, khi nào, làm gì) | Model AuditLog có, chưa ghi đầy đủ | ⚠️ PARTIAL |
| 4 | Backup | Docker volume, không có backup strategy | ❌ TODO |

---

## 3. Yêu cầu chung (全テーマ共通)

| # | Yêu cầu | Hiện trạng | Status |
|---|---------|-----------|--------|
| 5 | 機密情報管理委員会 approval | Đang chờ | ⏳ PENDING |
| 6 | Access control (phân quyền tối thiểu) | Không có RBAC | ❌ TODO |
| 7 | SSL/TLS encryption | Nginx HTTP only (port 80) | ❌ TODO |
| 8 | Data retention policy | Chưa định nghĩa | ❌ TODO |
| 9 | Xóa dữ liệu không phục hồi được | Chưa có mechanism | ❌ TODO |

---

## 4. Yêu cầu AI Service (3-5. AI機能組み込み)

| # | Yêu cầu | Hiện trạng | Status |
|---|---------|-----------|--------|
| 10 | Input không bị dùng để train AI | Chưa tích hợp AI | ⚠️ Cần chọn đúng plan |
| 11 | Prompt injection protection | Chưa có | ❌ TODO |
| 12 | Rate limiting (EDoS) | Chưa có | ❌ TODO |
| 13 | Fallback khi AI service down | Chưa có | ❌ TODO |
| 14 | PII anonymization trước khi gửi AI | README đề cập, chưa implement | ❌ TODO |

---

## 5. AI Service — Lựa chọn & Approval

| Service | Status | Ghi chú |
|---------|--------|---------|
| AWS Bedrock (Claude + Titan Embedding) | ❌ Chưa có trong danh sách cho phép | Cần xin approval |
| OpenAI API (GPT-4o) | ✅ Đã được phê duyệt | OK dùng |
| Google AI Studio (Gemini) | ⚠️ Chỉ cho phép thông tin công khai | KHÔNG dùng cho CV data |
| Vertex AI (Google Cloud) | ❓ Chưa rõ | Cần hỏi nếu muốn dùng Gemini |

**Quyết định:** Chờ approval từ 機密情報管理委員会. Trong lúc chờ → dùng dummy data.

---

## 6. Chiến lược phát triển

### Phase 1: Dev với dummy data (NGAY)
- [ ] Tạo bộ dummy CV (PDF/DOCX giả, không chứa PII thật)
- [ ] Implement core features: parse CV, matching, scoring
- [ ] Dùng dummy data = "公開情報" → có thể dùng mọi AI service

### Phase 2: Bổ sung bảo mật (trước khi dùng data thật)
- [ ] RBAC (admin / hr_manager / hr_viewer)
- [ ] Encrypt structured_data (application-level encryption)
- [ ] 2FA hoặc IP whitelist
- [ ] Audit log middleware (ghi mọi thao tác)
- [ ] Rate limiting
- [ ] HTTPS (SSL cert cho Nginx)
- [ ] PII masking trước khi gửi AI

### Phase 3: Production readiness
- [ ] Automated backup (pg_dump cron)
- [ ] Data retention policy + auto-delete
- [ ] Prompt injection validation
- [ ] AI fallback design
- [ ] Design Review document cho 機密情報管理委員会

---

## 7. Câu hỏi chờ trả lời từ 委員会

1. AWS Bedrock có cần xin phép riêng không?
2. Dùng Vertex AI thay Google AI Studio cho thông tin mật được không?
3. Account LFTV dùng được hay phải qua account LIFULL?
4. Design review: từng team hay chung 1 lần?
5. Dùng dummy data để dev trước có OK không?
6. Nên dùng account LIFULL (案A) hay LFTV + biện pháp bổ sung (案B)?

---

## 8. Tham khảo

- [AIサービスの利用ガイドライン](https://jira.next-group.jp/wiki/pages/viewpage.action?pageId=353662683)
- [AIサービス利用可否一覧](https://docs.google.com/spreadsheets/d/1S8Vihnd9AQdA0anDi91mXNOineEWRBJoX-SJy14PyoA/edit?gid=0#gid=0)
- [個人情報の分類と管理策](https://jira.next-group.jp/wiki/pages/viewpage.action?pageId=240383130)
- [セキュリティ開発要件定義ガイドライン](https://jira.next-group.jp/wiki/pages/viewpage.action?pageId=54861932)
- [AI Contest概要](https://jira.next-group.jp/wiki/display/LFTV/AI+Contest)
- [AI Service Summary](https://jira.next-group.jp/wiki/pages/viewpage.action?pageId=508805617)
