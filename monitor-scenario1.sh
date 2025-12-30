#!/bin/bash
# Monitor Scenario 1 Test - Upload + Sales Report
# Usage: ./monitor-scenario1.sh

echo "════════════════════════════════════════════════════════════════"
echo "  Scenario 1 Test Monitor: Upload + Sales Report (Parallel)"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "📱 Test Phone: 6281310703754 (Yudho D. L - OWNER)"
echo "🎯 Test Command: sales report"
echo "📊 Expected: PDF sent + upload flow preserved"
echo ""
echo "────────────────────────────────────────────────────────────────"
echo "  Watching for key log patterns..."
echo "────────────────────────────────────────────────────────────────"
echo ""

# If production, SSH first
if [ "$1" == "prod" ]; then
  echo "🔌 Connecting to production server..."
  ssh root@cf.avolut.com "journalctl -u nextjs -f | grep -E --color=always 'Orchestrator.*(🤖|📊|💾)|CommandHandler|PDF.*(Generating|generated|size)|WhatsApp.*sending|PARALLEL|upload_vehicle'"
else
  echo "🔍 Monitoring local logs..."
  echo "   (Use './monitor-scenario1.sh prod' for production)"
  echo ""

  # Try common log locations
  if [ -f "logs/combined.log" ]; then
    tail -f logs/combined.log | grep -E --color=always 'Orchestrator.*(🤖|📊|💾)|CommandHandler|PDF.*(Generating|generated|size)|WhatsApp.*sending|PARALLEL|upload_vehicle'
  elif [ -f ".next/trace" ]; then
    tail -f .next/trace | grep -E --color=always 'Orchestrator.*(🤖|📊|💾)|CommandHandler|PDF.*(Generating|generated|size)|WhatsApp.*sending|PARALLEL|upload_vehicle'
  else
    echo "⚠️  No log file found. Using Docker logs..."
    docker logs -f autolumiku-nextjs 2>&1 | grep -E --color=always 'Orchestrator.*(🤖|📊|💾)|CommandHandler|PDF.*(Generating|generated|size)|WhatsApp.*sending|PARALLEL|upload_vehicle'
  fi
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  Monitoring stopped"
echo "════════════════════════════════════════════════════════════════"
