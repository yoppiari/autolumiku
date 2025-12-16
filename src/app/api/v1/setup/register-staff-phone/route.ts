/**
 * Register Staff Phone API
 * One-time setup to add phone number to existing user
 * POST /api/v1/setup/register-staff-phone
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, phone } = body;

    if (!email || !phone) {
      return NextResponse.json(
        { error: "Email and phone are required" },
        { status: 400 }
      );
    }

    // Normalize phone number
    let normalizedPhone = phone.replace(/\D/g, "");
    if (normalizedPhone.startsWith("0")) {
      normalizedPhone = "62" + normalizedPhone.substring(1);
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, phone: true, firstName: true, tenantId: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found with this email" },
        { status: 404 }
      );
    }

    // Update phone number
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { phone: normalizedPhone },
    });

    return NextResponse.json({
      success: true,
      message: `Phone number updated for ${user.firstName}`,
      user: {
        id: updated.id,
        email: updated.email,
        phone: updated.phone,
        tenantId: updated.tenantId,
      },
    });
  } catch (error: any) {
    console.error("[Register Staff Phone] Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");

    if (!tenantId) {
      return NextResponse.json(
        { error: "tenantId is required" },
        { status: 400 }
      );
    }

    // Get all users in tenant with their phones
    const users = await prisma.user.findMany({
      where: { tenantId },
      select: { id: true, email: true, phone: true, firstName: true, lastName: true },
    });

    return NextResponse.json({
      success: true,
      count: users.length,
      users: users.map(u => ({
        id: u.id,
        name: `${u.firstName} ${u.lastName}`,
        email: u.email,
        phone: u.phone || "(not set)",
      })),
    });
  } catch (error: any) {
    console.error("[Register Staff Phone] Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
