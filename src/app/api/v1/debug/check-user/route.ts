/**
 * Debug endpoint to check user registration by phone number
 * Usage: GET /api/v1/debug/check-user?phone=6281310703754
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const phone = searchParams.get('phone');

  if (!phone) {
    return NextResponse.json(
      { error: "Missing phone parameter" },
      { status: 400 }
    );
  }

  try {
    // Try different phone formats
    const phones = [
      phone,
      phone.replace(/^62/, '0'),
      `62${phone.replace(/^0/, '')}`,
    ];

    for (const p of phones) {
      const user = await prisma.user.findFirst({
        where: { phone: p },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          roleLevel: true,
          tenant: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (user) {
        return NextResponse.json({
          found: true,
          searchedPhone: phone,
          matchedPhone: p,
          user: {
            id: user.id,
            name: `${user.firstName} ${user.lastName}`,
            phone: user.phone,
            role: user.role,
            roleLevel: user.roleLevel,
            tenant: user.tenant?.name || 'N/A',
            canAccessPDF: user.roleLevel >= 90,
          },
        });
      }
    }

    return NextResponse.json({
      found: false,
      searchedPhone: phone,
      message: "User not found in database",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
