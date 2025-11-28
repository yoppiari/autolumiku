/**
 * Staff WhatsApp Management API
 * GET /api/v1/whatsapp-ai/staff?tenantId=xxx - List staff
 * POST /api/v1/whatsapp-ai/staff - Add new staff
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET - List staff for tenant
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: "Missing required parameter: tenantId" },
        { status: 400 }
      );
    }

    const staffList = await prisma.staffWhatsAppAuth.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: staffList,
    });
  } catch (error: any) {
    console.error("[Staff API GET] Error:", error);
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
 * POST - Add new staff
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      tenantId,
      phoneNumber,
      role,
      canUploadVehicle,
      canUpdateStatus,
      canViewAnalytics,
      canManageLeads,
    } = body;

    if (!tenantId || !phoneNumber) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: tenantId, phoneNumber" },
        { status: 400 }
      );
    }

    // Check if staff already exists
    const existing = await prisma.staffWhatsAppAuth.findFirst({
      where: {
        tenantId,
        phoneNumber,
      },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: "Staff dengan nomor ini sudah terdaftar" },
        { status: 400 }
      );
    }

    // Create staff
    const staff = await prisma.staffWhatsAppAuth.create({
      data: {
        tenantId,
        userId: "", // TODO: Link to actual user if needed
        phoneNumber,
        role: role || "staff",
        isActive: true,
        canUploadVehicle: canUploadVehicle ?? true,
        canUpdateStatus: canUpdateStatus ?? true,
        canViewAnalytics: canViewAnalytics ?? false,
        canManageLeads: canManageLeads ?? true,
        commandCount: 0,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Staff berhasil ditambahkan",
      data: staff,
    });
  } catch (error: any) {
    console.error("[Staff API POST] Error:", error);
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
