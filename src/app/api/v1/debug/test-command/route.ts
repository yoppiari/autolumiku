/**
 * Debug endpoint untuk test command processing
 * POST /api/v1/debug/test-command
 * Body: { "phone": "...", "message": "..." }
 */

import { NextRequest, NextResponse } from "next/server";
import { processCommand } from "@/lib/services/whatsapp-ai/command-handler.service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, message } = body;

    if (!phone || !message) {
      return NextResponse.json(
        { error: "Missing phone or message" },
        { status: 400 }
      );
    }

    // Test command detection and processing
    const result = await processCommand(message, {
      tenantId: "primamobil-id", // Prima Mobil tenant ID
      userRole: "OWNER",
      userRoleLevel: 100,
      phoneNumber: phone,
      userId: "1d665f3a-2b10-4b9d-9d1d-e7ca1e3958d2", // Yudho's user ID
    });

    return NextResponse.json({
      input: { phone, message },
      result: {
        success: result.success,
        message: result.message,
        hasPDF: !!result.pdfBuffer,
        pdfSize: result.pdfBuffer?.length || 0,
        filename: result.filename,
        followUp: result.followUp,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}
