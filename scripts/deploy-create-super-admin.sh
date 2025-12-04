#!/bin/bash

# ============================================================================
# Deploy and Create Super Admin in Production Docker Container
# ============================================================================

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Creating Super Admin in Production"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Configuration
SERVER_HOST="auto.lumiku.com"
SERVER_USER="root"
PROJECT_DIR="/root/autolumiku"
CONTAINER_NAME="autolumiku-app"  # Adjust if different

echo "📡 Connecting to server: $SERVER_USER@$SERVER_HOST"
echo ""

# SSH and execute commands
ssh $SERVER_USER@$SERVER_HOST << 'ENDSSH'
set -e

echo "📂 Navigating to project directory..."
cd /root/autolumiku

echo "📥 Pulling latest code..."
git pull origin main

echo "🐳 Finding Docker container..."
CONTAINER_ID=$(docker ps --filter "name=autolumiku" --format "{{.ID}}" | head -1)

if [ -z "$CONTAINER_ID" ]; then
    echo "❌ Error: No running Docker container found with 'autolumiku' in name"
    echo ""
    echo "Available containers:"
    docker ps --format "table {{.ID}}\t{{.Names}}\t{{.Status}}"
    exit 1
fi

CONTAINER_NAME=$(docker ps --filter "id=$CONTAINER_ID" --format "{{.Names}}")
echo "✅ Found container: $CONTAINER_NAME ($CONTAINER_ID)"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔐 Creating Super Admin User..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Execute script inside Docker container
docker exec $CONTAINER_ID npx tsx scripts/create-super-admin.ts

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Super Admin Creation Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Login Credentials:"
echo "   URL:      https://auto.lumiku.com/admin/login"
echo "   Email:    admin@autolumiku.com"
echo "   Password: admin123"
echo ""
echo "⚠️  IMPORTANT: Change the default password after first login!"
echo ""

ENDSSH

echo ""
echo "✅ Done!"
