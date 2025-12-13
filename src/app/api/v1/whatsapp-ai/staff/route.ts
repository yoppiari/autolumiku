/**
 * WhatsApp AI Staff Management API
 * Endpoints untuk manage staff yang bisa akses WhatsApp commands
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ==================== GET /api/v1/whatsapp-ai/staff ====================
// Get list of staff with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");
    const search = searchParams.get("search");
    const role = searchParams.get("role");
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: "tenantId is required" },
        { status: 400 }
      );
    }

    // Build where clause
    const where: any = { tenantId };

    if (search) {
      where.OR = [
        { phoneNumber: { contains: search, mode: "insensitive" } },
        { user: { firstName: { contains: search, mode: "insensitive" } } },
        { user: { lastName: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (role) {
      where.role = role;
    }

    if (status === "active") {
      where.isActive = true;
    } else if (status === "inactive") {
      where.isActive = false;
    }

    // Get total count
    const total = await prisma.staffWhatsAppAuth.count({ where });

    // Get paginated staff list
    const staff = await prisma.staffWhatsAppAuth.findMany({
      where,
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
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Get command count for each staff
    const staffWithStats = await Promise.all(
      staff.map(async (s) => {
        const commandCount = await prisma.staffCommandLog.count({
          where: { tenantId, staffPhone: s.phoneNumber },
        });

        const todayCommandCount = await prisma.staffCommandLog.count({
          where: {
            tenantId,
            staffPhone: s.phoneNumber,
            executedAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
        });

        const lastCommand = await prisma.staffCommandLog.findFirst({
          where: { tenantId, staffPhone: s.phoneNumber },
          orderBy: { executedAt: "desc" },
          select: {
            executedAt: true,
            commandType: true,
            success: true,
          },
        });

        return {
          ...s,
          stats: {
            totalCommands: commandCount,
            todayCommands: todayCommandCount,
            lastCommand: lastCommand
              ? {
                  executedAt: lastCommand.executedAt,
                  commandType: lastCommand.commandType,
                  success: lastCommand.success,
                }
              : null,
          },
        };
      })
    );

    // Get overall stats
    const activeCount = await prisma.staffWhatsAppAuth.count({
      where: { tenantId, isActive: true },
    });

    const todayTotal = await prisma.staffCommandLog.count({
      where: {
        tenantId,
        executedAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    });

    const todaySuccess = await prisma.staffCommandLog.count({
      where: {
        tenantId,
        success: true,
        executedAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    });

    const successRate =
      todayTotal > 0 ? Math.round((todaySuccess / todayTotal) * 100) : 100;

    return NextResponse.json({
      success: true,
      data: {
        staff: staffWithStats,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        stats: {
          activeStaff: activeCount,
          commandsToday: todayTotal,
          successRate,
        },
      },
    });
  } catch (error: any) {
    console.error("[Staff API] GET error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// ==================== POST /api/v1/whatsapp-ai/staff ====================
// Create new staff
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      tenantId,
      userId,
      phoneNumber,
      role,
      canUploadVehicle,
      canUpdateStatus,
      canViewAnalytics,
      canManageLeads,
    } = body;

    // Validation
    if (!tenantId || !userId || !phoneNumber) {
      return NextResponse.json(
        {
          success: false,
          error: "tenantId, userId, and phoneNumber are required",
        },
        { status: 400 }
      );
    }

    // Validate phone number format (Indonesia)
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

    // Check if user exists and belongs to tenant
    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found in this tenant" },
        { status: 404 }
      );
    }

    // Check if phone number already exists
    const existing = await prisma.staffWhatsAppAuth.findUnique({
      where: { phoneNumber },
    });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: "Phone number already registered to another staff",
        },
        { status: 409 }
      );
    }

    // Create staff
    const staff = await prisma.staffWhatsAppAuth.create({
      data: {
        tenantId,
        userId,
        phoneNumber,
        role: role || "staff",
        isActive: true,
        canUploadVehicle: canUploadVehicle ?? true,
        canUpdateStatus: canUpdateStatus ?? true,
        canViewAnalytics: canViewAnalytics ?? false,
        canManageLeads: canManageLeads ?? true,
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
      data: staff,
      message: "Staff created successfully",
    });
  } catch (error: any) {
    console.error("[Staff API] POST error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
