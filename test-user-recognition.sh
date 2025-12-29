#!/bin/bash

echo "========================================="
echo "🧪 User Recognition - Production Test"
echo "========================================="
echo ""

PRODUCTION_URL="https://primamobil.id"

echo "1️⃣  Testing Health Check"
HEALTH=$(curl -s "$PRODUCTION_URL/api/v1/health")
echo "Status: $(echo $HEALTH | grep -o '"status":"[^"]*"' | cut -d'"' -f4)"
echo ""

echo "2️⃣  Testing Command with User Phone"
RESPONSE=$(curl -s -X POST "$PRODUCTION_URL/api/v1/whatsapp-ai/command" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "status",
    "phoneNumber": "6285385419766",
    "tenantId": "cm0w756ys0001vvs6c5jy8y4s",
    "userId": "cm0x0i2s000006t5c4s1vxyhn",
    "userRole": "OWNER",
    "userRoleLevel": 95
  }')

echo "Command Response:"
echo "$RESPONSE" | head -10
echo ""

echo "3️⃣  Expected Behavior"
echo "✅ User: Yudho D.L (Owner)"
echo "📱 Phone: +62 853-8541-9766"
echo "🔑 Role: OWNER (Level: 95)"
echo ""
echo "4️⃣  WhatsApp Test Instructions"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Via WhatsApp:"
echo "1. Open WhatsApp"
echo "2. Send to: +62 853-8541-9766"
echo "3. Message: 'Hi' or 'Halo'"
echo ""
echo "Expected Response (NEW):"
echo "   'Selamat siang, Yudho! 👋'"
echo "   'Selamat datang kembali di Prima Mobil!'"
echo "   'Saya mengenali Anda sebagai Owner Prima Mobil.'"
echo ""
echo "5️⃣  Log Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Check logs in Coolify:"
echo "https://cf.avolut.com"
echo ""
echo "Look for:"
echo "  👤 User identified: Yudho D.L (OWNER, Level: 95)"
echo "  📤 Passing user info to AI: Yudho D.L (OWNER)"
echo ""
echo "========================================="
echo "✅ Test Complete!"
echo "========================================="
