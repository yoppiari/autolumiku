import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as bcrypt from 'bcryptjs';

/**
 * Bootstrap Super Admin User
 * One-time endpoint to create super admin if not exists
 * DELETE this file after use for security
 */
export async function POST(request: NextRequest) {
  try {
    // Check if super admin already exists
    const existing = await prisma.user.findFirst({
      where: { role: 'super_admin' },
    });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          message: 'Super admin already exists',
          email: existing.email,
        },
        { status: 400 }
      );
    }

    // Create super admin
    const passwordHash = await bcrypt.hash('admin123', 10);

    const superAdmin = await prisma.user.create({
      data: {
        email: 'admin@autolumiku.com',
        passwordHash,
        firstName: 'Super',
        lastName: 'Admin',
        phone: '+62-800-000-0000',
        role: 'super_admin',
        tenantId: null,
        emailVerified: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Super admin created successfully!',
      data: {
        email: superAdmin.email,
        password: 'admin123',
        loginUrl: '/admin/login',
      },
    });
  } catch (error: any) {
    console.error('Error creating super admin:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to create super admin',
        error: error.message,
      },
      { status: 500 }
    );
  }
}
