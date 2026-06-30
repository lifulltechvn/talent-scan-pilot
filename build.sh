#!/bin/bash
# ===== TalentScan - Full Build Script =====
# Chạy: chmod +x build.sh && ./build.sh

set -e

echo "🗑️  Xóa tất cả containers, volumes, images..."
docker-compose down -v --rmi all 2>/dev/null || true
docker builder prune -f

echo "🔨 Build & start services..."
docker-compose up -d --build

echo "⏳ Đợi DB healthy..."
sleep 10

echo "📦 Chạy migration..."
docker-compose run --rm api alembic upgrade head

echo "🔄 Restart API..."
docker-compose restart api
sleep 3

echo "🌱 Seed test data..."
docker-compose exec api python seed.py

echo ""
echo "✅ Build hoàn tất!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 Web:      http://localhost"
echo "📚 API docs: http://localhost:8000/docs"
echo "👤 Login:    hr@test.com / test1234"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

docker-compose down -v --rmi all 2>/dev/null || true
docker builder prune -f
docker-compose up -d --build
sleep 10
docker-compose run --rm api alembic upgrade head
docker-compose restart api
sleep 3
docker-compose exec api python seed.py