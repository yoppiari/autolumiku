# Troubleshooting AutoLumiku

## Masalah: Halaman Vehicles Kosong & Database Tidak Terkoneksi

### Root Cause
Docker daemon tidak berjalan, sehingga PostgreSQL container tidak bisa start.

### Diagnosis
```bash
# Cek status Docker
systemctl status docker
# Output: inactive (dead) ❌
```

### Solusi

#### Langkah 1: Start Docker Daemon
```bash
# Jalankan dengan sudo
sudo ./start-docker.sh

# ATAU manual:
sudo systemctl start docker

# Verifikasi Docker berjalan
systemctl status docker
# Output: active (running) ✅
```

#### Langkah 2: Start Database Services
```bash
# Setelah Docker berjalan, jalankan dev script
./dev.sh
```

#### Langkah 3: Verifikasi Database
```bash
# Cek container PostgreSQL berjalan
docker ps | grep postgres

# Expected output:
# autolumiku-postgres   postgres:15-alpine   Up X minutes   0.0.0.0:5432->5432/tcp

# Test koneksi database
npx prisma db execute --stdin <<< "SELECT 1;"
```

#### Langkah 4: Cek Data Vehicles
```bash
# Jalankan script check vehicles
npx tsx scripts/check-vehicles.ts
```

---

## Tentang Warning di dev.sh

Warning ini **TIDAK MASALAH** untuk development:

```
WARN[0000] The "ZHIPUAI_API_KEY" variable is not set. Defaulting to a blank string.
WARN[0000] The "SESSION_SECRET" variable is not set. Defaulting to a blank string.
WARN[0000] The "JWT_REFRESH_SECRET" variable is not set. Defaulting to a blank string.
WARN[0000] The "SMTP_PASSWORD" variable is not set. Defaulting to a blank string.
```

**Penjelasan:**
- Warning ini muncul karena `docker-compose.yml` mencari environment variables yang tidak ada di `.env.local`
- Untuk **development lokal**, variabel ini tidak diperlukan karena:
  - `SESSION_SECRET` - Tidak dipakai saat development
  - `JWT_REFRESH_SECRET` - Tidak dipakai saat development
  - `SMTP_PASSWORD` - Email menggunakan mode "console" (log ke terminal)
  - `ZHIPUAI_API_KEY` - Hanya perlu saat menggunakan AI features

**Jika ingin menghilangkan warning**, tambahkan ke `.env.local`:
```bash
# Tambahkan di .env.local
SESSION_SECRET="dev-session-secret-change-in-production"
JWT_REFRESH_SECRET="dev-jwt-refresh-secret-change-in-production"
SMTP_PASSWORD=""
ZHIPUAI_API_KEY=""
```

---

## Kenapa dev.sh Tidak Bisa Jalankan Docker?

Script `dev.sh` **BISA** menjalankan Docker commands, **TAPI** Docker daemon harus sudah berjalan dulu.

```bash
# Baris di dev.sh yang start database:
docker compose up -d postgres redis
```

**Baris ini gagal jika:**
1. ❌ Docker daemon mati (`systemctl status docker` = inactive)
2. ❌ User tidak ada di docker group (sudah OK ✅)
3. ❌ Docker tidak terinstall (sudah OK ✅)

**Solusi:**
- Docker daemon harus di-start dulu dengan `sudo systemctl start docker`
- Setelah itu, `dev.sh` akan bisa menjalankan `docker compose` tanpa masalah

---

## Auto-Start Docker di Boot (Opsional)

Jika ingin Docker otomatis start saat boot:

```bash
sudo systemctl enable docker
```

Setelah itu, Docker akan otomatis berjalan setiap kali komputer nyala.

---

## Quick Checklist

```bash
# ✅ 1. Docker daemon berjalan?
systemctl status docker | grep -i active

# ✅ 2. PostgreSQL container berjalan?
docker ps | grep postgres

# ✅ 3. Database bisa diakses?
npx prisma db execute --stdin <<< "SELECT 1;"

# ✅ 4. Ada data vehicles?
npx tsx scripts/check-vehicles.ts

# ✅ 5. Next.js berjalan?
curl http://localhost:3000/api/health

# ✅ 6. Vehicles API berjalan?
# Ganti TENANT_ID dengan tenant ID yang benar
curl "http://localhost:3000/api/v1/vehicles?tenantId=TENANT_ID"
```

---

## Flow Diagram

```
User runs ./dev.sh
     ↓
Check Docker daemon status
     ↓
  Is running? ──NO──> Error: Cannot connect to Docker daemon
     ↓ YES             (Need to start: sudo systemctl start docker)
     ↓
docker compose up -d postgres redis
     ↓
PostgreSQL container starts
     ↓
Next.js connects to localhost:5432
     ↓
API /api/v1/vehicles queries database
     ↓
Frontend /dashboard/vehicles displays data
```

---

## Langkah-Langkah Lengkap (Copy-Paste)

```bash
# 1. Start Docker daemon
sudo systemctl start docker

# 2. Verifikasi Docker berjalan
systemctl status docker

# 3. Start development environment
./dev.sh

# 4. Di terminal lain, cek vehicles data
npx tsx scripts/check-vehicles.ts

# 5. Buka browser
# http://localhost:3000/dashboard/vehicles
```

---

## Jika Masih Kosong Setelah Docker Berjalan

Kemungkinan penyebabnya:

### 1. localStorage tidak ada tenantId

**UPDATE:** Development mode sekarang **otomatis inject mock user**!

Saat pertama kali buka `/dashboard/*`, sistem akan auto-inject:
```json
{
  "id": "dev-user-123",
  "tenantId": "8dd6398e-b2d2-4724-858f-ef9cfe6cd5ed",
  "name": "Dev User",
  "email": "dev@showroom.com",
  "role": "admin",
  "_isMock": true
}
```

Jika masih kosong, cek browser console (F12) untuk pesan error.

**Manual override (jika diperlukan):**
```javascript
// Cek localStorage
console.log(localStorage.getItem('user'));

// Set manual untuk testing:
localStorage.setItem('user', JSON.stringify({
  tenantId: '8dd6398e-b2d2-4724-858f-ef9cfe6cd5ed',
  id: 'user-id',
  name: 'Test User'
}));

// Refresh page
location.reload();
```

### 2. Database benar-benar kosong
```bash
# Cek apakah ada data
npx tsx scripts/check-vehicles.ts

# Jika kosong, seed data
npx tsx scripts/seed.ts
```

### 3. API error
Buka browser console (F12) dan lihat Network tab untuk error dari API.

---

## Contact

Jika masih ada masalah, berikan informasi berikut:
1. Output dari `systemctl status docker`
2. Output dari `docker ps`
3. Output dari `npx tsx scripts/check-vehicles.ts`
4. Screenshot browser console (F12) di `/dashboard/vehicles`
