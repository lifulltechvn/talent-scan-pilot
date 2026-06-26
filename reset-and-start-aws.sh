#!/bin/bash
# Reset toàn bộ DB + uploads + rebuild frontend + restart services
set -e

echo "=== Stopping backend..."
sudo systemctl stop talentscan-api

echo "=== Resetting database..."
sudo -u postgres psql <<EOF
DROP DATABASE IF EXISTS talentscan;
CREATE DATABASE talentscan OWNER talent;
\c talentscan
CREATE EXTENSION IF NOT EXISTS vector;
EOF

echo "=== Cleaning uploads..."
rm -rf /app/uploads/*
mkdir -p /app/uploads/cv /app/uploads/avatars

echo "=== Backend: install deps + migrate + seed..."
cd /opt/talentscan/server
source venv/bin/activate
pip install -r requirements.txt -q
PYTHONPATH=/opt/talentscan/server alembic upgrade head
PYTHONPATH=/opt/talentscan/server python seed.py

echo "=== Frontend: install + build..."
cd /opt/talentscan/frontend
npm ci --silent
npm run build

echo "=== Restarting services..."
sudo systemctl restart postgresql
sudo systemctl start talentscan-api
sudo systemctl restart nginx

echo "=== Done! Checking health..."
sleep 2
curl -s http://127.0.0.1:8000/api/v1/health
echo ""
echo "✅ All services running. Access: http://<EC2_PUBLIC_IP>"
