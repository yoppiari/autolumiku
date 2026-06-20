# AutoLumiKu → Setara MotoVax/Hoomano: Gap Analysis & Roadmap

**Dibuat:** 2026-06-20
**Tujuan:** Membawa AutoLumiKu ke tingkat kecanggihan & kestabilan setara MotoVax (Hoomano), dengan rencana bertahap berprioritas — **security → stabilitas → kecanggihan**.
**Status saat ini:** Production readiness 56/100 (per `docs/LESSONS_LEARNED.md`).

> Catatan keputusan: Audit ini mengasumsikan AutoLumiKu **tetap di stack Next.js/Prisma** dan mengadopsi *pola* terbaik MotoVax (bukan rewrite ke Encore.go). Rewrite penuh = praktis project baru (berbulan-bulan) dan tidak direkomendasikan kecuali ada alasan bisnis kuat. Lihat bagian "Kenapa bukan rewrite".

---

## 1. Perbandingan Arsitektur (fakta dari kode)

| Aspek | AutoLumiKu (sekarang) | MotoVax/Hoomano | Gap |
|---|---|---|---|
| Backend | Next.js 14 API routes (TS), monolit | Encore.go (Go 1.26), ~20 service modular | Sedang (pola, bukan bahasa) |
| WhatsApp brain | **Regex intent-classifier** (`intent-classifier.service.ts`, 947 baris) + monolit `chat.service.ts` (3.950 baris) | **LLM-first + ~40 tools** (`agent_tools.go`, `tool_choice=required`) | **BESAR** |
| Sesi WA | Gateway eksternal `aimeow` (Go) + webhook | Whatsmeow native, **SQLite per-tenant** (`/data/whatsapp/<tenant>/`) | Sedang |
| Testing | **Dinonaktifkan** (`"test": exit 0`) | Ratusan `_test.go` + **eval scenarios** + `quality_eval` (regresi LLM) | **BESAR** |
| Keamanan | 56/100; mock auth, 13 admin route tanpa auth, no rate-limit, no input-validation konsisten | Commit khusus tutup IDOR lintas-tenant, SSRF, fail-open auth | **BESAR (P0)** |
| Isolasi tenant | Header + query manual (rawan IDOR) | Row-level `tenant_id` + `tenant_scope`/`tenant_feature_gate` | **BESAR** |
| Guardrail dev | CLAUDE.md (umum) | AGENTS.md ketat: anti-fallback, anti-heuristik, DB-safety, cache event-driven | Sedang |
| Prisma/DB | PrismaClient diduplikasi di 7 file | Pool tunggal terkelola | Kecil-Sedang |

**Inti perbedaan filosofi (yang bikin MotoVax terasa "canggih & stabil"):**
1. **WhatsApp = agent LLM dengan tools**, bukan if/else + regex. AGENTS.md MotoVax bahkan **melarang** regex/keyword/substring intent-detection di depan LLM.
2. **Test & eval benar-benar jalan** → perubahan tidak diam-diam merusak (terutama perilaku AI).
3. **Keamanan multi-tenant dijahit rapi sejak awal**, bukan ditunda.
4. **Caches event-driven** (invalidasi di write-path), bukan TTL.

---

## 2. Temuan kritis di AutoLumiKu (grounded)

### 2.1 Security (P0 — blocking)
- **Mock authentication** masih aktif di jalur auth.
- **13 admin route tanpa proteksi auth** (mis. ditemukan `src/app/api/admin/tenants/[id]/upload/route.ts` tanpa cek auth).
- **Tidak ada rate limiting** di endpoint publik/auth.
- **Validasi input tidak konsisten** walau CLAUDE.md mewajibkan Zod.
- **Secret pernah ter-expose** via `next.config.js` (cek ulang).
- **Default passwords** & **bootstrap super-admin** endpoint perlu diaudit.
- **Isolasi tenant lemah**: mapping domain hardcoded di `middleware.ts:51`, tenant ditentukan via header yang bisa dipalsukan jika tidak diverifikasi ulang di server.

### 2.2 Stabilitas
- **Testing mati total** → tidak ada jaring pengaman.
- **File monolit raksasa**: `chat.service.ts` 3.950 baris, `message-orchestrator.service.ts` 3.094, `staff-command.service.ts` 2.412. Sulit dirawat, rawan regresi.
- **PrismaClient duplikat** di 7 service (kontensi koneksi).
- **Cache TTL** untuk data staff (`STAFF_CACHE_TTL` 5 menit) → data basi; MotoVax pakai event-driven.

### 2.3 Kecanggihan (WhatsApp AI)
- Otak WA berbasis **klasifikasi intent enum + regex** (`MessageIntent` 20+ nilai, `STAFF_COMMAND_PATTERNS`). Rapuh terhadap variasi bahasa.
- Tidak ada **function-calling/tools** terstruktur → AI tak bisa "bertindak" secara general; tiap aksi harus dipetakan manual.
- Tidak ada **eval/regression** untuk perilaku AI → mudah berhalusinasi / berubah perilaku diam-diam.

---

## 3. Roadmap Bertahap (berprioritas)

Prinsip: **jangan kejar kecanggihan sebelum aman & stabil.** Tiap fase punya *exit criteria* yang terukur.

### FASE 0 — Keamanan (P0) · ~3–5 hari · WAJIB DULU
Target: tutup semua blocker yang bikin tidak aman dipakai produksi.

> **Progress 2026-06-20:** Audit auth selesai — admin routes mayoritas sudah pakai guard;
> permukaan utama ada di `api/v1` (67/93 route tanpa guard). **Sudah dikunci ke super-admin**
> 15 endpoint berbahaya yang sebelumnya tanpa auth & memutasi/membocorkan data:
> `admin/fix-subscriptions`, `setup/{fix-whatsapp,fix-blog-images,reprocess-plates,register-staff-phone}`,
> `maintenance/fix-photo-urls`, `vehicles/update-ids`, `debug`,
> `whatsapp-ai/{reset-data,delete-tenant-conversations,force-disconnect,debug-staff,debug-webhook,list-tenants}`,
> dan `admin/tenants/[id]/upload`. Helper baru: `requireSuperAdmin()` / `requireAuth()` di `src/lib/auth/middleware.ts`.
>
> **Update lanjutan (sesi sama):** Auth-guard coverage `api/v1` **tuntas**. Dari 67 route tanpa guard → tersisa **13 yang memang publik by-design**. Yang dikunci:
> - **+26** endpoint manajemen `whatsapp-ai/*` → `requireAuth` (dashboard-only).
> - **+8** endpoint dashboard (`dashboard/*`, `leads/[id]`, `message-templates*`, `tenants/[id]*`) → `requireAuth`.
> - **+6** blog & catalog → `requireAuth` **per-method** (GET tetap publik untuk render katalog/blog; POST/PUT/DELETE dikunci).
> - Total sesi ini: **55 file** di-guard, 0 error TypeScript baru (tetap 88), diverifikasi `tsc`.
>
> **Sisa FASE 0 (bukan auth-guard):**
> - 13 route publik by-design: webhook (`aimeow/webhook`, `webhooks/aimeow`) → **verifikasi signature**; `auth/*` & `leads/track` → **rate limiting** (Redis); `health`, `system/health`, `popular-vehicles/search` → biarkan publik.
> - **Tenant-scoping / anti-IDOR**: `requireAuth` baru memastikan *terautentikasi*, belum memastikan user hanya akses tenant-nya sendiri. Endpoint yang terima `tenantId`/`[id]` perlu cek `auth.user.tenantId` cocok (kecuali super-admin).
> - Verifikasi tenant di server (jangan percaya header `x-tenant-slug` mentah).

1. Hapus mock auth; pastikan semua jalur auth pakai JWT asli + bcrypt.
2. Tambah **auth guard wajib** di semua `src/app/api/admin/**` dan `src/app/api/v1/**` yang sensitif (audit satu per satu; mulai dari 13 route tak terproteksi).
3. **Verifikasi tenant di server** — jangan percaya header `x-tenant-slug` mentah; resolusikan & cek kepemilikan resource (anti-IDOR lintas tenant).
4. Tambah **rate limiting** (Redis) di auth & endpoint publik.
5. Terapkan **validasi Zod konsisten** di semua route handler (body, query, params).
6. Hapus default password & amankan endpoint bootstrap.
7. Pindahkan mapping domain dari hardcode `middleware.ts` ke DB/env.

**Exit:** Production readiness ≥ 80/100; checklist P0 di `DEPLOYMENT_CHECKLIST.md` hijau.

### FASE 1 — Stabilitas & fondasi · ~1–2 minggu
1. **Hidupkan testing** kembali (`package.json` test → jest jalan). Mulai dari unit test service kritis + integration test auth/tenant-isolation.
2. **Prisma singleton tunggal** — hapus 7 duplikasi `new PrismaClient()`.
3. **Pecah file monolit**: `chat.service.ts` & `orchestrator` jadi modul kecil (single-responsibility), sebagai prasyarat refactor WA.
4. **Cache event-driven**: ganti `STAFF_CACHE_TTL` dengan invalidasi di write-path (saat staff ditambah/dihapus). Adopsi guardrail cache MotoVax.
5. **Adopsi guardrail dev** ala AGENTS.md MotoVax ke CLAUDE.md (anti-fallback, anti-heuristik di codepath WA, DB-safety: hanya migrasi aditif).
6. CI sederhana: lint + typecheck + test wajib hijau sebelum deploy.

**Exit:** Test suite hijau & jadi gate; tidak ada `new PrismaClient()` liar; file WA < ~500 baris/modul.

### FASE 2 — WhatsApp AI LLM-first (kecanggihan inti) · ~2–4 minggu
Ini lompatan terbesar menuju "rasa MotoVax".
1. **Definisikan tool/function-calling** (Z.AI/OpenAI-compatible) untuk aksi: `query_vehicles`, `get_vehicle_detail`, `send_photo`, `finance_simulation`, `create_lead`, `check_inventory` (staff), `upload_vehicle` (staff), `handoff_to_admin`, dst. Contoh: `agent_tools.go` MotoVax (~40 tool).
2. **Ganti intent-classifier regex → routing oleh LLM** dengan `tool_choice=required`. Buang `STAFF_COMMAND_PATTERNS` sebagai *control mechanism* (boleh tetap ada sebagai shortcut hanya jika user minta).
3. **RBAC pada tool** — staff/owner/customer dapat set tool berbeda (`tool_access` ala MotoVax).
4. **Anti-halusinasi**: hasil tool jadi *context* untuk LLM, fakta selalu dari DB (sudah ada arah ini di commit `cbd312a`).
5. **Eval harness**: kumpulan skenario percakapan + assertion (mis. "tidak buang JSON mentah", "konfirmasi nama", "grounding harga"). Tiru pola `eval_scenarios_*.sql` + `quality_eval` MotoVax.

**Exit:** Jalur WA utama bebas regex-routing; eval suite jalan & jadi gate; perilaku AI terukur.

### FASE 3 — Penyempurnaan lanjutan · berkelanjutan
- Sesi WA lebih tahan banting (pertimbangkan storage sesi terisolasi per tenant bila pindah dari aimeow).
- Observability: logging terstruktur (winston sudah ada), metrik, health per-subsistem.
- Modularisasi service besar lain (analytics, sales) bila perlu.
- Feature gating per-tenant (`tenant_feature_gate`).

---

## 4. Kenapa bukan rewrite ke Encore.go?
- AutoLumiKu sudah punya **40+ model Prisma**, ~42k baris TS, fitur luas (katalog, scraper, blog AI, sales/finance, analytics). Rewrite = buang semua itu.
- 80% manfaat "stabil & canggih" MotoVax berasal dari **pola** (LLM-first WA, testing/eval, security tenant, cache event-driven) yang **bisa diadopsi di Next.js**.
- Rewrite hanya masuk akal jika: butuh skala/performa Go, tim sudah Go-first, atau ingin menyatukan dengan MotoVax. Itu keputusan bisnis, bukan teknis murni.

---

## 5. Rekomendasi langkah pertama
Mulai **FASE 0** sekarang — saya bisa langsung:
1. Audit & daftar tepat ke-13 admin route tanpa auth + tambah guard, atau
2. Buat lapisan validasi Zod + rate-limit reusable, atau
3. Petakan desain tool/function-calling WA (FASE 2) sebagai blueprint.

Sebutkan mana yang didahulukan.
</content>
</invoke>
