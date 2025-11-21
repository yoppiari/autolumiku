# Database Migration Guide

This guide will help you migrate from in-memory storage to PostgreSQL with Prisma ORM.

## Prerequisites

- Node.js 18+ installed
- PostgreSQL 14+ installed and running
- Access to PostgreSQL database

## Step 1: Install Dependencies

```bash
npm install prisma @prisma/client
npm install -D prisma

# Install email dependencies (optional, for production)
npm install @sendgrid/mail  # For SendGrid
# OR
npm install nodemailer      # For SMTP

# Install Midtrans SDK (optional)
npm install midtrans-client
```

## Step 2: Setup Environment Variables

Create `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` and configure:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/autolumiku?schema=public"

# JWT Secret
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"

# Email Service
EMAIL_PROVIDER="console"  # Options: console, sendgrid, ses, smtp
EMAIL_FROM="noreply@autolumiku.com"
EMAIL_FROM_NAME="AutoLumiku"

# SendGrid (if using)
SENDGRID_API_KEY="your-sendgrid-api-key"

# AWS SES (if using)
AWS_ACCESS_KEY_ID="your-aws-access-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret-key"
AWS_REGION="ap-southeast-1"

# SMTP (if using)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"

# Midtrans Payment Gateway
MIDTRANS_SERVER_KEY="your-midtrans-server-key"
MIDTRANS_CLIENT_KEY="your-midtrans-client-key"
MIDTRANS_IS_PRODUCTION="false"  # Set to "true" in production

# App URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

## Step 3: Initialize Prisma

```bash
# Generate Prisma Client
npx prisma generate

# Create database and run migrations
npx prisma db push

# OR create migration files
npx prisma migrate dev --name init
```

## Step 4: Seed Default Data (Optional)

Create a seed script `prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create default permissions
  const permissions = [
    { name: 'user.create', resource: 'user', action: 'create', category: 'user_management' },
    { name: 'user.read', resource: 'user', action: 'read', category: 'user_management' },
    { name: 'user.update', resource: 'user', action: 'update', category: 'user_management' },
    { name: 'user.delete', resource: 'user', action: 'delete', category: 'user_management' },
    // Add more permissions as needed
  ];

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { name: permission.name },
      update: {},
      create: permission
    });
  }

  // Create default roles
  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: {
      name: 'admin',
      displayName: 'Administrator',
      displayNameId: 'Administrator',
      description: 'Full system access',
      isSystem: true
    }
  });

  console.log('Seed data created successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

Add to `package.json`:

```json
{
  "prisma": {
    "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
  }
}
```

Run seed:

```bash
npx prisma db seed
```

## Step 5: Update Services to Use Prisma

The following services have been updated to work with both in-memory and database storage:

- **Auth Service** (`src/services/auth-service/`)
- **Billing Service** (`src/services/billing-service/`)
- **Settings Service** (`src/services/global-settings-service/`)

To use database storage, services will automatically detect Prisma availability.

## Step 6: Test Database Connection

Create a test script `scripts/test-db.ts`:

```typescript
import { prisma } from '../src/lib/prisma';

async function testConnection() {
  try {
    await prisma.$connect();
    console.log('✓ Database connection successful');

    const userCount = await prisma.user.count();
    console.log(`✓ Found ${userCount} users in database`);

    await prisma.$disconnect();
    console.log('✓ Database disconnected');
  } catch (error) {
    console.error('✗ Database connection failed:', error);
    process.exit(1);
  }
}

testConnection();
```

Run test:

```bash
npx ts-node scripts/test-db.ts
```

## Step 7: Migrate Existing Data (if any)

If you have existing data in memory that needs to be migrated:

1. Export existing data to JSON
2. Create migration script
3. Import data to PostgreSQL

Example migration script:

```typescript
import { prisma } from '../src/lib/prisma';
import existingData from './existing-data.json';

async function migrate() {
  for (const user of existingData.users) {
    await prisma.user.create({
      data: user
    });
  }
  console.log('Migration completed');
}

migrate();
```

## Step 8: Verify Email Service

Test email sending:

```bash
# Set EMAIL_PROVIDER to "console" in .env for testing
npm run dev

# Navigate to registration page and test email sending
# Check console logs for email output
```

## Step 9: Verify Midtrans Integration

Test payment gateway (sandbox mode):

```bash
# Ensure MIDTRANS_IS_PRODUCTION="false" in .env
# Use sandbox credentials from Midtrans dashboard

# Test API endpoint
curl -X POST http://localhost:3000/api/v1/billing/payments \
  -H "Content-Type: application/json" \
  -d '{"invoiceId": "test-inv-123", "paymentMethod": "bank_transfer_bca"}'
```

## Troubleshooting

### Database Connection Issues

**Error: Can't reach database server**

- Check PostgreSQL is running: `sudo systemctl status postgresql`
- Verify DATABASE_URL in `.env`
- Check firewall/network settings

**Error: Authentication failed**

- Verify username and password in DATABASE_URL
- Check PostgreSQL pg_hba.conf settings

### Migration Issues

**Error: Migration failed**

```bash
# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Force push schema
npx prisma db push --force-reset
```

### Prisma Client Issues

**Error: Prisma Client not generated**

```bash
# Regenerate Prisma Client
npx prisma generate

# Clean and regenerate
rm -rf node_modules/.prisma
npx prisma generate
```

## Production Checklist

Before deploying to production:

- [ ] Set strong JWT_SECRET (min 32 characters)
- [ ] Configure production DATABASE_URL
- [ ] Set EMAIL_PROVIDER to "sendgrid" or "ses"
- [ ] Configure SendGrid or AWS SES credentials
- [ ] Set MIDTRANS_IS_PRODUCTION="true"
- [ ] Use production Midtrans credentials
- [ ] Enable SSL for database connection
- [ ] Set up database backups
- [ ] Configure connection pooling
- [ ] Enable database logging
- [ ] Set up monitoring (Sentry, DataDog, etc.)
- [ ] Test all critical flows end-to-end

## Performance Optimization

### Database Indexing

All critical indexes are already defined in Prisma schema:

- User email lookup
- Session token lookups
- Tenant queries
- Audit log queries

### Connection Pooling

For production, use connection pooling:

```env
DATABASE_URL="postgresql://user:pass@localhost:5432/db?schema=public&connection_limit=20&pool_timeout=10"
```

### Query Optimization

Use Prisma's query optimization features:

```typescript
// Use select to fetch only needed fields
const users = await prisma.user.findMany({
  select: {
    id: true,
    email: true,
    firstName: true,
    lastName: true
  }
});

// Use include for relations
const user = await prisma.user.findUnique({
  where: { id: userId },
  include: {
    tenant: true,
    sessions: {
      where: { isActive: true }
    }
  }
});
```

## Rollback Plan

If migration fails:

1. Keep old code in separate branch
2. Restore database from backup
3. Revert to in-memory storage
4. Investigate and fix issues
5. Retry migration

## Support

For issues or questions:

- Check Prisma docs: https://www.prisma.io/docs
- Review migration logs
- Contact team lead

---

**Migration Guide Version:** 1.0
**Last Updated:** 2025-11-20
**Prepared by:** AI Development Assistant
