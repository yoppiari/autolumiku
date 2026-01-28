# 📁 Scripts Directory

Folder ini berisi berbagai script untuk maintenance, cleanup, dan analisis database.

---

## 🧹 Staff Leads Cleanup

### 📄 File-file Terkait:

1. **`analyze-staff-leads.sql`** - Analisis lengkap leads dari staff
   - 5 query untuk cross-check data
   - Identifikasi leads yang masih aktif vs yang aman dihapus
   - **WAJIB dijalankan sebelum cleanup!**

2. **`cleanup-staff-leads.sql`** - Script cleanup dengan safety checks
   - DRY RUN untuk preview
   - Summary berapa yang akan dihapus
   - DELETE dengan multiple safety filters
   - Opsi backup sebelum delete

3. **`CLEANUP_PROCEDURE.md`** - Prosedur lengkap step-by-step
   - Panduan detail dari analisis sampai delete
   - Checklist keamanan
   - Instruksi rollback jika ada masalah
   - **BACA INI DULU sebelum cleanup!**

4. **`cleanup-leads.ts`** - TypeScript cleanup script (untuk lokal)
   - Hanya bisa jalan jika punya akses DB lokal
   - Alternatif untuk SQL script

### 🎯 Cara Pakai:

```bash
# 1. Baca prosedur lengkap
cat scripts/CLEANUP_PROCEDURE.md

# 2. SSH ke server
ssh user@your-server

# 3. Masuk ke PostgreSQL
docker exec -it postgres-dk0ck4sc0kg4cowgkws4cwog psql -U autolumiku -d autolumiku_prod

# 4. Copy-paste isi analyze-staff-leads.sql
# 5. Review hasilnya dengan teliti
# 6. Jika yakin, lanjut ke cleanup-staff-leads.sql
# 7. Ikuti CLEANUP_PROCEDURE.md step-by-step
```

### ⚠️ PERINGATAN:
- **JANGAN langsung delete tanpa analisis!**
- **SELALU buat backup dulu!**
- **Ikuti CLEANUP_PROCEDURE.md dengan ketat!**

---

## 🗄️ Database Migration

### 📄 File-file Terkait:

1. **`migrate.ts`** - Run Prisma migrations
2. **`seed.ts`** - Seed database dengan data awal

### 🎯 Cara Pakai:

```bash
# Run migration
npm run db:migrate

# Seed database
npm run db:seed
```

---

## 🕷️ Web Scrapers

### 📄 File-file Terkait:

1. **`scrapers/test-mobil123-scraper.ts`** - Scraper untuk Mobil123
2. **`scrapers/test-olx-scraper.ts`** - Scraper untuk OLX
3. **`scrapers/puppeteer-olx-scraper.ts`** - OLX scraper dengan Puppeteer
4. **`scrapers/analyze-results.ts`** - Analisis hasil scraping
5. **`scrapers/run-all-tests.ts`** - Run semua scraper tests

### 🎯 Cara Pakai:

```bash
# Test Mobil123 scraper
npm run scraper:mobil123

# Test OLX scraper
npm run scraper:olx

# Test OLX dengan Puppeteer
npm run scraper:olx-puppeteer

# Analisis hasil
npm run scraper:analyze

# Run semua tests
npm run scraper:test
```

---

## 🌐 Infrastructure

### 📄 File-file Terkait:

1. **`sync-traefik-domains.ts`** - Sync domains ke Traefik
2. **`create-platform-tenant.ts`** - Buat tenant baru untuk platform
3. **`copy-pdfkit-fonts.js`** - Copy fonts untuk PDF generation

### 🎯 Cara Pakai:

```bash
# Sync Traefik domains
npm run traefik:sync

# Create platform tenant
npm run platform:create

# Copy PDFKit fonts (otomatis saat build)
node scripts/copy-pdfkit-fonts.js
```

---

## 📝 Hardcoding Check

### 📄 File-file Terkait:

1. **`check-hardcoding.js`** - Deteksi hardcoded values di code

### 🎯 Cara Pakai:

```bash
npm run lint:hardcode
```

---

## 🛡️ Best Practices

### Sebelum Jalankan Script:

1. ✅ **Baca dokumentasi** script tersebut
2. ✅ **Backup database** jika script memodifikasi data
3. ✅ **Test di staging** jika memungkinkan
4. ✅ **Review code** jika script dari sumber eksternal
5. ✅ **Catat hasil** untuk dokumentasi

### Setelah Jalankan Script:

1. ✅ **Verify hasil** sesuai ekspektasi
2. ✅ **Monitor aplikasi** untuk memastikan tidak ada side effect
3. ✅ **Dokumentasikan** apa yang dilakukan
4. ✅ **Commit changes** jika ada perubahan code

---

## 📞 Need Help?

Jika ada pertanyaan atau masalah:

1. Baca dokumentasi di file terkait
2. Cek `CLEANUP_PROCEDURE.md` untuk prosedur cleanup
3. Review code script untuk memahami apa yang dilakukan
4. Tanya developer/DBA jika masih ragu

---

**Last Updated:** 2026-01-28  
**Maintained by:** Development Team
