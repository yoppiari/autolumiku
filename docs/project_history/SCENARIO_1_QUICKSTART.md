# 🚀 Scenario 1 Test - Quick Start

## ✅ Test Environment Ready

**Test User:** Yudho D. L (OWNER)
**Phone:** 6281310703754
**Access:** ✅ Full PDF access ✅ All tools

**Verification:**
- User registration: ✅ Confirmed
- PDF generation: ✅ Working (9.4KB PDF)
- Parallel processing: ✅ Deployed (commit 40da9b9)

---

## 📱 Quick Test Steps (WhatsApp)

### Step 1: Start Upload
Send to WhatsApp:
```
Upload Honda Brio 2020
```

### Step 2: Provide Data
Send:
```
Hitam, matic, 120jt
```

### Step 3: ⭐ TEST PARALLEL PROCESSING
**While upload is active, send:**
```
sales report
```

### Step 4: Verify Success
✅ You should receive Sales Report PDF
✅ Upload should continue (not reset)
✅ Bot should remember previous data

### Step 5: Complete Upload
Send:
```
KM 50000
```

### Step 6: Finish
Send photos or complete the upload normally

---

## 🔍 What to Look For

### ✅ Success Indicators:
- 📄 PDF document received in WhatsApp
- 💬 Upload conversation continues after PDF
- 🔄 No "start over" or "flow interrupted" message
- ✅ Vehicle data remembered (Brio, Hitam, matic, 120jt, 50000)

### ❌ Failure Indicators:
- ❌ No PDF received
- 🔄 Bot says "Let's start uploading vehicle" after command
- 📝 Previous data forgotten
- ⚠️ Error messages in logs

---

## 📊 Monitor Server Logs

### Option 1: SSH to Production
```bash
ssh root@cf.avolut.com
journalctl -u nextjs -f | grep -E "Orchestrator|PARALLEL"
```

### Option 2: Use Monitor Script
```bash
chmod +x monitor-scenario1.sh
./monitor-scenario1.sh prod
```

### Expected Log Output (Step 3):
```
[Orchestrator] 🤖 WhatsApp AI Command detected - processing with PARALLEL mode
[Orchestrator] 📊 Current conversation state: upload_vehicle
[CommandHandler] Processing command: sales report
[PDF] Generating Sales Summary PDF...
[PDF] ✅ PDF generated successfully, size: XXXXX bytes
```

---

## 🛠️ Quick Checks

### Verify User Registration:
```bash
curl "https://primamobil.id/api/v1/debug/check-user?phone=6281310703754"
```
Should show: `"canAccessPDF": true`

### Test PDF Generation:
```bash
curl "https://primamobil.id/api/v1/debug/test-whatsapp-sales-summary" -o test.pdf
```
Should download PDF file

---

## 📝 Test Results

After testing, update:

| # | Step | Expected | Actual | Pass/Fail |
|---|------|----------|--------|-----------|
| 1 | Upload starts | Bot acknowledges | | ⬜ ⬜ |
| 2 | Data provided | Bot accepts data | | ⬜ ⬜ |
| 3 | Sales report | PDF sent + upload preserved | | ⬜ ⬜ |
| 4 | Continue upload | Upload continues | | ⬜ ⬜ |
| 5 | Complete upload | Vehicle created | | ⬜ ⬜ |

**Overall Result:** ⬜ PASS ⬜ FAIL

---

## 🆘 Troubleshooting

### PDF Not Received?
```bash
# Test PDF endpoint
curl "https://primamobil.id/api/v1/debug/test-whatsapp-sales-summary" -o test.pdf
# Check file: file test.pdf
```

### Upload State Lost?
```bash
# Check deployment
git log --oneline -1
# Should show: 8be6bdf (contains 40da9b9)
```

### Command Not Recognized?
```bash
# Verify user role
curl "https://primamobil.id/api/v1/debug/check-user?phone=6281310703754"
# Should show: "roleLevel": 100
```

---

## 📚 Full Documentation

- **Detailed Steps:** `SCENARIO_1_TEST_STEPS.md`
- **Quick Reference:** `WHATSAPP_TEST_QUICK_REF.txt`
- **All Scenarios:** `WHATSAPP_PARALLEL_TEST_GUIDE.md`
- **Deployment Info:** `DEPLOYMENT_VERIFICATION.md`

---

## 🎯 Ready?

**Open WhatsApp now and start testing!**

1. Send: `Upload Honda Brio 2020`
2. Send: `Hitam, matic, 120jt`
3. Send: `sales report` ← **CRITICAL TEST**
4. Check for PDF in WhatsApp
5. Send: `KM 50000`
6. Verify upload continues

**Good luck! 🚀**
