# ✅ Autolumiku Trial Verification Checklist (v5.2)

Panduan ini dibuat untuk memastikan semua perbaikan dan fitur berjalan normal sebelum diserahkan sepenuhnya. Silakan centang poin-poin berikut saat melakukan pengujian.

## 🤖 1. WhatsApp AI Bot (Customer Flow)

### A. Pengenalan Unit & Detail
- [ ] **Test ID Baku**: Ketik `info PM-PST-002` (atau ID valid lainnya).
  - *Ekspektasi*: Bot memberikan detail lengkap (Spec, Harga, **Interior & Eksterior QA**, **Status Dokumen**).
- [ ] **Test ID Variatif**: Ketik `kondisi PM=PST=002` atau `PM PST 002`.
  - *Ekspektasi*: Bot tetap bisa membaca ID tersebut dan memberikan detail yang benar.
- [ ] **Test Request Foto**: Ketik `minta foto PM-PST-002`.
  - *Ekspektasi*: Bot mengirimkan gambar mobil (jika ada).
- [ ] **Test ID Salah**: Ketik `info PM-PST-999` (ID ngawur).
  - *Ekspektasi*: Bot membalas `❌ UNIT TIDAK DITEMUKAN` (bukan data contoh).

### B. Simulasi Kredit (KKB)
- [ ] **Simulasi Normal**: Ketik `kkb PM-PST-002`.
  - *Ekspektasi*: Muncul rincian TDP, Angsuran, dan **Link Leasing Resmi** (BCA/Adira/dll).
- [ ] **Tanya Syarat**: Ketik `syarat kkb`.
  - *Ekspektasi*: Bot menjelaskan syarat dokumen (KTP, KK, PBB, dll).

### C. Percakapan Umum
- [ ] **Greeting**: Ketik `halo` atau `selamat pagi`.
- [ ] **Tanya Alamat**: Ketik `lokasi dimana?`.

---

## 👨‍💼 2. Staff Tools (WhatsApp)

### A. Upload Unit
- [ ] **Start Upload**: Ketik `/upload` atau menu staff.
- [ ] **Proses Data**: Ikuti alur input data (Merk, Model, Tahun, Harga).
- [ ] **Upload Foto**: Kirim gambar mobil saat diminta.
- [ ] **Konfirmasi**: Pastikan unit berhasil tersimpan dan muncul di Dashboard Admin.

---

## 👑 3. Admin & Owner Dashboard (Web)

### A. Akses (Role Based Access)
- [ ] **Login Admin**: Login sebagai user dengan role 'ADMIN'.
- [ ] **Buka Halaman Vital**: Akses menu `Users`, `Finance`, atau `Settings`.
  - *Ekspektasi*: Halaman terbuka lancar, **TIDAK ADA** pesan "Access Denied".
- [ ] **Audit Trail**: Cek history aktivitas, pastikan nama user tercatat benar.

---

## 🛠️ 4. Technical Health Check
- [ ] Cek status server (via `/health` endpoint jika ada).
- [ ] Pastikan tidak ada error 500 saat navigasi menu.

---

**Catatan:** Jika ada satu saja poin di atas yang gagal, segera laporkan detail errornya (screenshot/pesan error).
