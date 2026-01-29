/**
 * POST /api/v1/whatsapp-ai/command - Process WhatsApp AI Commands
 *
 * Processes WhatsApp AI commands from users:
 * - Universal commands (ALL roles): rubah, upload, inventory, status, statistik
 * - PDF report commands (ADMIN+ only): 14 report types
 *
 * Body:
 * - command: string (the command text)
 * - phoneNumber: string (user's WhatsApp number)
 * - tenantId: string (tenant ID)
 * - userId: string (user ID)
 * - userRole: string (user role)
 * - userRoleLevel: number (user role level)
 */

import { NextRequest, NextResponse } from 'next/server';
import { processCommand } from '@/lib/services/whatsapp-ai/commands/command-handler.service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { command, phoneNumber, tenantId, userId, userRole, userRoleLevel } = body;

    // Validate required fields
    if (!command || !phoneNumber || !tenantId || !userId || !userRole || userRoleLevel === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Process command
    const result = await processCommand(command, {
      tenantId,
      userRole,
      userRoleLevel,
      phoneNumber,
      userId,
    });

    // Return result
    return NextResponse.json({
      success: result.success,
      message: result.message,
      hasPDF: !!result.pdfBuffer,
      filename: result.filename,
      followUp: result.followUp ?? false,
    });

  } catch (error) {
    console.error('WhatsApp AI Command error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process command',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
