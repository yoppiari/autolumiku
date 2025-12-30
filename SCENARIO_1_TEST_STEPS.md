# Scenario 1 Test: Upload + Sales Report PDF
## Parallel Processing Verification

### Test Setup Verified ✅

**Test User:**
- Name: Yudho D. L
- Role: OWNER (roleLevel: 100)
- Phone: 6281310703754
- Access: ✅ PDF Reports ✅ All Tools

**PDF Generation:** ✅ Working (9.4KB PDF generated successfully)

---

## 📱 Step-by-Step Test Instructions

### Step 1: Start Upload Flow
**Open WhatsApp** and send to your business number:

```
Upload Honda Brio 2020
```

**Expected Response:**
- Bot should acknowledge and start collecting vehicle data
- Bot will ask for missing information (color, transmission, price, KM, etc.)

---

### Step 2: Provide Partial Data
Respond with some vehicle details:

```
Hitam, matic, 120jt
```

**Expected Response:**
- Bot confirms the data received
- Bot continues asking for remaining information
- **Upload state should be active**

---

### Step 3: Trigger Sales Report Command ⬅️ KEY TEST
**While still in upload flow**, send:

```
sales report
```

**This is the PARALLEL PROCESSING moment!**

---

### Step 4: Verify Parallel Processing ✅

**What Should Happen:**

1. ✅ **Command Executed:** Bot generates and sends Sales Report PDF
2. ✅ **Upload Preserved:** Upload state NOT reset
3. ✅ **No Errors:** No "flow interrupted" or "start over" messages

**Expected Bot Response:**
```
🤖 Command detected - processing with PARALLEL mode
📊 Current conversation state: upload_vehicle

[Generating Sales Report PDF...]
[PDF sent to WhatsApp]
```

---

### Step 5: Continue Upload Flow
After receiving the PDF, continue providing vehicle data:

```
KM 50000
```

**Expected Response:**
- Bot should accept the KM data
- Upload flow continues normally
- Bot remembers all previous data (Brio, Hitam, matic, 120jt, 50000)

---

### Step 6: Complete Upload
Provide remaining details or send photos to complete the upload:

```
Foto kendaraan sudah dikirim
```

**Expected Response:**
- Bot processes the complete vehicle data
- Vehicle is created/published to website
- Upload completes successfully

---

## 🔍 Verification Points

### ✅ Success Criteria

#### 1. Command Recognition ✅
- [ ] "sales report" command is recognized during upload
- [ ] Server logs show: `Command detected - processing with PARALLEL mode`
- [ ] Server logs show: `Current conversation state: upload_vehicle`

#### 2. PDF Generation ✅
- [ ] Sales Report PDF is generated
- [ ] PDF is sent to WhatsApp
- [ ] PDF contains sales data for Prima Mobil

#### 3. Upload State Preservation ✅
- [ ] Upload flow is NOT interrupted
- [ ] Upload state is preserved after command
- [ ] User can continue providing vehicle data
- [ ] No "starting over" or "flow reset" messages

#### 4. Data Integrity ✅
- [ ] All vehicle data provided before command is remembered
- [ ] All vehicle data provided after command is accepted
- [ ] Vehicle data is not lost or corrupted

---

## 📊 Server Logs to Monitor

### SSH to Server:
```bash
ssh root@cf.avolut.com
journalctl -u nextjs -f | grep -E "Orchestrator|Command|PARALLEL|PDF"
```

### Expected Log Output:

**Step 1 - Start Upload:**
```
[Orchestrator] Staff detected, checking for commands...
[CommandHandler] No command detected, processing as staff message
[Orchestrator] Starting upload vehicle flow for staff
```

**Step 2 - Provide Data:**
```
[Orchestrator] 💾 Upload vehicle flow - processing data/foto
[StaffCommand] Processing vehicle data: { make: 'Honda', model: 'Brio', year: '2020', color: 'Hitam', transmission: 'matic', price: '120jt' }
```

**Step 3 - Sales Report Command (CRITICAL):**
```
[Orchestrator] 🤖 WhatsApp AI Command detected - processing with PARALLEL mode
[Orchestrator] 📊 Current conversation state: upload_vehicle
[CommandHandler] Processing command: sales report
[PDF] Generating Sales Summary PDF...
[PDF] ✅ PDF generated successfully, size: XXXXX bytes
[WhatsApp] Sending PDF to: 6281310703754
```

**Step 4 - Continue Upload:**
```
[Orchestrator] Staff detected, checking for commands...
[Orchestrator] 💾 Upload vehicle flow - processing data/foto
[StaffCommand] Processing vehicle data: { km: '50000' }
```

**Step 5 - Complete Upload:**
```
[StaffCommand] ✅ Vehicle created successfully: VEHICLE_ID
[Orchestrator] Upload flow completed
```

---

## 🐛 Troubleshooting

### Issue 1: Command Not Recognized
**Symptoms:**
- Bot says "I don't understand" or continues upload
- No PDF sent

**Checks:**
```bash
# Verify user role
curl "https://primamobil.id/api/v1/debug/check-user?phone=6281310703754"

# Expected output:
# "role": "OWNER"
# "roleLevel": 100
# "canAccessPDF": true
```

**Solution:**
- Ensure command spelling is exact: "sales report"
- Check user has roleLevel >= 90
- Verify command is in command-handler.service.ts

---

### Issue 2: Upload State Lost
**Symptoms:**
- After PDF, bot says "Let's start uploading"
- Previous vehicle data forgotten

**Checks:**
```bash
# Verify deployment
git log --oneline -1
# Should show: 8be6bdf or later (contains 40da9b9)

# Check code
grep -A 10 "CHECK FOR WHATSAPP AI COMMANDS" src/lib/services/whatsapp-ai/message-orchestrator.service.ts
```

**Solution:**
- Verify parallel processing code is present
- Check commit 40da9b9 is in history
- Restart server if needed

---

### Issue 3: PDF Not Sending
**Symptoms:**
- Command recognized but no PDF received
- Error logs showing PDF generation failed

**Checks:**
```bash
# Test PDF generation directly
curl "https://primamobil.id/api/v1/debug/test-whatsapp-sales-summary" -o test.pdf
file test.pdf
# Should show: PDF document

# Check Aimeow configuration
grep -r "clientId" src/lib/services/whatsapp-ai/
```

**Solution:**
- Test PDF generation endpoint works
- Check Aimeow webhook configuration
- Verify WhatsApp Business API credits
- Check tenantId matches database

---

### Issue 4: Server Logs Not Showing
**Symptoms:**
- Can't see logs when testing

**Checks:**
```bash
# If using local development
cd autolumiku
npm run dev

# Watch logs in another terminal
tail -f logs/combined.log | grep -E "Orchestrator|Command"

# If using production
ssh root@cf.avolut.com
journalctl -u nextjs -f | grep -E "Orchestrator|Command|PARALLEL"
```

---

## 📝 Test Results Template

**Date:** ___________
**Tester:** ___________
**Start Time:** ___________

### Test Execution:

| Step | Action | Expected | Actual | Status |
|------|--------|----------|--------|--------|
| 1 | Send "Upload Honda Brio 2020" | Upload starts | | ⬜ Pass ⬜ Fail |
| 2 | Send "Hitam, matic, 120jt" | Data accepted | | ⬜ Pass ⬜ Fail |
| 3 | Send "sales report" | PDF sent + upload preserved | | ⬜ Pass ⬜ Fail |
| 4 | Send "KM 50000" | Upload continues | | ⬜ Pass ⬜ Fail |
| 5 | Complete upload | Vehicle created | | ⬜ Pass ⬜ Fail |

### Log Evidence:

**Step 3 Log (Parallel Processing):**
```
(Paste server logs here showing PARALLEL mode)
```

### Screenshots:

- [ ] Upload flow before command
- [ ] PDF received in WhatsApp
- [ ] Upload flow after command
- [ ] Final vehicle created

### Issues Found:

1.
2.
3.

### Overall Result:
⬜ **PASS** - All criteria met, parallel processing working
⬜ **FAIL** - Issues found, see above

---

## 🎯 Quick Reference

### Command to Send:
```
sales report
```

### Key Log Messages:
```
[Orchestrator] 🤖 WhatsApp AI Command detected - processing with PARALLEL mode
[Orchestrator] 📊 Current conversation state: upload_vehicle
```

### Success Indicators:
- ✅ PDF document received in WhatsApp
- ✅ Upload flow continues after command
- ✅ No "start over" message
- ✅ Vehicle data remembered

---

## 📞 Need Help?

If issues occur:
1. **Capture server logs** immediately
2. **Screenshot WhatsApp** conversation
3. **Check deployment status:** `git log --oneline -5`
4. **Verify endpoints** using curl commands above
5. **Report results** in this document

---

**Ready to test?** Open WhatsApp and start with Step 1! 🚀
