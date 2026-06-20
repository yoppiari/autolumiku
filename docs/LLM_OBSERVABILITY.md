# LLM Observability & Eval (Super Admin)

Fitur internal untuk memonitor dan mengevaluasi LLM, terinspirasi `internal.motovax.com/llm/eval`.
Ditambahkan 2026-06-20.

## Komponen

### 1. Monitoring (`/admin/llm/monitoring`)
Mencatat **setiap** panggilan LLM (otomatis, via instrumentasi `ZAIClient`):
- provider, model, fitur (chat/vision/json/blog/eval), sukses/gagal, latency, token (in/out/total), finishReason, error.
- Dashboard: total calls, success rate, avg & p95 latency, total tokens, breakdown per model & per fitur, error terbaru. Auto-refresh 15s.
- Data: tabel `llm_call_logs`. API: `GET /api/v1/admin/llm/monitoring?hours=24`.

### 2. Eval (`/admin/llm/eval`)
Uji perilaku AI dengan skenario + assertion:
- Tipe assertion: `contains`, `not_contains`, `contains_any`, `matches_regex`, `not_matches_regex`, `tool_call` (`mustCall`, `argsMustContain`).
- Jalankan satu skenario atau semua; lihat skor `passedAssertions/totalAssertions` + detail per-assertion + response mentah.
- Data: `llm_eval_scenarios`, `llm_eval_runs`. API:
  - `GET/POST /api/v1/admin/llm/eval/scenarios`
  - `POST /api/v1/admin/llm/eval/run` (`{scenarioId}` | `{all:true}` | `{adhoc:{userPrompt,assertions}}`, opsional `endpointId`)
  - `GET /api/v1/admin/llm/eval/runs`

### 3. Endpoints (`llm_endpoints`)
Kelola beberapa provider LLM (NVIDIA/OpenRouter/DeepSeek/dll) untuk dipakai eval.
API: `GET/POST /api/v1/admin/llm/endpoints` (API key di-mask saat dibaca). Eval bisa target `endpointId` tertentu; default pakai provider aktif di `.env`.

Semua endpoint API dilindungi `withSuperAdminAuth`.

## Contoh skenario eval
```json
{
  "name": "Cek stok harus panggil tool",
  "category": "tooling",
  "userPrompt": "Ada Avanza matic budget 150 juta?",
  "assertions": [
    { "type": "tool_call", "tool": "search_vehicles", "mustCall": true, "description": "harus cari stok via tool" },
    { "type": "not_matches_regex", "value": "\\{\\s*\"", "description": "tidak boleh dump JSON mentah" }
  ]
}
```

## Cara mengaktifkan (migrasi DB)
Model Prisma sudah ditambahkan + file migrasi dibuat di
`prisma/migrations/20260620120000_add_llm_observability/`.

Terapkan ke database:
```bash
npx prisma migrate deploy      # produksi (apply migrasi yang ada)
# atau dev:
npx prisma migrate dev
```
> ⚠️ Belum di-apply ke DB karena perlu akses database. `prisma generate` sudah dijalankan
> sehingga TypeScript mengenal model baru, tapi tabel belum ada sampai migrasi dijalankan.

## Catatan
- Logging bersifat fire-and-forget — kegagalan menulis log tidak pernah menggagalkan panggilan LLM user.
- API key endpoint disimpan plaintext di DB (super-admin only). TODO: enkripsi at-rest.
