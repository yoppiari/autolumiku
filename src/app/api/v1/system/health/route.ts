import { NextResponse } from 'next/server';
import { SystemHealthService } from '@/lib/services/system-health.service';

export async function GET() {
    try {
        const report = await SystemHealthService.checkIntegrity();

        const status =
            report.database.status === 'error' ||
                report.vehicles.status === 'error' ||
                report.leads.status === 'error' ||
                report.whatsapp.status === 'error'
                ? 500 : 200;

        return NextResponse.json({
            success: true,
            data: report
        }, { status });
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal System Error'
        }, { status: 500 });
    }
}
