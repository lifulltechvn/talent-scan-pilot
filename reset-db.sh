#!/bin/bash
# Reset DB: drop all tables, re-run migrations, keep users data.
# Usage: ./reset-db.sh

set -e
cd "$(dirname "$0")"

echo "🔄 Backing up users..."
docker compose exec db psql -U talent -d talentscan -c "\COPY users TO '/tmp/users_backup.csv' WITH CSV HEADER"

echo "🗑️  Dropping all tables..."
docker compose exec db psql -U talent -d talentscan -c "
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO talent;
CREATE EXTENSION IF NOT EXISTS vector;
"

echo "📦 Running migrations..."
docker compose exec api alembic upgrade head

echo "👤 Restoring users..."
docker compose exec db psql -U talent -d talentscan -c "\COPY users FROM '/tmp/users_backup.csv' WITH CSV HEADER"

echo "✅ Done! DB reset with users preserved."
