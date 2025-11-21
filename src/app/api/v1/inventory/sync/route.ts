/**
 * Real-Time Sync API (Server-Sent Events)
 * Epic 4: Story 4.1 & 4.2 - Real-Time Inventory Updates
 *
 * GET /api/v1/inventory/sync - Subscribe to real-time inventory updates
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { realTimeSyncService } from '@/services/inventory/real-time-sync.service';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = withAuth(async (request, { user }) => {
  try {
    const clientId = randomUUID();

    // Create Server-Sent Events response
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        // Setup SSE headers
        const headers = {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        };

        // Create a mock response object for the service
        const mockResponse = {
          write: (data: string) => {
            controller.enqueue(encoder.encode(data));
          },
          end: () => {
            controller.close();
          },
        };

        // Register client with real-time service
        realTimeSyncService.registerClient(clientId, user.tenantId, user.id, mockResponse);

        console.log(`[SSE] Client ${clientId} connected (user: ${user.id}, tenant: ${user.tenantId})`);

        // Keep-alive ping every 30 seconds
        const keepAliveInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': ping\n\n'));
          } catch (error) {
            clearInterval(keepAliveInterval);
            realTimeSyncService.unregisterClient(clientId);
          }
        }, 30000);

        // Cleanup on disconnect
        request.signal.addEventListener('abort', () => {
          clearInterval(keepAliveInterval);
          realTimeSyncService.unregisterClient(clientId);
          controller.close();
          console.log(`[SSE] Client ${clientId} disconnected`);
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('[Real-Time Sync API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to establish real-time connection',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
});
