/**
 * User Management API - Single User Operations
 * GET /api/v1/users/[id] - Get user by ID
 * PUT /api/v1/users/[id] - Update user
 * DELETE /api/v1/users/[id] - Delete user
 *
 * Protected: Requires authentication + admin role
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth/middleware';

/**
 * Sync WhatsApp conversations to mark as staff when user phone is updated
 */
async function syncConversationsAsStaff(tenantId: string, phone: string, staffName: string): Promise<{ updated: number }> {
  try {
    // Update all matching conversations to mark as staff
    const result = await prisma.whatsAppConversation.updateMany({
      where: {
        tenantId,
        customerPhone: { startsWith: phone.substring(0, 10) },
        isStaff: false,
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Authenticate request
  const auth = await authenticateRequest(request);
  if (!auth.success || !auth.user) {
    return NextResponse.json(
      { error: auth.error || 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        tenantId: true,
        emailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Tenant validation: non-super_admin can only view users from their own tenant
    if (auth.user.role.toLowerCase() !== 'super_admin' && user.tenantId !== auth.user.tenantId) {
      return NextResponse.json(
        { error: 'Forbidden - Cannot access users from other tenant' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Authenticate request
  const auth = await authenticateRequest(request);
  if (!auth.success || !auth.user) {
    return NextResponse.json(
      { error: auth.error || 'Unauthorized' },
      { status: 401 }
    );
  }

  // Check permission - only admin and super_admin can update users
  if (!['admin', 'super_admin'].includes(auth.user.role.toLowerCase())) {
    return NextResponse.json(
      { error: 'Forbidden - Admin access required to update users' },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { firstName, lastName, phone, role } = body;

    // Normalize phone number for consistent format
    const normalizedPhone = normalizePhoneNumber(phone);
    if (phone && normalizedPhone) {
      console.log(`[Users API] Phone normalized: "${phone}" → "${normalizedPhone}"`);
    }

    if (!firstName || !role) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get current user to check tenantId
    const currentUser = await prisma.user.findUnique({
      where: { id },
      select: { tenantId: true, phone: true },
    });

    if (!currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Tenant validation: non-super_admin can only update users from their own tenant
    if (auth.user.role.toLowerCase() !== 'super_admin' && currentUser.tenantId !== auth.user.tenantId) {
      return NextResponse.json(
        { error: 'Forbidden - Cannot update users from other tenant' },
        { status: 403 }
      );
    }

    // Update user
    const user = await prisma.user.update({
      where: { id },
      data: {
        firstName,
        lastName: lastName || '',
        phone: normalizedPhone,
        role: role.toUpperCase(),
      },
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
    });

    // Sync with WhatsApp staff auth
    const existingStaffAuth = await prisma.staffWhatsAppAuth.findFirst({
      where: { userId: id },
    });

    if (normalizedPhone) {
      // Phone provided - create or update staff auth
      if (existingStaffAuth) {
        // Update existing
        await prisma.staffWhatsAppAuth.update({
          where: { id: existingStaffAuth.id },
          data: {
            phoneNumber: normalizedPhone,
            role: role.toLowerCase(),
            canViewAnalytics: role.toUpperCase() === 'ADMIN',
          },
        });
      } else {
        // Create new - verify user has tenantId
        if (!currentUser.tenantId) {
          return NextResponse.json(
            { error: 'User has no tenant assigned' },
            { status: 400 }
          );
        }

        await prisma.staffWhatsAppAuth.create({
          data: {
            tenantId: currentUser.tenantId,
            userId: id,
            phoneNumber: normalizedPhone,
            role: role.toLowerCase(),
            isActive: true,
            canUploadVehicle: true,
            canUpdateStatus: true,
            canViewAnalytics: role.toUpperCase() === 'ADMIN',
            canManageLeads: true,
          },
        });
      }

      // Sync existing WhatsApp conversations - mark as staff
      // This handles cases where phone was added/changed
      if (currentUser.tenantId && normalizedPhone !== currentUser.phone) {
        const syncResult = await syncConversationsAsStaff(
          currentUser.tenantId,
          normalizedPhone,
          `${firstName} ${lastName || ''}`.trim()
        );
        console.log(`[Users API] Synced ${syncResult.updated} conversations as staff for ${normalizedPhone}`);
      }
    } else if (existingStaffAuth) {
      // Phone removed - delete staff auth
      await prisma.staffWhatsAppAuth.delete({
        where: { id: existingStaffAuth.id },
      });
    }

    return NextResponse.json({
      success: true,
      data: user,
      message: 'User updated successfully',
    });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Authenticate request
  const auth = await authenticateRequest(request);
  if (!auth.success || !auth.user) {
    return NextResponse.json(
      { error: auth.error || 'Unauthorized' },
      { status: 401 }
    );
  }

  // Check permission - only admin and super_admin can delete users
  if (!['admin', 'super_admin'].includes(auth.user.role.toLowerCase())) {
    return NextResponse.json(
      { error: 'Forbidden - Admin access required to delete users' },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;

    // Get user to check tenant
    const userToDelete = await prisma.user.findUnique({
      where: { id },
      select: { tenantId: true },
    });

    if (!userToDelete) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Tenant validation: non-super_admin can only delete users from their own tenant
    if (auth.user.role.toLowerCase() !== 'super_admin' && userToDelete.tenantId !== auth.user.tenantId) {
      return NextResponse.json(
        { error: 'Forbidden - Cannot delete users from other tenant' },
        { status: 403 }
      );
    }

    // Delete related WhatsApp staff auth first (if exists)
    await prisma.staffWhatsAppAuth.deleteMany({
      where: { userId: id },
    });

    // Delete user
    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}
