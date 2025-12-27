#!/bin/sh
set -e

echo "=== AutoLumiku Startup ==="
echo "Running database migrations..."

# Run Prisma migrations
if npx prisma migrate deploy; then
  echo "Migrations applied successfully"
else
  echo "Migration warning - checking if database is usable..."
fi

# Ensure critical columns exist (fallback for migration issues)
echo "Verifying database schema..."
npx prisma db execute --stdin <<EOF || true
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "roleLevel" INTEGER NOT NULL DEFAULT 30;
UPDATE "users" SET "roleLevel" = 30 WHERE "roleLevel" IS NULL;
EOF

echo "Starting application..."

# Start the application
exec node server.js
