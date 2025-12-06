/**
 * Last Webhook Payload
 * GET /api/v1/whatsapp-ai/last-webhook
 * Returns the last webhook payload received (stored in temp file)
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const WEBHOOK_LOG_FILE = path.join(process.cwd(), "tmp", "last-webhook.json");

export async function GET(request: NextRequest) {
  try {
    // Read last webhook payload from temp file
    if (!fs.existsSync(WEBHOOK_LOG_FILE)) {
      return NextResponse.json({
        success: false,
        error: "No webhook payload captured yet. Send a message to trigger webhook.",
      });
    }

    const payload = JSON.parse(fs.readFileSync(WEBHOOK_LOG_FILE, "utf-8"));

    return NextResponse.json({
      success: true,
      data: {
        payload,
        timestamp: payload._capturedAt,
      },
    });
  } catch (error: any) {
    console.error("[Last Webhook] Error:", error);
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
