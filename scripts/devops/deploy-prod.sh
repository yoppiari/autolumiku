#!/bin/bash

# Production Deployment Script
# Usage: ./scripts/deploy-prod.sh

SERVER="root@cf.avolut.com"
DEPLOY_DIR="/root/autolumiku-manual"
REPO_URL="https://github.com/yoppiari/autolumiku.git"

echo "🚀 Starting deployment to $SERVER..."

# Commands to run on the remote server
REMOTE_CMDS="
    # 1. Setup Directory
    if [ ! -d $DEPLOY_DIR ]; then
        echo '📂 Creating deployment directory...'
        git clone $REPO_URL $DEPLOY_DIR
    fi
    
    cd $DEPLOY_DIR
    echo '📂 Working directory: \$(pwd)'

    # 2. Pull latest code
    echo '⬇️  Pulling latest changes...'
    git fetch origin
    git reset --hard origin/main

    # 3. Setup Environment
    if [ ! -f .env ]; then
        echo '⚠️  .env file not found! Creating from .env.example...'
        cp .env.example .env
        # Generate random secrets
        sed -i 's/your-secret-key-change-in-production/'\$(openssl rand -hex 32)'/g' .env
        sed -i 's/your-refresh-secret-change-in-production/'\$(openssl rand -hex 32)'/g' .env
    fi

    # 4. Rebuild and restart
    echo '🏗️  Rebuilding and restarting containers...'
    # Stop existing containers if any (to avoid port conflicts if running elsewhere)
    # docker stop autolumiku-app autolumiku-postgres autolumiku-redis || true
    
    # Force rebuild
    docker compose up -d --build --force-recreate

    # 5. Cleanup
    echo '🧹 Cleaning up unused images...'
    docker image prune -f

    # 6. Verify Environment
    echo '🔍 Verifying DATABASE_URL in container...'
    sleep 5
    docker compose exec -T app env | grep DATABASE_URL || echo '❌ DATABASE_URL not found in container!'

    # 7. Run Migrations & Seed
    echo '🌱 Running migrations and seeding...'
    docker compose exec -T app npx prisma migrate deploy
    docker compose exec -T app npm run db:seed || echo '⚠️ Seeding failed (might be already seeded)'

    # 8. Check logs
    echo '📋 Checking logs for errors...'
    docker compose logs --tail=50 app
"

# Execute via SSH
ssh -t $SERVER "$REMOTE_CMDS"

echo "✅ Deployment finished!"
