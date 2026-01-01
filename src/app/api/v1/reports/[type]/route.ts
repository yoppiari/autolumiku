/**
 * GET /api/v1/reports/[type] - Generate Comprehensive Report
 * 
 * Supports 14 report types with real data from database
 * Protected: Requires authentication
 * 
 * Route params:
 * - type: Report type (sales-report, whatsapp-analytics, etc.)
 * 
 * Query params:
 * - period: '7d' | '30d' | '90d' | '1y' | 'mtd' | 'ytd' (default: '30d')
 * - format: 'pdf' | 'excel' (default: 'pdf')
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth/middleware';
import { ROLE_LEVELS } from '@/lib/rbac';
import {
    ComprehensiveReportPDF,
    ComprehensiveReportConfig,
    ReportType,
    ReportData
} from '@/lib/reports/comprehensive-report-pdf';
import { ExcelGenerator } from '@/lib/reports/excel-generator';
import { ReportDataService } from '@/lib/reports/report-data-service';

export const dynamic = 'force-dynamic';


const VALID_REPORT_TYPES: ReportType[] = [
    'sales-report',
    'whatsapp-analytics',
    'sales-metrics',
    'customer-metrics',
    'operational-metrics',
    'sales-trends',
    'staff-performance',
    'recent-sales',
    'low-stock-alert',
    'total-sales',
    'total-revenue',
    'total-inventory',
    'average-price',
    'sales-summary',
    'management-insights',
];

export async function GET(
    request: NextRequest,
    { params }: { params: { type: string } }
) {
    // Authenticate
    const auth = await authenticateRequest(request);
    if (!auth.success || !auth.user) {
        return NextResponse.json(
            { error: auth.error || 'Unauthorized' },
            { status: 401 }
        );
    }

    // RBAC: Manager+ can view reports (roleLevel >= 80)
    if (auth.user.roleLevel < 80) { // Using 80 for Manager as it's not in ROLE_LEVELS enum but used in docs
        return NextResponse.json(
            { error: 'Forbidden - Manager role or higher required' },
            { status: 403 }
        );
    }

    try {
        const tenantId = auth.user.tenantId;
        if (!tenantId) {
            return NextResponse.json(
                { error: 'No tenant associated with this user' },
                { status: 400 }
            );
        }

        // Validate report type
        const reportType = params.type as ReportType;
        if (!VALID_REPORT_TYPES.includes(reportType)) {
            return NextResponse.json(
                { error: `Invalid report type: ${params.type}. Valid types: ${VALID_REPORT_TYPES.join(', ')}` },
                { status: 400 }
            );
        }

        const searchParams = request.nextUrl.searchParams;
        const period = searchParams.get('period') || '30d';
        const format = searchParams.get('format') || 'pdf';

        // Calculate date range
        const now = new Date();
        let startDate = new Date();
        let periodLabel = '';

        switch (period) {
            case '7d':
                startDate.setDate(now.getDate() - 7);
                periodLabel = '7 Hari Terakhir';
                break;
            case '30d':
                startDate.setDate(now.getDate() - 30);
                periodLabel = '30 Hari Terakhir';
                break;
            case '90d':
                startDate.setDate(now.getDate() - 90);
                periodLabel = '90 Hari Terakhir';
                break;
            case '1y':
                startDate.setFullYear(now.getFullYear() - 1);
                periodLabel = '1 Tahun Terakhir';
                break;
            case 'mtd':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                periodLabel = 'Month to Date';
                break;
            case 'ytd':
                startDate = new Date(now.getFullYear(), 0, 1);
                periodLabel = 'Year to Date';
                break;
            default:
                startDate.setDate(now.getDate() - 30);
                periodLabel = '30 Hari';
        }

        // Get tenant info
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { name: true, logoUrl: true },
        });

        // Gather data based on report type
        const reportData = await ReportDataService.gather(reportType, tenantId, startDate, now);

        // Generate PDF
        if (format === 'pdf') {
            const config: ComprehensiveReportConfig = {
                type: reportType,
                tenantName: tenant?.name || 'Prima Mobil',
                logoUrl: tenant?.logoUrl || undefined,
                period: {
                    start: startDate,
                    end: now,
                    label: periodLabel,
                },
                data: reportData,
            };

            const generator = new ComprehensiveReportPDF();
            const pdfBuffer = await generator.generate(config);

            const filename = `${reportType}-${new Date().toISOString().split('T')[0]}.pdf`;

            return new NextResponse(new Uint8Array(pdfBuffer), {
                status: 200,
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `attachment; filename="${filename}"`,
                    'Content-Length': pdfBuffer.length.toString(),
                },
            });
        } else {
            // Excel format
            const config: ComprehensiveReportConfig = {
                type: reportType,
                tenantName: tenant?.name || 'Prima Mobil',
                logoUrl: tenant?.logoUrl || undefined,
                period: {
                    start: startDate,
                    end: now,
                    label: periodLabel,
                },
                data: reportData,
            };

            const generator = new ExcelGenerator();
            const excelBuffer = generator.generate(config);

            const filename = `${reportType}-${new Date().toISOString().split('T')[0]}.xlsx`;

            return new NextResponse(new Uint8Array(excelBuffer), {
                status: 200,
                headers: {
                    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'Content-Disposition': `attachment; filename="${filename}"`,
                },
            });
        }
    } catch (error: any) {
        console.error(`[Reports API] Error generating ${params.type}:`, error);
        return NextResponse.json(
            {
                error: 'Failed to generate report',
                message: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            },
            { status: 500 }
        );
    }
}
