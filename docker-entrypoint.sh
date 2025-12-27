#!/bin/sh
set -e

echo "=== AutoLumiku Startup ==="
echo "Running database migrations..."

# Run Prisma migrations
if npx prisma migrate deploy; then
  echo "Migrations applied successfully"
else
  echo "Migration warning - will attempt schema fixes..."
fi

# Ensure critical schema elements exist (fallback for migration issues)
echo "Verifying database schema..."
if [ -f ./prisma/ensure-schema.sql ]; then
  npx prisma db execute --file ./prisma/ensure-schema.sql || echo "Schema verification completed with warnings"
fi

echo "Starting application..."

# Start the application
exec node server.js
