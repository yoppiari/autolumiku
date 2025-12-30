# WhatsApp AI Parallel Processing Test Guide

## Deployment Status
✅ **Deployed**: Commit `40da9b9` - PARALLEL PROCESSING architecture

## Architecture Overview
- **Commands** are processed with **priority** (checked first at line 201)
- **Upload state** is **preserved** during command execution
- **Parallel execution**: Commands and upload flow can run simultaneously

## Test Setup

### Prerequisites
1. WhatsApp Business number connected to Aimeow webhook
2. Test user registered with role ADMIN or OWNER (roleLevel >= 90)
3. Database has vehicles and sales data for PDF generation

### Quick Check - Verify User Registration
```bash
curl "https://primamobil.id/api/v1/debug/check-user?phone=6281310703754"
```

Expected response should show:
```json
{
  "found": true,
  "matchedPhone": "081310703754",
  "matchType": "0-prefix",
  "user": {
    "role": "OWNER",
    "roleLevel": 100,
    "canAccessPDF": true,
    "canAccessTools": true
  }
}
```

---

## 6 Test Scenarios

### Scenario 1: Upload + Sales Report PDF
**Test PDF commands don't block upload flow**

**Steps:**
1. User: `Upload Honda Brio 2020`
2. Bot: Asks for missing data (KM, color, transmission, etc.)
3. User: `Hitam, matic, 120jt` (providing data)
4. Bot: Confirms data, still needs more info
5. User: `sales report` ⬅️ **PARALLEL COMMAND**
6. Bot: [Generates & sends Sales Report PDF]
7. User: `KM 50000` ⬅️ **Continue upload**
8. Bot: Continues upload flow normally

**Expected Results:**
- ✅ Sales Report PDF sent successfully
- ✅ Upload state preserved (not reset)
- ✅ User can continue providing vehicle data
- ✅ Both operations complete independently

**Success Criteria:**
```
[Orchestrator] 🤖 WhatsApp AI Command detected - processing with PARALLEL mode
[Orchestrator] 📊 Current conversation state: upload_vehicle
```

---

### Scenario 2: Upload + Low Stock Alert
**Test inventory commands during upload**

**Steps:**
1. User: `Upload Toyota Avanza 2019`
2. Bot: Asks for missing details
3. User: `Putih, manual, 150jt`
4. Bot: Continues asking for more data
5. User: `stok` or `inventory` ⬅️ **PARALLEL COMMAND**
6. Bot: Sends current inventory/stock report
7. User: `Tahun 2019` ⬅️ **Continue upload**
8. Bot: Upload flow continues

**Expected Results:**
- ✅ Inventory report sent
- ✅ Upload conversation state maintained
- ✅ Vehicle data preserved in context
- ✅ No "flow interrupted" message

---

### Scenario 3: Upload + Edit Vehicle
**Test edit command during upload**

**Steps:**
1. User: `Upload Yamaha NMAX 2022`
2. Bot: Asks for vehicle details
3. User: `Merah, 25jt`
4. Bot: Still needs more info
5. User: `ganti Avanza` or `edit Avanza` ⬅️ **PARALLEL COMMAND**
6. Bot: [Finds existing Avanza] Shows edit form
7. User: `Cancel` or cancel edit
8. User: `Automatic transmission` ⬅️ **Continue upload**
9. Bot: Upload flow resumes

**Expected Results:**
- ✅ Edit command processed
- ✅ Edit form/options displayed
- ✅ Upload state not lost
- ✅ Can return to upload seamlessly

---

### Scenario 4: Upload + Status Check
**Test status command during upload**

**Steps:**
1. User: `Upload Mitsubishi Pajero 2021`
2. Bot: Requests missing fields
3. User: `Hitam, 300jt`
4. Bot: Continues data collection
5. User: `status` ⬅️ **PARALLEL COMMAND**
6. Bot: Sends system/dashboard status report
7. User: `Diesel, automatic` ⬅️ **Continue upload**
8. Bot: Upload proceeds normally

**Expected Results:**
- ✅ Status report generated and sent
- ✅ Upload context preserved
- ✅ Vehicle data still in memory
- ✅ Smooth continuation after command

---

### Scenario 5: Upload + Sales Metrics PDF
**Test metrics PDF during upload**

**Steps:**
1. User: `Upload Honda Jazz 2020`
2. Bot: Collects vehicle information
3. User: `Abu-abu, 135jt`
4. Bot: Still needs more details
5. User: `metrics penjualan` ⬅️ **PARALLEL PDF COMMAND**
6. Bot: [Generates Sales Metrics PDF] Sends via WhatsApp
7. User: `KM 40000` ⬅️ **Continue upload**
8. Bot: Upload flow continues

**Expected Results:**
- ✅ Sales Metrics PDF sent
- ✅ Upload state intact
- ✅ No data loss
- ✅ Both operations successful

---

### Scenario 6: Upload + Staff Performance PDF
**Test staff performance PDF during upload**

**Steps:**
1. User: `Upload Suzuki Ertiga 2023`
2. Bot: Asks for vehicle specs
3. User: `Silver, 220jt`
4. Bot: Continues data collection
5. User: `laporan staff` or `staff performance` ⬅️ **PARALLEL PDF COMMAND**
6. Bot: [Generates Staff Performance PDF] Sends to WhatsApp
7. User: `Matic, 7 seater` ⬅️ **Continue upload**
8. Bot: Upload flow resumes

**Expected Results:**
- ✅ Staff Performance PDF sent
- ✅ Upload context maintained
- ✅ Data integrity preserved
- ✅ Seamless parallel execution

---

## All Available PDF Commands

### Admin/Owner Only (roleLevel >= 90)
- `sales report` - Sales summary PDF
- `whatsapp ai` - WhatsApp analytics PDF
- `metrics penjualan` - Sales metrics PDF
- `metrics pelanggan` - Customer metrics PDF
- `metrics operational` - Operational metrics PDF
- `laporan staff` - Staff performance PDF
- `laporan inventory` - Inventory report PDF

### Universal Commands (All Staff)
- `upload` - Start vehicle upload
- `stok` / `inventory` - Check stock levels
- `status` - System status
- `statistik` / `stats` / `laporan` - Statistics overview
- `edit` / `ubah` / `ganti` - Edit vehicles

---

## Testing Checklist

### Core Functionality
- [ ] Command detected during upload flow
- [ ] PDF generated and sent successfully
- [ ] Upload state preserved (not reset)
- [ ] Upload can continue after command
- [ ] Both operations complete independently
- [ ] No "flow interrupted" errors
- [ ] Conversation state logged correctly

### Edge Cases
- [ ] Multiple commands in sequence during upload
- [ ] Command immediately after starting upload
- [ ] Command right before completing upload
- [ ] Invalid command during upload (should be ignored)
- [ ] Staff role (roleLevel 30) using universal commands

---

## Debugging

### Check Server Logs
```bash
# SSH to server
journalctl -u nextjs -f | grep -E "Orchestrator|Command|PARALLEL"
```

**Look for:**
```
[Orchestrator] 🤖 WhatsApp AI Command detected - processing with PARALLEL mode
[Orchestrator] 📊 Current conversation state: upload_vehicle
[CommandHandler] Processing command: sales report
[PDF] Generating Sales Summary PDF...
```

### Test PDF Generation Directly
```bash
curl "https://primamobil.id/api/v1/debug/test-whatsapp-sales-summary" -o test.pdf
```

### Verify Phone Matching
```bash
# Replace PHONE with your WhatsApp number (62 format)
curl "https://primamobil.id/api/v1/debug/check-user?phone=6281234567890"
```

---

## Common Issues & Solutions

### Issue 1: Command not recognized
**Symptom**: Upload continues, no PDF sent
**Check:**
- User roleLevel >= 90 for PDF commands
- Command spelling matches exactly
- Command not in escape patterns

**Solution:**
```bash
# Check user role
curl "https://primamobil.id/api/v1/debug/check-user?phone=YOUR_PHONE"
```

### Issue 2: Upload state lost after command
**Symptom**: After PDF, upload starts from beginning
**Check:**
- Verify parallel processing is deployed (commit `40da9b9`)
- Check server logs for "PARALLEL mode" message

**Solution:**
```bash
# Verify deployment
git log --oneline -1
# Should show: 40da9b9 feat(whatsapp-ai): PARALLEL PROCESSING
```

### Issue 3: PDF not sending
**Symptom**: Command detected but no PDF received
**Check:**
- Aimeow clientId configuration
- PDF generation errors in logs
- WhatsApp Business API credits

**Solution:**
```bash
# Test PDF generation endpoint
curl "https://primamobil.id/api/v1/debug/test-whatsapp-sales-summary" -o test.pdf
# Should download PDF successfully
```

### Issue 4: User not found
**Symptom**: "User not registered" error
**Check:**
- Phone number format in database
- User exists in dashboard
- Phone matching logic

**Solution:**
```bash
# Test all phone formats
curl "https://primamobil.id/api/v1/debug/check-user?phone=081234567890"  # 0-prefix
curl "https://primamobil.id/api/v1/debug/check-user?phone=6281234567890"  # 62-prefix
```

---

## Success Metrics

### ✅ All 6 Scenarios Pass
- All PDF commands work during upload
- Upload state preserved in all cases
- No data loss or corruption
- Smooth user experience

### ✅ Performance Acceptable
- PDF generation: < 5 seconds
- Command response: < 2 seconds
- Upload flow resumes immediately

### ✅ No Regressions
- Normal upload still works (no commands)
- Commands still work outside upload
- Staff access control intact

---

## Report Results

After testing, update this section:

**Date:** ___________
**Tester:** ___________
**Test Phone:** ___________

| Scenario | Status | Notes |
|----------|--------|-------|
| Scenario 1: Upload + Sales Report | ⬜ Pass ⬜ Fail | |
| Scenario 2: Upload + Low Stock | ⬜ Pass ⬜ Fail | |
| Scenario 3: Upload + Edit Vehicle | ⬜ Pass ⬜ Fail | |
| Scenario 4: Upload + Status Check | ⬜ Pass ⬜ Fail | |
| Scenario 5: Upload + Sales Metrics | ⬜ Pass ⬜ Fail | |
| Scenario 6: Upload + Staff Performance | ⬜ Pass ⬜ Fail | |

**Overall Result:** ⬜ ALL PASS ⬜ NEEDS FIXES

**Issues Found:**
1.
2.
3.

**Server Logs Snippets:**
(Paste relevant log outputs here)
