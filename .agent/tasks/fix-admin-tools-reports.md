# Fix Admin/Owner WhatsApp AI Tools

## Status: 🔴 IN PROGRESS

## Issues Identified

### ✅ FIXED (Deployed)
1. **Dark Theme** - Conversation list sidebar now uses dark colors
2. **"Rp Rp 0" duplicate** - Removed duplicate "Rp" prefix in Total Pendapatan report
3. **"Ringkasan Penjualan"** - Added missing alias `ringkasan_penjualan` and `ringkasan penjualan`
4. **"Daftar Kendaraan"** - Added missing aliases `daftar kendaraan` and `list_kendaraan`
5. **Blog Title Visibility** - Added `text-white` to grid view titles, updated category badge to dark theme

### ⚠️ TODO
6. **"Tren Penjualan"** - Returns generic redirect message instead of detailed stats
7. **"Performa Staff"** - Only shows 2 users (ADMINs), missing OWNER role users

---

## Issue #6: "Tren Penjualan" Not Showing Details

### Current Behavior
User types: "Tren Penjualan"
AI responds with:
```
📈 TREN PENJUALAN

Grafik tren dan analisis pertumbuhan tersedia di dashboard.

🔗 Lihat Grafik:
https://primamobil.id/dashboard/whatsapp-ai/analytics?tab=sales
```

### Expected Behavior
Should show detailed trend analysis like:
```
📈 TREN PENJUALAN

• Bulan ini: 0 unit
• Bulan lalu: 0 unit  
• Status: STABIL 0 unit

🧮 RUMUSAN:
• Trend = (Jualan Bulan Ini) - (Jualan Bulan Lalu)

🧐 ANALISA:
• Volume penjualan stabil (sama dengan bulan lalu).
```

### Root Cause
Need to investigate:
1. Check if `getSalesTrends()` function in `report.service.ts` is being called
2. Check if there's intent classification issue routing "Tren Penjualan" to wrong handler
3. Check if the response is coming from AI-generated text instead of report service

### Files to Check
- `src/lib/services/whatsapp-ai/report.service.ts` (line 193-234)
- `src/lib/services/whatsapp-ai/chat.service.ts` (intent routing)
- AI prompts that might be generating this generic response

### Proposed Fix
1. Add missing aliases for "Tren Penjualan" in report.service.ts:
   ```typescript
   case 'sales_trends':
   case 'sales-trends':
   case 'tren_penjualan':
   case 'tren penjualan':  // ADD THIS
   case 'trend_penjualan':  // ADD THIS
       return await this.getSalesTrends(tenantId);
   ```

2. Verify the `getSalesTrends()` function returns proper data (it should already exist)

3. Test with "Tren Penjualan" command via WhatsApp

---

## Issue #7: "Performa Staff" Missing OWNER Users

### Current Behavior
Shows only 2 users:
```
👥 STAFF TERDAFTAR:
* Yudho D. L (ADMIN) ⭐ Active
* Prima Mobil (Admin) ⭐ Active
```

But OWNER role users are not listed.

### Expected Behavior
Should show ALL users including OWNER role:
```
👥 STAFF TERDAFTAR:
* [Owner Name] (OWNER) ⭐ Active
* Yudho D. L (ADMIN) ⭐ Active
* Prima Mobil (ADMIN) ⭐ Active
```

### Root Cause
This report seems to be AI-generated text, NOT from the static report service.

Need to check:
1. If "Performa Staff" is routed to `getStaffPerformance()` in report.service.ts
2. Or if it's handled by AI chat service dynamically

Looking at the response format (includes "Apakah ada hal lain yang bisa kami bantu? 😊"), this appears to be coming from AI-generated response, not the static report.

### Files to Check
- `src/lib/services/whatsapp-ai/chat.service.ts` - Check if "performa staff" triggers AI response
- `src/lib/services/whatsapp-ai/prompts/` - Check if there's a prompt causing this behavior
- `src/lib/services/whatsapp-ai/report.service.ts` (line 406-443) - `getStaffPerformance()`

### Investigation Needed
1. Check intent classification for "Performa Staff"
2. Check if it's being handled by report service or AI chat
3. If AI chat → Update prompts to include OWNER role
4. If report service → The `getStaffPerformance()` function only shows TOP PERFORMING SALES by vehicle count, not all staff

The current `getStaffPerformance()` queries:
```typescript
const topSales = await prisma.vehicle.groupBy({
  by: ['createdBy'],
  where: { tenantId, status: 'SOLD' },
  _count: true,
  orderBy: { _count: 'desc' },
  take: 5
});
```

This only shows users who have SOLD vehicles. It doesn't list ALL staff members.

### Proposed Fix Options

**Option A: Enhance Report Service Function**
Modify `getStaffPerformance()` to:
1. First list ALL staff members (including OWNER, ADMIN, STAFF roles)
2. Then show performance metrics for those who have sales

**Option B: Route to Different Report**
"Performa Staff" might need a different report that:
1. Lists all registered users
2. Shows their roles
3. Shows basic activity metrics

**Recommended: Option A** - Enhance existing function to show complete staff list first, then performance metrics.

---

## Implementation Priority

1. ✅ **Fix "Tren Penjualan" alias** (5 min) - Quick win
2. 🔍 **Investigate "Performa Staff" routing** (10 min) - Need to confirm where it's handled
3. 🔧 **Implement appropriate fix** (15-30 min) - Based on investigation findings

---

## Testing Checklist

After fixes:
- [ ] Test "Tren Penjualan" via WhatsApp - should show detailed stats
- [ ] Test "tren penjualan" (lowercase) via WhatsApp
- [ ] Test "Trend Penjualan" via WhatsApp
- [ ] Test "Performa Staff" via WhatsApp - should show ALL users including OWNER
- [ ] Verify dark theme deployed successfully on primamobil.id/dashboard/whatsapp-ai/conversations
- [ ] Verify blog titles visible on primamobil.id/dashboard/blog

---

## Deployment Notes

All fixes are backend TypeScript changes in the `src/lib/services/whatsapp-ai/` directory.
- No database migrations needed
- Changes take effect immediately after deployment
- No cache clearing required
