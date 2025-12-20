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
        phone: phone || null,
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

    if (phone) {
      // Phone provided - create or update staff auth
      if (existingStaffAuth) {
        // Update existing
        await prisma.staffWhatsAppAuth.update({
          where: { id: existingStaffAuth.id },
          data: {
            phoneNumber: phone,
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
            phoneNumber: phone,
            role: role.toLowerCase(),
            isActive: true,
            canUploadVehicle: true,
            canUpdateStatus: true,
            canViewAnalytics: role.toUpperCase() === 'ADMIN',
            canManageLeads: true,
          },
        });
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
