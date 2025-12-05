# Development Guide - AutoLumiku

## Quick Start

```bash
# 1. Start Docker daemon
sudo systemctl start docker

# 2. Start development environment
./dev.sh

# 3. Open browser
http://localhost:3000
```

---

## Auto Mock Authentication

Untuk development, sistem otomatis inject mock user authentication saat pertama kali buka `/dashboard/*`.

**Mock User Default:**
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

**Tenant:** Showroom Jakarta Premium

---

## Switch Tenant

Untuk testing dengan tenant berbeda, buka console browser (F12) dan jalankan:

```javascript
// Switch to different tenant
const user = JSON.parse(localStorage.getItem('user'));
user.tenantId = 'NEW_TENANT_ID_HERE';
localStorage.setItem('user', JSON.stringify(user));
location.reload();
```

**Available Tenants:**

| Tenant Name                | Tenant ID                              |
|----------------------------|----------------------------------------|
| Showroom Jakarta Premium   | `8dd6398e-b2d2-4724-858f-ef9cfe6cd5ed` |
| Showroom Elite Jakarta     | `5536722c-78e5-4dcd-9d35-d16858add414` |
| Showroom Mobil Surabaya    | `de43ff80-1bf4-4bc2-8f26-c54db896f6c2` |
| Showroom Mobil Bandung     | `508b3141-31c4-47fb-8473-d5b5ba940ac6` |

---

## Manual Logout & Re-login

```javascript
// Logout
localStorage.removeItem('user');
location.reload();

// System will auto-inject mock user again on reload
```

---

## Environment Variables

File `.env.local` sudah dikonfigurasi untuk development:

```bash
DATABASE_URL="postgresql://autolumiku:changeme@localhost:5432/autolumiku_prod?schema=public"
JWT_SECRET="change-this-to-a-secure-random-string-minimum-32-characters"
NODE_ENV="development"
```

**Warning dari Docker Compose:**
```
WARN[0000] The "SESSION_SECRET" variable is not set
WARN[0000] The "JWT_REFRESH_SECRET" variable is not set
```

**Ini TIDAK MASALAH** untuk development. Variabel ini hanya diperlukan di production.

---

## Database Access

### Via Docker Exec
```bash
# Connect to PostgreSQL
docker exec -it autolumiku-postgres psql -U autolumiku -d autolumiku_prod

# List tables
\dt

# Check vehicles
SELECT * FROM vehicles;

# Check tenants
SELECT id, name, domain, status FROM tenants;
```

### Via Prisma Studio
```bash
npx prisma studio
```

Buka: `http://localhost:5555`

---

## Check Data Scripts

### Check Vehicles
```bash
npx tsx scripts/check-vehicles.ts
```

Output:
```
🔍 Checking vehicles in database...

Found 1 vehicle(s)

📍 Vehicle #1:
   ID: 0e079802-036c-4b77-87ea-aab0f8a9c5b8
   Tenant ID: 8dd6398e-b2d2-4724-858f-ef9cfe6cd5ed
   Make: Honda
   Model: BR-V
   Year: 2022
   Status: DRAFT
   Price: Rp 225 jt
   Photos: 0
   Created: 2025-11-25T06:15:24.966Z
```

### Seed Database (if empty)
```bash
npx tsx scripts/seed.ts
```

---

## API Testing

### Test Vehicles API
```bash
# Replace TENANT_ID with actual tenant ID
curl "http://localhost:3000/api/v1/vehicles?tenantId=8dd6398e-b2d2-4724-858f-ef9cfe6cd5ed"
```

### Test Health Check
```bash
curl http://localhost:3000/api/health
```

---

## Troubleshooting

### Database Connection Issues

**Symptom:** `Cannot connect to database`

**Check:**
```bash
# 1. Docker daemon running?
systemctl status docker

# 2. PostgreSQL container running?
docker ps | grep postgres

# 3. Database accessible?
docker exec autolumiku-postgres pg_isready -U autolumiku
```

**Fix:**
```bash
# Start Docker
sudo systemctl start docker

# Restart containers
docker compose restart postgres
```

### Vehicles Page Empty

**Symptom:** Dashboard shows "Belum ada kendaraan"

**Causes:**
1. No mock user → **AUTO-FIXED** by layout (dev mode only)
2. Wrong tenant ID → Switch tenant (see above)
3. No data → Run seed script

**Check:**
```bash
# 1. Check localStorage
# Open browser console (F12)
console.log(JSON.parse(localStorage.getItem('user')));

# 2. Check database
npx tsx scripts/check-vehicles.ts

# 3. Check API
curl "http://localhost:3000/api/v1/vehicles?tenantId=TENANT_ID"
```

### Redis Port Conflict

**Symptom:** `Bind for 0.0.0.0:6379 failed: port is already allocated`

**Fix:**
```bash
# Stop existing Redis container
docker stop autolumiku-redis
docker rm autolumiku-redis

# Restart
./dev.sh
```

---

## Development Workflow

### 1. Morning Startup
```bash
# Start Docker (if not auto-start)
sudo systemctl start docker

# Start dev environment
./dev.sh
```

### 2. Access Dashboard
```bash
# Browser: http://localhost:3000/dashboard/vehicles
# Mock auth auto-injected ✓
```

### 3. Database Changes
```bash
# Edit prisma/schema.prisma
# Then run:
npx prisma migrate dev --name description_of_change
npx prisma generate
```

### 4. View Logs
```bash
# Next.js logs
tail -f nextjs.log

# PostgreSQL logs
docker logs autolumiku-postgres -f

# Redis logs
docker logs autolumiku-redis -f
```

### 5. End of Day
```bash
# Press Ctrl+C in dev.sh terminal
# Or:
pkill -f "next dev"

# Optional: Stop Docker containers
docker compose stop
```

---

## Tips & Tricks

### Auto-Start Docker on Boot
```bash
sudo systemctl enable docker
```

### Keep Docker Running
Docker containers are configured with `restart: unless-stopped`, so they'll auto-restart if they crash.

### Clear All Data (Fresh Start)
```bash
# Stop all
docker compose down

# Remove volumes (⚠️ DELETES ALL DATA)
docker volume rm autolumiku_postgres_data autolumiku_redis_data

# Start fresh
./dev.sh

# Re-seed
npx tsx scripts/seed.ts
```

### Performance Tips
- PostgreSQL logs are verbose. Reduce logging in production.
- Redis caching helps reduce database load.
- Use Prisma query caching for frequently accessed data.

---

## IDE Setup

### VS Code Extensions (Recommended)
- Prisma
- ESLint
- Prettier
- Tailwind CSS IntelliSense
- Docker

### TypeScript Path Aliases
Already configured in `tsconfig.json`:
```json
{
  "paths": {
    "@/*": ["./src/*"]
  }
}
```

Use: `import { foo } from '@/lib/foo'`

---

## Common Development Tasks

### Add New Table
1. Edit `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name add_new_table`
3. Run `npx prisma generate`

### Update Existing Table
1. Edit `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name update_table_name`

### Reset Database (⚠️ DESTRUCTIVE)
```bash
npx prisma migrate reset
```

This will:
- Drop database
- Create new database
- Run all migrations
- Run seed script

---

## Production Checklist

Before deploying to production:

- [ ] Update all secrets in `.env.local`
- [ ] Set `NODE_ENV=production`
- [ ] Remove mock authentication code
- [ ] Enable real authentication
- [ ] Configure SSL/TLS for database
- [ ] Set up database backups
- [ ] Configure monitoring (Sentry, etc.)
- [ ] Test all API endpoints
- [ ] Run security audit
- [ ] Update CORS settings
- [ ] Configure rate limiting
- [ ] Set up CI/CD pipeline

---

## Need Help?

See `TROUBLESHOOTING.md` for detailed troubleshooting guide.
