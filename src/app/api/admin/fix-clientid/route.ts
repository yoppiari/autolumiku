import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    // Update clientId back to UUID
    const result = await prisma.aimeowAccount.updateMany({
      where: {
        clientId: "6281298329132:17@s.whatsapp.net",
      },
      data: {
        clientId: "bbf4dde5-79e7-43d7-bbcf-a6482709c656",
      },
    });

    // Verify
    const account = await prisma.aimeowAccount.findUnique({
      where: {
        clientId: "bbf4dde5-79e7-43d7-bbcf-a6482709c656",
      },
    });

    return NextResponse.json({
      success: true,
      updated: result.count,
      account: {
        id: account?.id,
        clientId: account?.clientId,
        phoneNumber: account?.phoneNumber,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
