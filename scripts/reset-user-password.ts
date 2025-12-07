/**
 * Reset password for a specific user
 * Usage: npx tsx scripts/reset-user-password.ts <email> <new-password>
 */

import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Load environment variables
config();

const prisma = new PrismaClient();

async function resetPassword(email: string, newPassword: string) {
  try {
    console.log(`\n🔐 Resetting password for: ${email}`);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        tenantId: true,
      },
    });

    if (!user) {
      console.error(`❌ User not found: ${email}`);
      process.exit(1);
    }

    console.log(`✓ User found:`);
    console.log(`  - Name: ${user.firstName} ${user.lastName}`);
    console.log(`  - Role: ${user.role}`);
    console.log(`  - Tenant ID: ${user.tenantId}`);

    // Hash new password
    console.log(`\n🔒 Hashing new password...`);
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        failedLoginAttempts: 0, // Reset failed attempts
        lockedUntil: null, // Unlock account
      },
    });

    console.log(`\n✅ Password updated successfully!`);
    console.log(`\nLogin Credentials:`);
    console.log(`Email: ${email}`);
    console.log(`Password: ${newPassword}`);
    console.log(`\n⚠️  IMPORTANT: Save this password securely!\n`);
  } catch (error) {
    console.error('❌ Error resetting password:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Get command line arguments
const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.log(`
Usage: npx tsx scripts/reset-user-password.ts <email> <new-password>

Example:
  npx tsx scripts/reset-user-password.ts admin@primamobil.id "NewSecurePass123!"
  `);
  process.exit(1);
}

resetPassword(email, password);
