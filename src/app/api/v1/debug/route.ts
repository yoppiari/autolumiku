/**
 * Debug Index Route
 * GET /api/v1/debug
 *
 * Lists all available debug tools
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const debugTools = [
        { name: 'WhatsApp PDF Test', path: '/api/v1/debug/test-whatsapp-pdf' },
        { name: 'Sales Report PDF Test', path: '/api/v1/debug/test-sales-report-pdf' },
        { name: 'User Check', path: '/api/v1/debug/user-check' },
        { name: 'Vehicle Check', path: '/api/v1/debug/vehicle-check' },
        { name: 'WA Status', path: '/api/v1/debug/wa-status' },
        { name: 'WhatsApp Setup', path: '/api/v1/debug/whatsapp-setup' },
    ];

    return NextResponse.json({
        success: true,
        message: 'AutoLumiKu Debug Tools',
        tools: debugTools,
        help: 'Append tool path to base URL to use it.'
    });
}
