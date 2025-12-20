/**
 * Debug endpoint to fix staff phone number
 * POST /api/v1/debug/fix-staff-phone
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, oldPhone, newPhone, secret } = body;

    // Simple secret check for safety
    if (secret !== "fix-phone-2024") {
      return NextResponse.json(
        { success: false, error: "Invalid secret" },
        { status: 401 }
      );
    }

    if (!email || !newPhone) {
      return NextResponse.json(
        { success: false, error: "email and newPhone are required" },
        { status: 400 }
      );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, phone: true, firstName: true, lastName: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: `User with email ${email} not found` },
        { status: 404 }
      );
    }

    // Normalize phone
    let normalizedPhone = newPhone.replace(/\D/g, "");
    if (normalizedPhone.startsWith("0")) {
      normalizedPhone = "62" + normalizedPhone.substring(1);
    }

    // Update phone
    const updated = await prisma.user.update({
      where: { email },
      data: { phone: normalizedPhone },
      select: { id: true, email: true, phone: true, firstName: true, lastName: true },
    });

    return NextResponse.json({
      success: true,
      message: "Phone number updated successfully",
      before: {
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        phone: user.phone,
      },
      after: {
        name: `${updated.firstName} ${updated.lastName}`,
        email: updated.email,
        phone: updated.phone,
      },
    });
  } catch (error: any) {
    console.error("[Fix Staff Phone] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    usage: "POST /api/v1/debug/fix-staff-phone",
    body: {
      email: "user@example.com",
      newPhone: "081310703754",
      secret: "fix-phone-2024",
    },
  });
}
