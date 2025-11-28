/**
 * Staff WhatsApp Management API - Individual Staff
 * PUT /api/v1/whatsapp-ai/staff/[staffId] - Update staff
 * DELETE /api/v1/whatsapp-ai/staff/[staffId] - Delete staff
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * PUT - Update staff
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { staffId: string } }
) {
  try {
    const staffId = params.staffId;
    const body = await request.json();

    const {
      isActive,
      role,
      canUploadVehicle,
      canUpdateStatus,
      canViewAnalytics,
      canManageLeads,
    } = body;

    // Build update data
    const updateData: any = {};
    if (typeof isActive === "boolean") updateData.isActive = isActive;
    if (role) updateData.role = role;
    if (typeof canUploadVehicle === "boolean")
      updateData.canUploadVehicle = canUploadVehicle;
    if (typeof canUpdateStatus === "boolean")
      updateData.canUpdateStatus = canUpdateStatus;
    if (typeof canViewAnalytics === "boolean")
      updateData.canViewAnalytics = canViewAnalytics;
    if (typeof canManageLeads === "boolean")
      updateData.canManageLeads = canManageLeads;

    // Update staff
    const staff = await prisma.staffWhatsAppAuth.update({
      where: { id: staffId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: "Staff berhasil diupdate",
      data: staff,
    });
  } catch (error: any) {
    console.error("[Staff API PUT] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete staff
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { staffId: string } }
) {
  try {
    const staffId = params.staffId;

    await prisma.staffWhatsAppAuth.delete({
      where: { id: staffId },
    });

    return NextResponse.json({
      success: true,
      message: "Staff berhasil dihapus",
    });
  } catch (error: any) {
    console.error("[Staff API DELETE] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
