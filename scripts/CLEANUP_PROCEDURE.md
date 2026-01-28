# 🛡️ PROSEDUR AMAN: CLEANUP STAFF LEADS

## ⚠️ PERINGATAN PENTING
**JANGAN LANGSUNG DELETE!** Ikuti prosedur ini step-by-step untuk menghindari kehilangan data penting.

---

## 📋 LANGKAH-LANGKAH AMAN

### **FASE 1: ANALISIS (WAJIB!)**

#### 1️⃣ SSH ke Server Production
```bash
ssh user@your-server
```

#### 2️⃣ Masuk ke PostgreSQL
```bash
docker exec -it postgres-dk0ck4sc0kg4cowgkws4cwog psql -U autolumiku -d autolumiku_prod
```

#### 3️⃣ Jalankan Analisis Lengkap
Copy-paste isi file `scripts/analyze-staff-leads.sql` ke PostgreSQL console.

**Yang harus Anda perhatikan:**
- ✅ Query 1: Lihat SEMUA leads dari staff
- ✅ Query 2: Summary berapa banyak per staff
- ✅ Query 3: **PENTING!** Leads yang punya conversation aktif
- ✅ Query 4: **PENTING!** Leads yang masih aktif 7 hari terakhir
- ✅ Query 5: Rekomendasi leads yang AMAN dihapus

#### 4️⃣ SCREENSHOT atau CATAT Hasilnya
**WAJIB!** Simpan hasil query untuk dokumentasi.

---

### **FASE 2: DRY RUN (WAJIB!)**

#### 5️⃣ Jalankan DRY RUN dari `cleanup-staff-leads.sql`
Jalankan **STEP 1** dan **STEP 2** (yang TIDAK di-comment).

**Perhatikan kolom `delete_status`:**
- ✅ `SAFE TO DELETE` - Aman dihapus
- ⚠️ `HAS CONVERSATION - SKIP` - JANGAN dihapus!
- ⚠️ `RECENT ACTIVITY - SKIP` - JANGAN dihapus!
- ⚠️ `IMPORTANT STATUS - SKIP` - JANGAN dihapus!

#### 6️⃣ Review Summary
Lihat berapa yang akan di-DELETE vs di-SKIP.

**Contoh output yang AMAN:**
```
action                      | count
----------------------------|------
DELETE: Safe to Remove      |   15
SKIP: Has Conversation      |    3
SKIP: Recent Activity       |    2
SKIP: Important Status      |    1
```

**Jika ada yang mencurigakan, STOP dan tanya dulu!**

---

### **FASE 3: BACKUP (SANGAT RECOMMENDED!)**

#### 7️⃣ Buat Backup Table
Jalankan **STEP 3B** bagian pertama (CREATE TABLE):

```sql
CREATE TABLE "Lead_Backup_Staff" AS
SELECT l.*, u."firstName" || ' ' || u."lastName" AS staff_name, u.role AS staff_role
FROM "Lead" l
INNER JOIN "User" u ON (...)
WHERE (...);
```

#### 8️⃣ Verify Backup
```sql
SELECT COUNT(*) AS backed_up_count FROM "Lead_Backup_Staff";
```

**Pastikan jumlahnya sesuai dengan yang di summary!**

#### 9️⃣ Cek Isi Backup
```sql
SELECT * FROM "Lead_Backup_Staff" LIMIT 10;
```

**Pastikan data ter-backup dengan benar!**

---

### **FASE 4: DELETE (HATI-HATI!)**

#### 🔟 Jalankan DELETE
**HANYA SETELAH YAKIN 100%!**

```sql
DELETE FROM "Lead"
WHERE id IN (SELECT id FROM "Lead_Backup_Staff");
```

#### 1️⃣1️⃣ Verify Deletion
```sql
-- Cek berapa yang terhapus
SELECT COUNT(*) FROM "Lead_Backup_Staff";

-- Cek apakah masih ada leads dari staff
SELECT COUNT(*) FROM "Lead" l
INNER JOIN "User" u ON (...)
WHERE u."roleLevel" >= 30 OR u.role IN ('STAFF', 'SALES', 'ADMIN', 'OWNER', 'SUPER_ADMIN');
```

---

### **FASE 5: ROLLBACK (Jika Ada Masalah)**

#### ❌ Jika Ada Kesalahan, RESTORE Immediately!
```sql
-- Kembalikan data dari backup
INSERT INTO "Lead" 
SELECT id, "tenantId", "vehicleId", name, email, phone, "whatsappNumber", 
       message, source, status, priority, "interestedIn", "budgetRange", 
       timeframe, "followUpDate", notes, "assignedTo", "createdAt", 
       "updatedAt", "lastContactAt", urgency
FROM "Lead_Backup_Staff";
```

#### ✅ Verify Restore
```sql
SELECT COUNT(*) FROM "Lead";
```

---

## 🎯 CHECKLIST KEAMANAN

Sebelum DELETE, pastikan:

- [ ] ✅ Sudah jalankan `analyze-staff-leads.sql` dan review hasilnya
- [ ] ✅ Sudah jalankan DRY RUN dan tidak ada yang mencurigakan
- [ ] ✅ Sudah buat backup table `Lead_Backup_Staff`
- [ ] ✅ Sudah verify backup (COUNT dan isi data)
- [ ] ✅ Sudah screenshot/catat hasil analisis
- [ ] ✅ Sudah diskusi dengan tim jika ada keraguan
- [ ] ✅ Sudah siap script ROLLBACK jika ada masalah

**JIKA ADA 1 SAJA YANG BELUM, JANGAN DELETE!**

---

## 🚨 KRITERIA YANG AKAN DIHAPUS

**HANYA** leads yang memenuhi **SEMUA** kriteria ini:

1. ✅ Phone number milik staff/admin (roleLevel >= 30 atau role STAFF/SALES/ADMIN/OWNER)
2. ✅ **TIDAK** ada WhatsAppConversation terkait
3. ✅ **TIDAK** ada aktivitas 30 hari terakhir (lastContactAt)
4. ✅ Status **BUKAN** WON atau QUALIFIED

**Jika ada 1 saja yang tidak terpenuhi, lead tersebut DI-SKIP (tidak dihapus).**

---

## 📞 JIKA ADA MASALAH

1. **STOP immediately!**
2. **JANGAN PANIC!**
3. Jalankan ROLLBACK script (Fase 5)
4. Screenshot error message
5. Hubungi developer/DBA

---

## 💡 TIPS TAMBAHAN

### Jika Ragu, Jangan Hapus!
Lebih baik ada data "sampah" daripada kehilangan data penting.

### Test di Staging Dulu (Jika Ada)
Jika punya database staging, test prosedur ini di sana dulu.

### Backup Database Lengkap (Optional tapi Recommended)
```bash
pg_dump -U autolumiku autolumiku_prod > backup_before_cleanup_$(date +%Y%m%d).sql
```

### Simpan Backup Table Minimal 30 Hari
Jangan langsung drop `Lead_Backup_Staff` setelah delete. Simpan minimal 30 hari.

---

## ✅ SETELAH CLEANUP SELESAI

1. Dokumentasikan berapa leads yang dihapus
2. Monitor dashboard leads untuk memastikan tidak ada masalah
3. Simpan backup table minimal 30 hari
4. Update tim bahwa cleanup sudah selesai

---

**Dibuat oleh:** Antigravity AI  
**Tanggal:** 2026-01-28  
**Tujuan:** Mencegah kehilangan data saat cleanup staff leads
