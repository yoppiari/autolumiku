/**
 * Debug endpoint to check user registration by phone number
 * Usage: GET /api/v1/debug/check-user?phone=6281310703754
 *
 * Tests 3 phone formats to match database:
 * - With 0 prefix: 081234567890
 * - With 62 prefix: 6281234567890
 * - Exact match
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const phone = searchParams.get('phone');

  if (!phone) {
    return NextResponse.json(
      {
        error: "Missing phone parameter",
        usage: "GET /api/v1/debug/check-user?phone=6281234567890"
      },
      { status: 400 }
    );
  }

  try {
    // Normalize phone to try all formats (same logic as message-orchestrator)
    const digits = phone.replace(/\D/g, '');
    const phoneWith0 = digits.startsWith('62') ? '0' + digits.slice(2) : digits;
    const phoneWith62 = digits.startsWith('0') ? '62' + digits.slice(1) : digits;

    const phonesToTry = [
      phoneWith0,
      phoneWith62,
      phone, // exact match
    ];

    console.log(`[Check User] Testing phone formats:`, {
      input: phone,
      phoneWith0,
      phoneWith62,
      exact: phone
    });

    for (const p of phonesToTry) {
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
          matchType: p === phone ? 'exact' : (p === phoneWith0 ? '0-prefix' : '62-prefix'),
          user: {
            id: user.id,
            name: `${user.firstName} ${user.lastName}`,
            phone: user.phone,
            role: user.role,
            roleLevel: user.roleLevel,
            tenant: user.tenant?.name || 'N/A',
            canAccessPDF: user.roleLevel >= 90,
            canAccessTools: user.roleLevel >= 30, // SALES and above
            accessibleTools: {
              upload: true,
              inventory: true,
              stats: true,
              status: true,
              edit: true,
              pdfReports: user.roleLevel >= 90,
            }
          },
        });
      }
    }

    return NextResponse.json({
      found: false,
      searchedPhone: phone,
      testedFormats: phonesToTry,
      message: "User not found in database with any phone format",
      suggestion: "Make sure user is registered in /dashboard/users with correct phone format (08... or 62...)"
    });
  } catch (error: any) {
    console.error('[Check User] Error:', error);
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}
