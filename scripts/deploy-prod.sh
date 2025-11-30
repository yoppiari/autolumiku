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

    # 2. Pull latest code
    echo '⬇️  Pulling latest changes...'
    git pull

    # 3. Rebuild and restart
    echo '🏗️  Rebuilding and restarting containers...'
    # Force rebuild to ensure code changes (like bcrypt removal) are picked up
    docker compose up -d --build --force-recreate

    # 4. Cleanup
    echo '🧹 Cleaning up unused images...'
    docker image prune -f

    # 5. Check logs
    echo '📋 Checking logs for errors...'
    sleep 5
    docker compose logs --tail=20 app
"

# Execute via SSH
ssh -t $SERVER "$REMOTE_CMDS"

echo "✅ Deployment finished!"
