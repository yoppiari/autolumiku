/**
 * User Management API
 * GET /api/v1/users - List users with filtering
 * POST /api/v1/users - Create new user
 *
 * Protected: Requires authentication + admin role
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { authenticateRequest, type AuthResult } from '@/lib/auth/middleware';

/**
 * Sync WhatsApp conversations to mark as staff when user is registered
 * Updates existing conversations from this phone to be marked as staff
 */
async function syncConversationsAsStaff(tenantId: string, phone: string, staffName: string): Promise<{ updated: number }> {
  try {
    // Find all conversations with this phone number (with various formats)
    // Phone in conversations might be: 6281234567890@s.whatsapp.net or 6281234567890
    const phonePatterns = [
      phone,                           // 6281234567890
      `${phone}@s.whatsapp.net`,       // 6281234567890@s.whatsapp.net
      `${phone}@lid`,                  // 6281234567890@lid (linked device)
    ];

    // Update all matching conversations to mark as staff
    const result = await prisma.whatsAppConversation.updateMany({
      where: {
        tenantId,
        OR: phonePatterns.map(p => ({
          customerPhone: { startsWith: phone.substring(0, 10) } // Match by phone prefix
        })),
        isStaff: false, // Only update non-staff conversations
      },
      data: {
        isStaff: true,
        conversationType: 'staff',
        customerName: staffName || undefined,
      },
    });

    return { updated: result.count };
  } catch (error) {
    console.error('[syncConversationsAsStaff] Error:', error);
    return { updated: 0 };
  }
}

/**
 * Normalize phone number to consistent format (62xxx)
 * Handles: +62xxx, 62xxx, 0xxx, 08xxx, with spaces/dashes
 */
function normalizePhoneNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;

  // Remove all non-digit characters (spaces, dashes, parentheses, +)
  let digits = phone.replace(/\D/g, '');

  // Convert Indonesian formats to standard 62xxx
  if (digits.startsWith('0')) {
    digits = '62' + digits.substring(1);
  }

  // Handle case where someone enters just 8xxx (missing country code)
  if (digits.startsWith('8') && digits.length >= 9 && digits.length <= 12) {
    digits = '62' + digits;
  }

  // Validate: should be 10-15 digits starting with 62
  if (!digits.startsWith('62') || digits.length < 10 || digits.length > 15) {
    console.warn(`[Users API] Invalid phone format after normalization: ${phone} → ${digits}`);
    return digits; // Return as-is for non-Indonesian numbers
  }

  return digits;
}

export async function GET(request: NextRequest) {
  // Authenticate request
  const auth = await authenticateRequest(request);
  if (!auth.success || !auth.user) {
    return NextResponse.json(
      { error: auth.error || 'Unauthorized' },
      { status: 401 }
    );
  }

  // Check permission - only admin and super_admin can view users
  if (!['admin', 'super_admin', 'manager'].includes(auth.user.role.toLowerCase())) {
    return NextResponse.json(
      { error: 'Forbidden - Admin access required' },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    let tenantId = searchParams.get('tenantId');
    const role = searchParams.get('role');
    const search = searchParams.get('search');

    // Tenant validation: non-super_admin can only access their own tenant
    if (auth.user.role.toLowerCase() !== 'super_admin') {
      // Force tenantId to be the authenticated user's tenant
      if (tenantId && tenantId !== auth.user.tenantId) {
        return NextResponse.json(
          { error: 'Forbidden - Cannot access other tenant data' },
          { status: 403 }
        );
      }
      tenantId = auth.user.tenantId;
    }

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }

    // Build where clause
    const where: any = { tenantId };

    if (role && role !== 'all') {
      where.role = role.toUpperCase();
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Fetch users
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        emailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Get role stats
    const roleStats = await prisma.user.groupBy({
      by: ['role'],
      where: { tenantId },
      _count: true,
    });

    return NextResponse.json({
      success: true,
      data: {
        users,
        stats: {
          total: users.length,
          byRole: roleStats.reduce((acc: any, item) => {
            acc[item.role] = item._count;
            return acc;
          }, {}),
        },
      },
    });
  } catch (error) {
    console.error('Users API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Authenticate request
  const auth = await authenticateRequest(request);
  if (!auth.success || !auth.user) {
    return NextResponse.json(
      { error: auth.error || 'Unauthorized' },
      { status: 401 }
    );
  }

  // Check permission - only admin and super_admin can create users
  if (!['admin', 'super_admin'].includes(auth.user.role.toLowerCase())) {
    return NextResponse.json(
      { error: 'Forbidden - Admin access required to create users' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    let { tenantId, email, firstName, lastName, phone, role } = body;

    // Normalize phone number for consistent format
    const normalizedPhone = normalizePhoneNumber(phone);
    if (phone && normalizedPhone) {
      console.log(`[Users API] Phone normalized: "${phone}" → "${normalizedPhone}"`);
    }

    // Tenant validation: non-super_admin can only create users in their own tenant
    if (auth.user.role.toLowerCase() !== 'super_admin') {
      if (tenantId && tenantId !== auth.user.tenantId) {
        return NextResponse.json(
          { error: 'Forbidden - Cannot create users in other tenant' },
          { status: 403 }
        );
      }
      tenantId = auth.user.tenantId;
    }

    if (!tenantId || !email || !firstName || !role) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Create user with a temporary password
    // In production, you should generate a secure random password or use invitation token
    const user = await prisma.user.create({
      data: {
        tenantId,
        email,
        firstName,
        lastName: lastName || '',
        phone: normalizedPhone,
        role: role.toUpperCase(),
        passwordHash: await bcrypt.hash('temporary_password', 10), // In production: generate random password
        emailVerified: false,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    // Auto-create WhatsApp staff auth if phone is provided
    if (normalizedPhone) {
      await prisma.staffWhatsAppAuth.create({
        data: {
          tenantId,
          userId: user.id,
          phoneNumber: normalizedPhone,
          role: role.toLowerCase(),
          isActive: true,
          canUploadVehicle: true,
          canUpdateStatus: true,
          canViewAnalytics: role.toUpperCase() === 'ADMIN',
          canManageLeads: true,
        },
      });

      // Sync existing WhatsApp conversations - mark as staff
      // This handles conversations that existed before the user was registered
      const syncResult = await syncConversationsAsStaff(tenantId, normalizedPhone, `${firstName} ${lastName || ''}`.trim());
      console.log(`[Users API] Synced ${syncResult.updated} conversations as staff for ${normalizedPhone}`);
    }

    return NextResponse.json({
      success: true,
      data: user,
      message: 'User created successfully',
    });
  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
