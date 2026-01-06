# WhatsApp AI Improvements Plan

## Tanggal: 2026-01-06
## Request dari User

### 1. Real-time WhatsApp Status Check ✅
**Masalah**: 
- No WA +62 812 9832 9132 menunjukkan lampu indikator merah di halaman conversations, tetapi hijau di halaman users
- Indikator status WA harus konsisten di semua halaman dan mencerminkan kondisi real-time

**Solusi**:
- ✅ Sudah ada API `/api/v1/whatsapp-ai/check-whatsapp` untuk cek status real-time
- ✅ Sudah ada API `/api/v1/whatsapp-ai/profile-picture` untuk cek profile dan status
- **PERLU PERBAIKAN**: Sinkronisasi status checking di semua halaman
  - Halaman Users: Sudah pakai check-whatsapp API (line 134-136)
  - Halaman Conversations: BELUM implementasi status check, hanya pakai status dari conversation

**Action Items**:
1. Tambahkan real-time status check di halaman conversations
2. Pastikan lampu indikator merah/hijau konsisten:
   - Hijau = WhatsApp terdaftar (isRegistered = true)
   - Merah = WhatsApp tidak terdaftar (isRegistered = false)

---

### 2. Manual Scroll di Conversations ✅ DONE
**Request**: Scroll manual (up/down) tergantung admin/owner/super admin (jangan auto scroll)

**Status**: ✅ **SUDAH SELESAI**
- Line 454-459 di `conversations/page.tsx` sudah komentar auto-scroll
- Scroll sekarang sudah manual

---

### 3 AI Personality Configuration 🔧 IN PROGRESS
**Request**: Personality AI menyesuaikan pilihan settingan di config

**Pilihan Personality**:
- "Friendly & Casual" (friendly)
- "Professional & Formal" (professional)  
- "Enthusiastic & Energetic" (enthusiastic)
- "Helpful & Patient" (helpful)

**Status**: 
- ✅ UI sudah ada di `/dashboard/whatsapp-ai/config` (line 317-327)
- ✅ Database field `aiPersonality` sudah ada
- ❌ **BELUM** terintegrasi ke chat AI response

**Action Items**:
1. ✅ Personality prompt sudah ada di `prompts/index.ts`
2. 🔧 Pastikan `getRolePrompt()` dipanggil dengan personality dari config
3. 🔧 Test semua 4 personality menghasilkan tone yang berbeda

---

### 4. Chat History Improvements 🔧 IN PROGRESS
**Request**: 
- Tambah label jelas: customer/admin/owner/staff
- AI Assistant kasih nama (jangan icon saja)

**Current State**:
- Conversations page sudah ada badge untuk intent
- Belum ada label eksplisit "Customer" / "Admin" / "Owner" / "Staff"
- AI response belum ada nama

**Action Items**:
1. Tambah label sender type di chat history:
   - 👨‍💼 → Customer / Admin / Owner / Staff
   - 🤖 → AI Assistant (nama dari config.aiName)
2. Update tampilan chat messages:
   - Format: `👨‍💼 → Customer` atau `🤖 → AI Assistant (nama)`

---

### 5. KKB Simulation Calculation 🆕 NEW FEATURE
**Request**: AI mampu mengkalkulasi simulasi KKB dari berbagai lembaga:
- Adira Finance
- WOM Finance
- BCA
- Indomobil Finance
- Seva.id

**Contoh Output**:
```
Untuk simulasi KKB Honda City 2006 (Rp 79 juta), berikut estimasinya:

**💰 Simulasi Angsuran (DP 30% = Rp 23.7 juta):**
* Tenor 3 tahun: Rp 2.1-2.4 juta/bulan
* Tenor 4 tahun: Rp 1.7-2.0 juta/bulan  
* Tenor 5 tahun: Rp 1.5-1.7 juta/bulan

**📋 Syarat Umum:**
- KTP suami/istri
- KK
- PBB/AJB (jaminan agunan)
- Slip gaji/rekening koran 3 bulan
- NPWP
```

**Action Items**:
1. Buat function `calculate_kkb_simulation` untuk tool calling
2. Tambahkan knowledge ke system prompt tentang syarat KKB
3. Formula dasar angsuran: 
   - Principal = Harga - DP
   - Bunga tahunan ≈ 8-12% (vary by leasing)
   - PMT formula untuk monthly payment

---

### 6. Photo Handling Improvement 🔧 IN PROGRESS
**Request**: Photo confirmation harus lancar

**Current State**:
- Ada `handlePhotoConfirmationDirectly()` di chat.service.ts (line 206)
- Sudah handle pattern "iya/ya/ok/oke [ID] foto"

**Action Items**:
1. ✅ Review photo confirmation logic
2. ✅ Pastikan fallback jika AI gagal
3. 🔧 Test edge cases (typo, multiple confirmations, etc.)

---

## Priority Order
1. **HIGH**: AI Personality Integration (#3)
2. **HIGH**: Chat History Labels (#4)
3. **MEDIUM**: Real-time Status Check (#1)
4. **MEDIUM**: KKB Calculation (#5)
5. **LOW**: Photo Handling Review (#6)

---

## Implementation Notes

### Personality Prompts
```typescript
const PERSONALITY_PROMPTS = {
  friendly: "Kamu adalah asisten yang ramah, santai, dan mudah didekati. Gunakan bahasa yang hangat, emoji yang sesuai, dan tunjukkan antusiasme dalam membantu customer.",
  
  professional: "Kamu adalah asisten profesional dan formal. Gunakan bahasa yang sopan, jelas, dan to-the-point. Hindari emoji yang berlebihan dan fokus pada informasi yang akurat.",
  
  enthusiastic: "Kamu adalah asisten yang sangat antusias dan energik! Tunjukkan semangat dalam setiap respons, gunakan emoji yang ceria, dan buat customer merasa excited tentang produk kami!",
  
  helpful: "Kamu adalah asisten yang sangat membantu dan sabar. Berikan penjelasan detail, jawab semua pertanyaan dengan teliti, dan pastikan customer merasa didukung penuh."
};
```

### KKB Calculation Formula
```typescript
function calculateMonthlyPayment(principal: number, annualRate: number, months: number): number {
  const monthlyRate = annualRate / 12 / 100;
  const payment = principal * (monthlyRate * Math.pow(1 + monthlyRate, months)) / 
                  (Math.pow(1 + monthlyRate, months) - 1);
  return Math.round(payment);
}

// Example:
// Price: 79,000,000
// DP 30%: 23,700,000
// Principal: 55,300,000
// Rate: 10% annual
// Tenor: 36 months
// Monthly: ~1,782,000
```

---

## Testing Checklist

### Personality Testing
- [ ] Test "Friendly & Casual" - should use emoji, casual language
- [ ] Test "Professional & Formal" - should be formal, minimal emoji
- [ ] Test "Enthusiastic & Energetic" - should be very energetic!
- [ ] Test "Helpful & Patient" - should give detailed explanations

### Status Check Testing
- [ ] Check user +62 812 9832 9132 di halaman users
- [ ] Check same user di halaman conversations
- [ ] Verify lampu indicator sama (hijau/merah)
- [ ] Test dengan user lain yang status berbeda

### KKB Testing
- [ ] Test KKB simulation request dari customer
- [ ] Verify perhitungan angsuran akurat
- [ ] Test dengan berbagai DP (20%, 30%, 40%)
- [ ] Test dengan berbagai tenor (1-5 tahun)

### Chat History Testing
- [ ] Verify customer messages show "👨‍💼 → Customer"
- [ ] Verify staff messages show "👨‍💼 → Staff (Sales)"
- [ ] Verify admin messages show "👨‍💼 → Admin"
- [ ] Verify AI messages show "🤖 → [AI Name]"

---

## Completion Criteria

✅ All features implemented
✅ All tests passing
✅ User confirms lampu indicator konsisten
✅ User confirms AI personality works as expected
✅ User confirms chat labels clear and helpful
✅ User confirms KKB calculation accurate

