/**
 * WhatsApp AI Staff Command Logs API
 * Get command history for specific staff
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ==================== GET /api/v1/whatsapp-ai/staff/[staffId]/logs ====================
// Get command logs for specific staff
export async function GET(
  request: NextRequest,
  { params }: { params: { staffId: string } }
) {
  try {
    const { staffId } = params;
    const { searchParams } = new URL(request.url);

    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const commandType = searchParams.get("commandType");
    const success = searchParams.get("success");

    // Check if staff exists
    const staff = await prisma.staffWhatsAppAuth.findUnique({
      where: { id: staffId },
      select: {
        phoneNumber: true,
        tenantId: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!staff) {
      return NextResponse.json(
        { success: false, error: "Staff not found" },
        { status: 404 }
      );
    }

    // Build where clause
    const where: any = {
      tenantId: staff.tenantId,
      staffPhone: staff.phoneNumber,
    };

    // Date range filter
    if (dateFrom || dateTo) {
      where.executedAt = {};
      if (dateFrom) {
        where.executedAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.executedAt.lte = new Date(dateTo);
      }
    }

    // Command type filter
    if (commandType) {
      where.commandType = commandType;
    }

    // Success filter
    if (success !== null && success !== undefined) {
      where.success = success === "true";
    }

    // Get total count
    const total = await prisma.staffCommandLog.count({ where });

    // Get logs
    const logs = await prisma.staffCommandLog.findMany({
      where,
      orderBy: { executedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        command: true,
        commandType: true,
        parameters: true,
        success: true,
        resultMessage: true,
        error: true,
        vehicleId: true,
        leadId: true,
        executedAt: true,
      },
    });

    // Get summary stats
    const stats = {
      total: await prisma.staffCommandLog.count({
        where: {
          tenantId: staff.tenantId,
          staffPhone: staff.phoneNumber,
        },
      }),
      successful: await prisma.staffCommandLog.count({
        where: {
          tenantId: staff.tenantId,
          staffPhone: staff.phoneNumber,
          success: true,
        },
      }),
      failed: await prisma.staffCommandLog.count({
        where: {
          tenantId: staff.tenantId,
          staffPhone: staff.phoneNumber,
          success: false,
        },
      }),
      today: await prisma.staffCommandLog.count({
        where: {
          tenantId: staff.tenantId,
          staffPhone: staff.phoneNumber,
          executedAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
    };

    // Get command type breakdown
    const commandBreakdown = await prisma.staffCommandLog.groupBy({
      by: ["commandType"],
      where: {
        tenantId: staff.tenantId,
        staffPhone: staff.phoneNumber,
      },
      _count: true,
    });

    return NextResponse.json({
      success: true,
      data: {
        staff: {
          id: staffId,
          name: `${staff.user.firstName} ${staff.user.lastName}`,
          phoneNumber: staff.phoneNumber,
        },
        logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        stats,
        commandBreakdown: commandBreakdown.map((item) => ({
          commandType: item.commandType,
          count: item._count,
        })),
      },
    });
  } catch (error: any) {
    console.error("[Staff Logs API] GET error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
