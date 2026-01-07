/**
 * System Health API Check
 * Returns real-time observability status of the "AI 5.0" platform
 */

import { NextRequest, NextResponse } from 'next/server';
import { SystemHealthService } from '@/lib/services/system-health.service';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
    try {
        // 1. Authenticate (Simple Tenant Check for now)
        // In production, this should be guarded by AuthGuard/Admin check
        const tenantId = req.nextUrl.searchParams.get('tenantId');
        if (!tenantId) {
            // Fallback: try to find first tenant for demo purposes
            const firstTenant = await prisma.tenant.findFirst();
            if (!firstTenant) {
                return NextResponse.json({ error: 'No tenant found' }, { status: 404 });
            }
            // Redirect to self with tenantId
            const url = req.nextUrl.clone();
            url.searchParams.set('tenantId', firstTenant.id);
            return NextResponse.redirect(url);
        }

        // 2. Run Diagnostics
        const healthReport = await SystemHealthService.runDiagnostic(tenantId);

        // 3. Return Report
        // Status 200 even if "degraded" so UI can render the report
        return NextResponse.json(healthReport, { status: 200 });

    } catch (error: any) {
        return NextResponse.json(
            {
                overallStatus: 'error',
                message: 'Health Check System Failure',
                details: error.message
            },
            { status: 500 }
        );
    }
}
