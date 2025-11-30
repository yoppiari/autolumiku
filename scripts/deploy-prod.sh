#!/bin/bash

# Production Deployment Script
# Usage: ./scripts/deploy-prod.sh

SERVER="root@cf.avolut.com"
CONTAINER="autolumiku-app"

echo "🚀 Starting deployment to $SERVER..."

# Commands to run on the remote server
REMOTE_CMDS="
    # 1. Find directory
    if [ -d /root/autolumiku ]; then
        cd /root/autolumiku
    elif [ -d /var/www/autolumiku ]; then
        cd /var/www/autolumiku
    else
        echo '❌ Project directory not found!'
        exit 1
    fi

    echo '📂 Working directory: \$(pwd)'

    # 2. Check .env file
    if [ ! -f .env ]; then
        echo '⚠️  .env file not found! Creating from .env.example...'
        if [ -f .env.example ]; then
            cp .env.example .env
            echo '✅ Created .env from .env.example'
            # Generate random secrets
            sed -i 's/your-secret-key-change-in-production/'\$(openssl rand -hex 32)'/g' .env
            sed -i 's/your-refresh-secret-change-in-production/'\$(openssl rand -hex 32)'/g' .env
        else
            echo '❌ .env.example not found! Cannot create .env'
        fi
    else
        echo '✅ .env file found'
    fi

    # 3. Pull latest code
    echo '⬇️  Pulling latest changes...'
    git pull

    # 4. Rebuild and restart
    echo '🏗️  Rebuilding and restarting containers...'
    # Force rebuild to ensure code changes are picked up
    docker compose up -d --build --force-recreate

    # 5. Cleanup
    echo '🧹 Cleaning up unused images...'
    docker image prune -f

    # 6. Verify Environment
    echo '🔍 Verifying DATABASE_URL in container...'
    sleep 5
    docker compose exec -T app env | grep DATABASE_URL || echo '❌ DATABASE_URL not found in container!'

    # 7. Check logs
    echo '📋 Checking logs for errors...'
    docker compose logs --tail=20 app
"

# Execute via SSH
ssh -t $SERVER "$REMOTE_CMDS"

echo "✅ Deployment finished!"
