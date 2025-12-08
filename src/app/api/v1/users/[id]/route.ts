/**
 * User Management API - Single User Operations
 * GET /api/v1/users/[id] - Get user by ID
 * PUT /api/v1/users/[id] - Update user
 * DELETE /api/v1/users/[id] - Delete user
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
        // Create new
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
  try {
    const { id } = await params;

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
