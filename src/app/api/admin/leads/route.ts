import { NextRequest, NextResponse } from 'next/server';
import { LeadService } from '@/lib/services/lead-service';
import { authenticateRequest } from '@/lib/auth/middleware';
import { ROLE_LEVELS } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const auth = await authenticateRequest(request);
    if (!auth.success || !auth.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Require ADMIN role or higher
    if (auth.user.roleLevel < ROLE_LEVELS.ADMIN) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenantId') || auth.user.tenantId;

    if (!tenantId) {
        return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });
    }

    try {
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const search = searchParams.get('search') || undefined;
        const status = searchParams.get('status') || undefined;
        const source = searchParams.get('source') || undefined;

        const [leadsData, stats] = await Promise.all([
            LeadService.listLeads(tenantId, { search, status: status as any, source }, page, limit),
            LeadService.getLeadStats(tenantId)
        ]);

        return NextResponse.json({
            success: true,
            data: {
                leads: leadsData.leads,
                total: leadsData.total,
                page: leadsData.page,
                limit: leadsData.limit,
                totalPages: leadsData.totalPages,
                stats
            }
        });
    } catch (error: any) {
        console.error('Error fetching leads:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const auth = await authenticateRequest(request);
    if (!auth.success || !auth.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Require ADMIN role or higher
    if (auth.user.roleLevel < ROLE_LEVELS.ADMIN) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const body = await request.json();
        const tenantId = auth.user.tenantId || body.tenantId;

        if (!tenantId) {
            return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });
        }

        const lead = await LeadService.createLead({
            ...body,
            tenantId
        });

        return NextResponse.json({ success: true, data: lead });
    } catch (error: any) {
        console.error('Error creating lead:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
