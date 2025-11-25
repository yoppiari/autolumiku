#!/bin/bash

# Script to start Docker daemon
# Run with: sudo ./start-docker.sh

echo "🐳 Starting Docker daemon..."

# Start Docker service
systemctl start docker

# Check if started successfully
if systemctl is-active --quiet docker; then
    echo "✅ Docker daemon started successfully"
    echo ""
    echo "Docker status:"
    systemctl status docker --no-pager | head -5
    echo ""
    echo "Now you can run: ./dev.sh"
else
    echo "❌ Failed to start Docker daemon"
    echo "Please check: journalctl -u docker.service -n 50"
    exit 1
fi
