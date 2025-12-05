#!/bin/bash

# Script to fix Z.AI configuration in .env file

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Fixing Z.AI Configuration in .env"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    exit 1
fi

# Backup original .env
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
echo "✅ Created backup: .env.backup.$(date +%Y%m%d_%H%M%S)"

# Fix ZAI_BASE_URL
echo ""
echo "Fixing ZAI_BASE_URL..."
if grep -q "ZAI_BASE_URL.*coding" .env; then
    sed -i 's|ZAI_BASE_URL="https://api.z.ai/api/coding/paas/v4/"|ZAI_BASE_URL="https://api.z.ai/api/paas/v4/"|g' .env
    echo "✅ Updated ZAI_BASE_URL to use regular endpoint"
else
    echo "ℹ️  ZAI_BASE_URL already correct or not found"
fi

# Fix ZAI_TEXT_MODEL
echo ""
echo "Fixing ZAI_TEXT_MODEL..."
if grep -q 'ZAI_TEXT_MODEL="glm-4.6"' .env; then
    sed -i 's/ZAI_TEXT_MODEL="glm-4.6"/ZAI_TEXT_MODEL="glm-4-plus"/g' .env
    echo "✅ Updated ZAI_TEXT_MODEL from glm-4.6 to glm-4-plus"
elif grep -q 'ZAI_TEXT_MODEL="glm-4-plus"' .env; then
    echo "ℹ️  ZAI_TEXT_MODEL already correct"
else
    echo "⚠️  ZAI_TEXT_MODEL not found or has different value"
fi

# Fix ZAI_VISION_MODEL
echo ""
echo "Fixing ZAI_VISION_MODEL..."
if grep -q 'ZAI_VISION_MODEL="glm-4.5v"' .env; then
    sed -i 's/ZAI_VISION_MODEL="glm-4.5v"/ZAI_VISION_MODEL="glm-4v"/g' .env
    echo "✅ Updated ZAI_VISION_MODEL from glm-4.5v to glm-4v"
elif grep -q 'ZAI_VISION_MODEL="glm-4v"' .env; then
    echo "ℹ️  ZAI_VISION_MODEL already correct"
else
    echo "⚠️  ZAI_VISION_MODEL not found or has different value"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Current Z.AI Configuration:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
grep "ZAI_BASE_URL\|ZAI_TEXT_MODEL\|ZAI_VISION_MODEL" .env | grep -v "^#"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Configuration fixed!"
echo ""
echo "Next steps:"
echo "1. Restart your application: npm run dev"
echo "2. Test blog generation again"
echo ""
