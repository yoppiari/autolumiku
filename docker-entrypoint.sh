#!/bin/sh
set -e

echo "=== AutoLumiku Startup ==="
echo "Running database migrations..."

# Run Prisma migrations
npx prisma migrate deploy || echo "Migration failed or no pending migrations"

echo "Starting application..."

# Start the application
exec node server.js
