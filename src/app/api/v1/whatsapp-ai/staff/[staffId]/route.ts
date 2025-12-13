/**
 * WhatsApp AI Staff Management API - Individual Staff
 * PUT & DELETE endpoints for specific staff member
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ==================== PUT /api/v1/whatsapp-ai/staff/[staffId] ====================
// Update staff permissions and info
export async function PUT(
  request: NextRequest,
  { params }: { params: { staffId: string } }
) {
  try {
    const { staffId } = params;
    const body = await request.json();
    const {
      role,
      isActive,
      canUploadVehicle,
      canUpdateStatus,
      canViewAnalytics,
      canManageLeads,
      phoneNumber,
    } = body;

    // Check if staff exists
    const existing = await prisma.staffWhatsAppAuth.findUnique({
      where: { id: staffId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Staff not found" },
        { status: 404 }
      );
    }

    // If updating phone number, check for duplicates
    if (phoneNumber && phoneNumber !== existing.phoneNumber) {
      // Validate phone number format
      const phoneRegex = /^\+?62\d{9,13}$/;
      if (!phoneRegex.test(phoneNumber)) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Invalid phone number format. Use Indonesia format: +62xxx or 62xxx",
          },
          { status: 400 }
        );
      }

      const duplicate = await prisma.staffWhatsAppAuth.findUnique({
        where: { phoneNumber },
      });

      if (duplicate) {
        return NextResponse.json(
          {
            success: false,
            error: "Phone number already registered to another staff",
          },
          { status: 409 }
        );
      }
    }

    // Update staff
    const updated = await prisma.staffWhatsAppAuth.update({
      where: { id: staffId },
      data: {
        ...(role !== undefined && { role }),
        ...(isActive !== undefined && { isActive }),
        ...(canUploadVehicle !== undefined && { canUploadVehicle }),
        ...(canUpdateStatus !== undefined && { canUpdateStatus }),
        ...(canViewAnalytics !== undefined && { canViewAnalytics }),
        ...(canManageLeads !== undefined && { canManageLeads }),
        ...(phoneNumber && { phoneNumber }),
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: "Staff updated successfully",
    });
  } catch (error: any) {
    console.error("[Staff API] PUT error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// ==================== DELETE /api/v1/whatsapp-ai/staff/[staffId] ====================
// Soft delete staff (set isActive = false)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { staffId: string } }
) {
  try {
    const { staffId } = params;

    // Check if staff exists
    const existing = await prisma.staffWhatsAppAuth.findUnique({
      where: { id: staffId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Staff not found" },
        { status: 404 }
      );
    }

    // Soft delete (set isActive = false)
    const deleted = await prisma.staffWhatsAppAuth.update({
      where: { id: staffId },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      data: deleted,
      message: "Staff deactivated successfully",
    });
  } catch (error: any) {
    console.error("[Staff API] DELETE error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
