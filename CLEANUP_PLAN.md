# Project Cleanup Plan - AutoLumiku
**Tanggal:** 2026-01-29  
**Status:** SAFE CLEANUP - Tidak mengubah fungsi operasional

## 📋 RINGKASAN
Cleanup ini fokus pada:
1. Memindahkan file testing ke folder yang tepat
2. Menghapus file temporary yang tidak diperlukan
3. Merapikan dokumentasi
4. **TIDAK mengubah** kode production atau import path

---

## ✅ FILES YANG AMAN UNTUK DIPINDAH/DIHAPUS

### 1. Test Files (Pindah ke `scripts/tests/`)
```
✓ scripts/test-report-classifier.ts → scripts/tests/report-classifier.test.ts
✓ scripts/test-report-logic.ts → scripts/tests/report-logic.test.ts
```

**Alasan:** File ini adalah testing temporary yang dibuat untuk verifikasi bug fix.  
**Action:** Pindah ke folder tests dengan rename pattern `.test.ts`

### 2. Build Artifacts (Ignore saja, sudah ada di .gitignore)
```
- .next/ (Next.js build cache)
- node_modules/ (Dependencies)
- tsconfig.tsbuildinfo (TypeScript build info)
```

**Action:** Tidak perlu disentuh, sudah di-ignore oleh Git.

---

## 🔒 FILES YANG TIDAK BOLEH DIUBAH

### Production Code
```
✗ src/lib/services/whatsapp-ai/** (Active production service)
✗ src/app/api/** (API routes yang running)
✗ prisma/schema.prisma (Database schema)
✗ .env, .env.local (Environment variables)
```

**Reason:** Sistem operasional sudah berjalan, perubahan bisa break production.

---

## 📁 STRUKTUR FOLDER YANG DIREKOMENDASIKAN

### Current (Before Cleanup)
```
scripts/
├── test-report-classifier.ts ❌ (di root scripts)
├── test-report-logic.ts ❌ (di root scripts)
├── tests/ ✓ (folder exists)
├── database/
├── maintenance/
└── ...
```

### Recommended (After Cleanup)
```
scripts/
├── tests/
│   ├── report-classifier.test.ts ✓ (moved)
│   ├── report-logic.test.ts ✓ (moved)
│   └── ... (existing tests)
├── database/
├── maintenance/
└── ...
```

---

## 🚀 EXECUTION PLAN

### Step 1: Pindah Test Files
```bash
# Safe move (tidak mengubah functionality)
mv scripts/test-report-classifier.ts scripts/tests/report-classifier.test.ts
mv scripts/test-report-logic.ts scripts/tests/report-logic.test.ts
```

### Step 2: Verify Git Status
```bash
git status
# Check tidak ada file production yang berubah
```

### Step 3: Update .gitignore (Optional)
Pastikan pattern berikut ada:
```
.next/
node_modules/
*.tsbuildinfo
uploads/*
!uploads/.gitkeep
```

---

## ⚠️ CRITICAL RULES

1. **JANGAN hapus file di `src/`** - semua kode production
2. **JANGAN ubah import path** - bisa break runtime
3. **JANGAN hapus `.env` files** - berisi credentials
4. **JANGAN hapus `prisma/`** - database schema aktif
5. **HANYA pindah test files** yang jelas temporary

---

## ✓ CHECKLIST SEBELUM EXECUTE

- [ ] Backup database sudah ada
- [ ] Tidak ada perubahan di `src/lib/services/whatsapp-ai/`
- [ ] Tidak ada perubahan di `src/app/api/`
- [ ] File yang dipindah HANYA test files
- [ ] Test setelah cleanup: `npm run dev` masih berjalan

---

## 📊 IMPACT ASSESSMENT

| Action | Files Affected | Risk Level | Impact |
|--------|---------------|------------|---------|
| Move test files | 2 files | 🟢 LOW | No production impact |
| Build artifacts | 0 (ignore) | 🟢 NONE | Already gitignored |
| Docs update | README.md | 🟢 LOW | Documentation only |

---

## 🎯 EXPECTED RESULT

After cleanup:
- ✅ Test files organized in proper folder
- ✅ Scripts folder more structured
- ✅ No impact on production operations
- ✅ Git history clean
- ✅ All services still running normally
