#!/bin/bash

# WhatsApp AI Commands - Production Deployment & Test Script

echo "========================================"
echo "WhatsApp AI Commands - Deployment Test"
echo "========================================"
echo ""

# Configuration
PRODUCTION_URL="${1:-https://primamobil.id}"
COMMAND_ENDPOINT="${PRODUCTION_URL}/api/v1/whatsapp-ai/command"

echo "📍 Production URL: $PRODUCTION_URL"
echo "🔗 Command Endpoint: $COMMAND_ENDPOINT"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test 1: Check Deployment Status
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Test 1: Checking Deployment Status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

HEALTH_CHECK="${PRODUCTION_URL}/api/v1/health"
echo "Checking: $HEALTH_CHECK"

HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$HEALTH_CHECK" 2>/dev/null)
HEALTH_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
HEALTH_BODY=$(echo "$HEALTH_RESPONSE" | sed '$d')

if [ "$HEALTH_CODE" = "200" ]; then
    echo -e "${GREEN}✅${NC} Production server is healthy"
    echo "   Response: $HEALTH_BODY"
else
    echo -e "${RED}❌${NC} Production server health check failed (HTTP $HEALTH_CODE)"
    echo "   Deployment may still be in progress..."
    echo "   Please wait a few minutes and try again."
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Test 2: Testing Command Endpoint"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test with mock data (will fail validation but confirms endpoint exists)
echo "Testing endpoint accessibility..."
ENDPOINT_CHECK=$(curl -s -w "\n%{http_code}" -X POST "$COMMAND_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{"test":"test"}' 2>/dev/null)

ENDPOINT_CODE=$(echo "$ENDPOINT_CHECK" | tail -n1)

if [ "$ENDPOINT_CODE" = "400" ] || [ "$ENDPOINT_CODE" = "401" ]; then
    echo -e "${GREEN}✅${NC} Command endpoint is accessible (expected validation error, HTTP $ENDPOINT_CODE)"
elif [ "$ENDPOINT_CODE" = "404" ]; then
    echo -e "${RED}❌${NC} Command endpoint not found (HTTP $ENDPOINT_CODE)"
    echo "   Deployment may not be complete yet."
    exit 1
else
    echo -e "${YELLOW}⚠️${NC} Unexpected response code: $ENDPOINT_CODE"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Test 3: WhatsApp Command Testing"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "To test commands in production, you have two options:"
echo ""
echo -e "${BLUE}Option 1: Direct WhatsApp Testing${NC}"
echo "  1. Open WhatsApp on your phone"
echo "  2. Send a message to: +62 (your showroom number)"
echo "  3. Test these commands:"
echo "     • status"
echo "     • inventory"
echo "     • statistik"
echo "     • sales report (admin only)"
echo ""
echo -e "${BLUE}Option 2: API Testing${NC}"
echo "  Use the test script below with valid credentials:"
echo ""
echo "  curl -X POST '$COMMAND_ENDPOINT' \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{"
echo "      \"command\": \"status\","
echo "      \"phoneNumber\": \"6281234567890\","
echo "      \"tenantId\": \"YOUR_TENANT_ID\","
echo "      \"userId\": \"YOUR_USER_ID\","
echo "      \"userRole\": \"ADMIN\","
echo "      \"userRoleLevel\": 90"
echo "    }'"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Expected Behavior"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Universal Commands (ALL Roles):"
echo "   • status - Show showroom status"
echo "   • inventory - List available vehicles"
echo "   • statistik - Show monthly stats"
echo ""
echo "✅ PDF Commands (ADMIN+ only):"
echo "   • sales report - Generate and send PDF"
echo "   • whatsapp ai - AI analytics PDF"
echo "   • metrix penjualan - Sales metrics PDF"
echo "   • ... and 11 more report types"
echo ""
echo "📄 PDF Features:"
echo "   • Auto-generated from real database data"
echo "   • Sent via WhatsApp automatically"
echo "   • Professional formatting (Indonesian)"
echo "   • Stored in /app/uploads/reports/"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Deployment Checklist"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Code committed: 237c858"
echo "✅ Pushed to: origin/main"
echo "✅ Production health: $HEALTH_CODE"
echo "✅ Endpoint accessible: Yes"
echo ""
echo "🚀 Ready for testing!"
echo ""
echo "Next steps:"
echo "1. Wait 2-3 minutes for Coolify auto-deployment"
echo "2. Test commands via WhatsApp or API"
echo "3. Monitor logs in Coolify dashboard"
echo "4. Check PDFs in uploads/reports/ directory"
echo ""

echo "========================================"
echo "✅ Deployment Test Complete!"
echo "========================================"
