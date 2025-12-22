/**
 * WhatsApp AI - AI Health Status API
 * GET /api/v1/whatsapp-ai/ai-health?tenantId=xxx - Get AI health status
 * POST /api/v1/whatsapp-ai/ai-health - Toggle AI on/off
 */

import { NextRequest, NextResponse } from "next/server";
import { AIHealthMonitorService } from "@/lib/services/whatsapp-ai/ai-health-monitor.service";

/**
 * GET - Get AI health status for a tenant
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

    // Get health state
    const healthState = await AIHealthMonitorService.getHealthState(tenantId);

    if (!healthState) {
      return NextResponse.json(
        { success: false, error: "AI configuration not found for tenant" },
        { status: 404 }
      );
    }

    // Get processing status
    const canProcess = await AIHealthMonitorService.canProcessAI(tenantId);

    return NextResponse.json({
      success: true,
      data: {
        ...healthState,
        canProcess: canProcess.canProcess,
        statusMessage: canProcess.reason || "AI berjalan normal",
      },
    });
  } catch (error: any) {
    console.error("[AI Health API] GET Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST - Toggle AI on/off for a tenant
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, enabled, reason } = body;

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: "Missing required field: tenantId" },
        { status: 400 }
      );
    }

    if (typeof enabled !== "boolean") {
      return NextResponse.json(
        { success: false, error: "Missing required field: enabled (boolean)" },
        { status: 400 }
      );
    }

    // Toggle AI
    const success = await AIHealthMonitorService.setAIEnabled(
      tenantId,
      enabled,
      reason
    );

    if (!success) {
      return NextResponse.json(
        { success: false, error: "Failed to update AI status" },
        { status: 500 }
      );
    }

    // Get updated health state
    const healthState = await AIHealthMonitorService.getHealthState(tenantId);

    return NextResponse.json({
      success: true,
      message: enabled ? "AI berhasil diaktifkan" : "AI berhasil dinonaktifkan",
      data: healthState,
    });
  } catch (error: any) {
    console.error("[AI Health API] POST Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
