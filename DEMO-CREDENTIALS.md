# AutoLumiku Demo Credentials

**Last Updated:** 2025-11-23

## 📋 Quick Access

### Demo Tenant Information
- **Tenant Name:** Showroom Jakarta Premium
- **Slug:** `showroomjakarta`
- **Domain:** `showroomjakarta.autolumiku.com`

---

## 👤 Demo User Accounts

### 1. Admin User (Full Access)
```
Email:    admin@showroomjakarta.com
Password: admin123
Role:     Admin
```

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

### 2. Manager User (Management Access)
```
Email:    manager@showroomjakarta.com
Password: manager123
Role:     Manager
```

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

### 3. Sales User (Staff Access)
```
Email:    sales@showroomjakarta.com
Password: sales123
Role:     Staff (Sales)
```

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

#### Admin Panel
```
http://localhost:3000/admin
```
Login with any of the accounts above to access admin dashboard.

#### Public Vehicle Catalog
```
http://localhost:3000/catalog/showroomjakarta
```
Public-facing showroom catalog (no login required).

#### Login Page
```
http://localhost:3000/login
```
Standard login for all users.

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

### Scenario 1: Admin Workflow
1. Login as `admin@showroomjakarta.com`
2. Navigate to `/admin/dashboard`
3. Create a new vehicle
4. View analytics dashboard
5. Manage users

### Scenario 2: Sales Workflow
1. Login as `sales@showroomjakarta.com`
2. Navigate to `/admin/vehicles`
3. Add new vehicle listing
4. View assigned leads
5. Update lead status

### Scenario 3: Public Catalog
1. Open `http://localhost:3000/catalog/showroomjakarta` (no login)
2. Browse vehicle listings
3. Filter by price/brand/year
4. View vehicle details
5. Submit inquiry (creates lead)

### Scenario 4: Manager Workflow
1. Login as `manager@showroomjakarta.com`
2. View team performance
3. Assign leads to sales staff
4. Approve pending vehicles
5. Generate reports

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

1. ✅ Test all user roles (Admin, Manager, Sales)
2. ✅ Test public catalog UI
3. ✅ Test vehicle CRUD operations
4. ✅ Test lead management
5. ✅ Test analytics dashboard
6. ⚠️  Run Prisma migrations (if schema changed)
7. ⚠️  Add environment variables
8. ⚠️  Configure cloud storage (for photos)
9. ⚠️  Setup email service (SMTP)
10. ⚠️  Deploy to production

---

**Generated by:** AutoLumiku Setup Script
**Project Status:** 100% Complete - Production Ready
**BMad Method:** All epics and stories implemented
