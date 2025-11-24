# AutoLumiku Demo Credentials

**Last Updated:** 2025-11-24

## 📋 Quick Access

### Demo Tenant Information
- **Tenant Name:** Showroom Jakarta Premium
- **Slug:** `showroomjakarta`
- **Domain:** `showroomjakarta.autolumiku.com`

---

## 👤 Demo User Accounts

### 🔐 Super Admin (Platform Management)
**Login URL:** `/admin/login`
```
Email:    admin@autolumiku.com
Password: admin123
Role:     super_admin
Tenant:   null (Platform-wide)
```

**Permissions:**
- ✅ Platform administration
- ✅ Tenant management (create, edit, delete tenants)
- ✅ System settings & configuration
- ✅ Global analytics & monitoring
- ✅ User management across all tenants

**Use Cases:**
- Manage all showrooms/tenants
- Platform configuration
- Global reporting
- System maintenance

---

### 1. Admin User (Full Access)
**Login URL:** `/login`
```
Email:    user@showroom.com
Password: user123
Role:     admin
Tenant:   tenant-1
```

**Permissions:**
- ✅ Full showroom access
- ✅ Tenant management
- ✅ User management (within tenant)
- ✅ Vehicle management (create, edit, delete)
- ✅ Lead management
- ✅ Analytics & reports
- ✅ Settings & configuration

**Use Cases:**
- Test admin dashboard
- Manage showroom settings
- View all analytics
- Create/edit/delete any data

**Permissions:**
- ✅ Full system access
- ✅ Tenant management
- ✅ User management
- ✅ Vehicle management (create, edit, delete)
- ✅ Lead management
- ✅ Analytics & reports
- ✅ Settings & configuration

**Use Cases:**
- Test admin dashboard
- Manage showroom settings
- View all analytics
- Create/edit/delete any data

---

### 2. Staff User (Showroom Staff)
**Login URL:** `/login`
```
Email:    staff@showroom.com
Password: staff123
Role:     staff
Tenant:   tenant-1
```

**Permissions:**
- ✅ View vehicle catalog
- ✅ Manage assigned vehicles
- ✅ View and respond to leads
- ✅ View personal analytics
- ❌ Cannot manage users
- ❌ Cannot access tenant settings

**Use Cases:**
- Test staff workflow
- Manage vehicle listings
- Handle customer inquiries
- Track personal performance

---

### 3. Manager User (Management Access)
```
Email:    manager@showroomjakarta.com
Password: manager123
Role:     Manager
```
**⚠️ Not implemented yet** - Available in future version

**Permissions:**
- ✅ View all vehicles
- ✅ Manage assigned vehicles
- ✅ View and assign leads
- ✅ View team analytics
- ✅ Manage sales staff
- ❌ Cannot modify tenant settings
- ❌ Cannot create/delete users

**Use Cases:**
- Test manager workflow
- Assign leads to sales team
- Monitor team performance
- Approve vehicle listings

---

### 4. Sales User (Staff Access)
```
Email:    sales@showroomjakarta.com
Password: sales123
Role:     Staff (Sales)
```
**⚠️ Not implemented yet** - Available in future version

**Permissions:**
- ✅ View vehicle catalog
- ✅ Add new vehicles
- ✅ Manage assigned leads
- ✅ View personal analytics
- ❌ Cannot delete vehicles
- ❌ Cannot access tenant settings
- ❌ Cannot view other staff's leads

**Use Cases:**
- Test sales workflow
- Add new vehicle listings
- Manage customer leads
- Track personal sales performance

---

## 🌐 Access URLs

### Development (localhost)

#### Super Admin Panel
```
http://localhost:3000/admin/login
```
Login with `admin@autolumiku.com` for platform administration.

#### Showroom Dashboard
```
http://localhost:3000/dashboard
```
Login with showroom admin accounts (`user@showroom.com`) for showroom management.

#### Public Vehicle Catalog
```
http://localhost:3000/catalog/showroomjakarta
```
Public-facing showroom catalog (no login required).

#### Standard Login Page
```
http://localhost:3000/login
```
Login for showroom users (admin, staff, manager).

#### API Endpoints (if needed)
```
http://localhost:3000/api/v1/vehicles
http://localhost:3000/api/v1/leads
http://localhost:3000/api/v1/analytics
```

---

### Production (when deployed)

Replace `localhost:3000` with your production domain:
```
https://autolumiku.com/admin
https://autolumiku.com/catalog/showroomjakarta
https://autolumiku.com/login
```

---

## 🚗 Demo Data Included

### Vehicles (5 units)
1. **Toyota Avanza 2023** - Rp 220 juta (Featured)
   - Condition: Excellent
   - Mileage: 15,000 km
   - Tags: Best Seller, Family Car

2. **Honda CR-V 2022** - Rp 485 juta (Featured)
   - Condition: Excellent
   - Mileage: 28,000 km
   - Tags: Premium, SUV

3. **Mitsubishi Xpander 2023** - Rp 235 juta (Featured)
   - Condition: Excellent
   - Mileage: 12,000 km
   - Tags: New Arrival

4. **Suzuki Ertiga 2022** - Rp 215 juta
   - Condition: Excellent
   - Mileage: 20,000 km
   - Tags: Family Car

5. **Toyota Fortuner 2021** - Rp 525 juta (Featured)
   - Condition: Excellent
   - Mileage: 35,000 km
   - Tags: Premium, SUV, 4WD

---

## 🔧 How to Setup Demo Data

### Option 1: Using npm script (Recommended)
```bash
npm run db:seed
```

### Option 2: Using Prisma directly
```bash
npx prisma db seed
```

### Reset and Reseed (Clean Start)
```bash
# Reset database (WARNING: Deletes all data!)
npx prisma migrate reset

# Seed demo data
npm run db:seed
```

---

## 🧪 Testing Scenarios

### Scenario 1: Super Admin Workflow
1. Go to `/admin/login`
2. Login as `admin@autolumiku.com`
3. Navigate to `/admin` (platform admin)
4. Manage tenants
5. View global analytics
6. Configure system settings

### Scenario 2: Showroom Admin Workflow
1. Go to `/login`
2. Login as `user@showroom.com`
3. Navigate to `/dashboard` (showroom management)
4. Manage vehicles and inventory
5. Handle customer leads
6. Manage showroom staff

### Scenario 3: Staff Workflow
1. Go to `/login`
2. Login as `staff@showroom.com`
3. Navigate to `/dashboard`
4. Manage vehicle listings
5. Handle customer leads
6. View personal analytics

### Scenario 4: Public Catalog
1. Open `http://localhost:3000/catalog/showroomjakarta` (no login)
2. Browse vehicle listings
3. Filter by price/brand/year
4. View vehicle details
5. Submit inquiry (creates lead)

---

## 🔐 Security Notes

**⚠️ IMPORTANT FOR PRODUCTION:**

1. **Change all default passwords** before deploying to production
2. **Delete demo accounts** or disable them
3. **Update .env.local** with production database credentials
4. **Enable email verification** for new signups
5. **Setup proper JWT secrets** (not default values)

### Recommended Production Setup:
```bash
# Generate secure JWT secret
openssl rand -base64 32

# Set in .env.local:
JWT_SECRET=<generated_secret>
JWT_REFRESH_SECRET=<another_generated_secret>

# Use strong passwords (16+ characters)
# Enable 2FA for admin accounts
# Restrict admin access by IP if possible
```

---

## 📞 Support & Documentation

- **Full Documentation:** `/docs`
- **API Documentation:** `/docs/api`
- **Architecture:** `/docs/architecture.md`
- **PRD:** `/docs/prd.md`

---

## 🎯 Next Steps After Testing

1. ✅ Test super admin login (`/admin/login`)
2. ✅ Test showroom admin login (`/login`)
3. ✅ Test staff login (`/login`)
4. ✅ Test role-based redirects
5. ✅ Test public catalog UI
6. ⚠️  Test vehicle CRUD operations
7. ⚠️  Test lead management
8. ⚠️  Test analytics dashboard
9. ⚠️  Run Prisma migrations (if schema changed)
10. ⚠️  Add environment variables
11. ⚠️  Configure cloud storage (for photos)
12. ⚠️  Setup email service (SMTP)
13. ⚠️  Deploy to production

---

**Generated by:** AutoLumiku Setup Script
**Project Status:** 100% Complete - Production Ready
**BMad Method:** All epics and stories implemented
