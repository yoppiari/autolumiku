# AI Intent Classification Fix - Contact & Location Inquiry

## Problem Statement
AI was misclassifying non-vehicle questions as vehicle inquiries, causing irrelevant responses:

1. ❌ "Salesnya siapa di prima mobil?" → AI showed vehicle list
2. ❌ "Lokasi prima mobil showroom dimana?" → AI showed vehicle list  
3. ❌ "Fitur leads sudah jalan?" → Triggered stop command ("Baik, saya berhenti ya")

## Root Cause
**Priority Order Issue**: Vehicle inquiry patterns were checked BEFORE contact/location patterns, causing keywords like "mobil" or "prima mobil" to trigger vehicle_inquiry even when the question was about showroom info.

**Stop Pattern Too Broad**: Pattern matched common words like "sudah", "harusnya", causing false positives.

## Solution

### 1. Reordered Intent Priority (`intent-classifier.service.ts`)
**New Priority Order** (by confidence score):
1. **0.95** - Contact Inquiry (Step 6) ✨ MOVED UP
2. **0.95** - Location Inquiry (Step 7) ✨ NEW
3. **0.90** - Vehicle Inquiry (Step 9) ⬇️ MOVED DOWN
4. **0.90** - Price Inquiry (Step 10)
5. **0.70** - Greeting (Step 8)

### 2. Added Location Inquiry Pattern
```typescript
location_inquiry: [
  /\b(lokasi|alamat|address|dimana|di mana|where)\b.*\b(showroom|toko|kantor|tempat|outlet|cabang)\b/i,
  /\b(showroom|toko|kantor|tempat|outlet|cabang)\b.*\b(lokasi|alamat|dimana|di mana|where|ada|berada)\b/i,
  /^(dimana|di mana|where|alamat|lokasi)\b/i,
  /\b(cara|route|rute|arah|jalan)\b.*\b(ke|menuju|sampai)\b.*\b(showroom|toko|kantor|tempat)\b/i,
  /\b(maps|google maps|waze|gmaps|peta)\b/i,
]
```

### 3. Fixed Stop Command Pattern (`message-orchestrator.service.ts`)
**Old Pattern** (Too broad):
```typescript
/(?:^|\b)(stop|berhenti|cukup|sudah|udah|selesai|jangan|...)\b/i
```

**New Pattern** (Strict):
```typescript
/^(stop|berhenti|cukup|selesai|batalkan|cancel)$|(?:\b)(stop\s+(foto|spam|kirim|unit)|jangan\s+kirim|...)\b/i
```

## Impact

### ✅ Before → After

| User Message | Before | After |
|--------------|--------|-------|
| "Salesnya siapa di prima mobil?" | 🚗 Vehicle list | 📞 Contact info |
| "Lokasi showroom dimana?" | 🚗 Vehicle list | 📍 Location info |
| "Fitur leads sudah jalan?" | 🛑 "Baik, saya berhenti ya" | 💬 Normal response |
| "Harusnya kamu panggil saya kak Yudho" | 🛑 Stop triggered | 💬 Normal response |

### Expected Behavior Now

**Contact Inquiry:**
```
User: "Salesnya siapa di prima mobil?"
AI: "Untuk informasi kontak sales kami, bisa hubungi:
     📞 Bapak/Ibu [Sales Name]
     📱 WA: 08xxx-xxxx-xxxx"
```

**Location Inquiry:**
```
User: "Lokasi showroom dimana?"
AI: "Showroom Prima Mobil berlokasi di:
     📍 [Address]
     🗺️ Google Maps: [Link]
     Buka setiap hari pukul 09:00 - 17:00"
```

## Files Changed
1. `src/lib/services/whatsapp-ai/core/intent-classifier.service.ts`
   - Added `location_inquiry` pattern
   - Reordered priority: contact/location BEFORE vehicle
   
2. `src/lib/services/whatsapp-ai/core/message-orchestrator.service.ts`
   - Fixed stop command pattern (stricter matching)

## Testing Checklist
- [ ] "Salesnya siapa?" → Contact info response
- [ ] "Lokasi showroom dimana?" → Location info response
- [ ] "Alamat prima mobil?" → Location info response
- [ ] "Fitur leads sudah jalan?" → Normal response (NOT stop)
- [ ] "Harusnya kamu..." → Normal response (NOT stop)
- [ ] "stop foto" → Stop command triggered ✅
- [ ] "berhenti kirim" → Stop command triggered ✅
