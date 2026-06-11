# TalentScan — EC2 Deployment Guide

## Prerequisites

- AWS Account với EC2 access
- Domain (optional, cho HTTPS)
- AWS Bedrock access (Claude + Titan models enabled ở us-east-1)

---

## Step 1: Launch EC2 Instance

### 1.1 Chọn Instance
- **AMI**: Amazon Linux 2023
- **Type**: t3.medium (2 vCPU, 4GB RAM) — minimum cho chạy Docker
- **Storage**: 30GB gp3
- **Region**: ap-southeast-1 (Singapore) hoặc gần nhất

### 1.2 Security Group
Tạo Security Group với rules:

| Type | Port | Source | Mô tả |
|------|------|--------|--------|
| SSH | 22 | Your IP only | SSH access |
| HTTP | 80 | 0.0.0.0/0 | Web Dashboard |
| HTTPS | 443 | 0.0.0.0/0 | (Optional) SSL |
| Custom TCP | 8000 | Your IP only | Swagger API (dev only) |

> ⚠️ KHÔNG mở port 5432 (PostgreSQL) ra public

### 1.3 Key Pair
- Tạo hoặc chọn key pair (.pem)
- Download và chmod:
```bash
chmod 400 your-key.pem
```

### 1.4 Elastic IP (Recommended)
- Allocate Elastic IP → Associate với instance
- Tránh IP thay đổi khi stop/start

---

## Step 2: Connect & Install Dependencies

```bash
ssh -i your-key.pem ec2-user@<EC2_PUBLIC_IP>
```

### 2.1 Update system
```bash
sudo dnf update -y
```

### 2.2 Install Docker
```bash
sudo dnf install docker -y
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user
```

### 2.3 Install Docker Compose
```bash
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
docker-compose --version
```

### 2.4 Install Git
```bash
sudo dnf install git -y
```

### 2.5 Re-login (để docker group có hiệu lực)
```bash
exit
ssh -i your-key.pem ec2-user@<EC2_PUBLIC_IP>
```

---

## Step 3: Clone & Configure

### 3.1 Clone repository
```bash
git clone <REPO_URL> talent-scan-pilot
cd talent-scan-pilot
```

### 3.2 Create .env file
```bash
cp .env.example .env
nano .env
```

Cập nhật các giá trị:
```env
# Database (giữ nguyên — Docker internal)
DATABASE_URL=postgresql+asyncpg://talent:talent123@db:5432/talentscan

# Security — THAY ĐỔI!
SECRET_KEY=<random-string-32-chars>

# AWS Bedrock
AWS_ACCESS_KEY_ID=<your-aws-access-key>
AWS_SECRET_ACCESS_KEY=<your-aws-secret-key>
AWS_REGION=us-east-1

# Bedrock Models
BEDROCK_MODEL_SONNET=us.anthropic.claude-sonnet-4-5-20250929-v1:0
BEDROCK_MODEL_HAIKU=us.anthropic.claude-haiku-4-5-20251001-v1:0
BEDROCK_MODEL_EMBEDDING=amazon.titan-embed-text-v2:0

# App
APP_VERSION=1.0.0
```

> 💡 Generate SECRET_KEY: `openssl rand -hex 32`

---

## Step 4: Start Services

```bash
docker-compose up -d
```

Đợi build xong (~3-5 phút lần đầu). Kiểm tra:
```bash
docker-compose ps
```

Tất cả 4 services phải `Up`:
- `db` (Healthy)
- `api` (Started)
- `frontend` (Started)
- `nginx` (Started)

---

## Step 5: Initialize Database

```bash
docker-compose exec api alembic upgrade head
docker-compose exec api python seed.py
```

Expected output:
```
✅ User: hr@test.com / test1234
   Dashboard: http://localhost
   Swagger:   http://localhost:8000/docs
```

---

## Step 6: Verify

### 6.1 Test API
```bash
curl http://localhost:8000/api/v1/health
# {"status": "ok"}
```

### 6.2 Test Login
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -d "username=hr@test.com&password=test1234"
# Returns access_token
```

### 6.3 Access Web
- Dashboard: `http://<EC2_PUBLIC_IP>`
- Swagger: `http://<EC2_PUBLIC_IP>:8000/docs`
- Login: `hr@test.com` / `test1234`

---

## Step 7: Security Hardening

### 7.1 Firewall (đã config ở Security Group)
Verify:
- Port 22: chỉ IP bạn
- Port 80: public (web)
- Port 5432: KHÔNG mở
- Port 8000: chỉ IP bạn (hoặc đóng sau khi test xong)

### 7.2 Đổi password mặc định
Login vào web → Settings → đổi password. Hoặc:
```bash
docker-compose exec api python -c "
from app.auth import hash_password
from app.database import async_session
from app.models import User
from sqlalchemy import select
import asyncio

async def change():
    async with async_session() as db:
        user = (await db.execute(select(User).where(User.email == 'hr@test.com'))).scalar_one()
        user.hashed_password = hash_password('YOUR_NEW_PASSWORD')
        await db.commit()
        print('Password changed!')

asyncio.run(change())
"
```

### 7.3 Disable Swagger in production (optional)
Trong `server/app/main.py`, thêm:
```python
app = FastAPI(..., docs_url=None, redoc_url=None)  # Disable docs
```

### 7.4 Auto-update system packages
```bash
sudo dnf install dnf-automatic -y
sudo systemctl enable dnf-automatic-install.timer
```

---

## Step 8: HTTPS Setup (Optional — Recommended)

### 8.1 Với domain
```bash
sudo dnf install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com
```

### 8.2 Không có domain — Self-signed (dev only)
```bash
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/nginx.key \
  -out /etc/ssl/certs/nginx.crt
```

---

## Step 9: Monitoring & Maintenance

### 9.1 Xem logs
```bash
docker-compose logs api -f          # API logs
docker-compose logs api --tail=50   # Last 50 lines
docker-compose logs frontend -f     # Frontend logs
```

### 9.2 Restart services
```bash
docker-compose restart api          # Restart API only
docker-compose up -d --build        # Rebuild & restart all
```

### 9.3 Database backup
```bash
# Backup
docker-compose exec db pg_dump -U talent talentscan > backup_$(date +%Y%m%d).sql

# Restore
docker-compose exec -T db psql -U talent talentscan < backup_20260611.sql
```

### 9.4 Disk space check
```bash
df -h
docker system prune -f  # Clean unused Docker data
```

### 9.5 Update code
```bash
cd talent-scan-pilot
git pull
docker-compose up -d --build
docker-compose exec api alembic upgrade head  # If migration changed
```

---

## Step 10: Performance Benchmark

```bash
docker-compose exec api python benchmark.py
docker-compose exec api python evaluation.py
```

Expected:
- 50 CVs < 3 min ✅
- Accuracy ≥ 80% ✅

---

## Troubleshooting

| Vấn đề | Giải pháp |
|---------|-----------|
| Container không start | `docker-compose logs <service>` xem lỗi |
| DB connection refused | Đợi db Healthy: `docker-compose ps` |
| AI không hoạt động | Check AWS credentials: `docker-compose exec api env \| grep AWS` |
| Port 80 không access | Check Security Group có mở HTTP |
| Disk full | `docker system prune -f` + xoá old backups |
| Slow response | Check `docker stats` — nếu CPU/RAM > 80%, upgrade instance |

---

## Cost Estimate (Monthly)

| Resource | Cost |
|----------|------|
| EC2 t3.medium (on-demand) | ~$30/month |
| EBS 30GB gp3 | ~$2.5/month |
| Elastic IP | Free (if associated) |
| Data transfer (100GB) | ~$9/month |
| AWS Bedrock AI | ~$1-5/month (depends on usage) |
| **Total** | **~$45-50/month** |

> 💡 Tiết kiệm: Dùng Reserved Instance (-40%) hoặc stop instance ngoài giờ làm việc.

---

## Architecture

```
Internet → EC2 (Elastic IP)
              → Nginx (:80)
                  → Frontend (:5173) — React SPA
                  → API (:8000) — FastAPI
                      → PostgreSQL (:5432) — pgvector
                      → AWS Bedrock — AI (Claude + Titan)
```

## Security Features Active

- ✅ Rate limiting (5 req/min on login)
- ✅ PII filter (regex — email, phone, DOB, CCCD)
- ✅ Prompt injection guard (pattern detection + XML wrapping)
- ✅ GDPR erasure endpoint
- ✅ JWT auth (30min access + 7d refresh)
- ✅ bcrypt password hashing
- ✅ AI retry with exponential backoff
- ✅ Task recovery on restart
- ✅ Request timing logging
