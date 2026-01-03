import { NextRequest, NextResponse } from 'next/server';
import { LeadService } from '@/lib/services/lead-service';
import { authenticateRequest } from '@/lib/auth/middleware';
import { ROLE_LEVELS } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: any }
) {
    const resolvedParams = await params;
    const id = resolvedParams.id;

    const auth = await authenticateRequest(request);
    if (!auth.success || !auth.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Require ADMIN role or higher
    if (auth.user.roleLevel < ROLE_LEVELS.ADMIN) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const tenantId = auth.user.tenantId || request.nextUrl.searchParams.get('tenantId');
    if (!tenantId) {
        return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });
    }

    try {
        const lead = await LeadService.getLeadById(id, tenantId);
        if (!lead) {
            return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
        }
        return NextResponse.json({ success: true, data: lead });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: any }
) {
    const resolvedParams = await params;
    const id = resolvedParams.id;

    const auth = await authenticateRequest(request);
    if (!auth.success || !auth.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Require ADMIN role or higher
    if (auth.user.roleLevel < ROLE_LEVELS.ADMIN) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const tenantId = auth.user.tenantId; // PATCH usually requires direct ownership or superadmin
    if (!tenantId && auth.user.roleLevel < ROLE_LEVELS.SUPER_ADMIN) {
        return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });
    }

    try {
        const body = await request.json();
        const finalTenantId = tenantId || body.tenantId;

        if (!finalTenantId) {
            return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });
        }

        const lead = await LeadService.updateLead(id, finalTenantId, body);
        return NextResponse.json({ success: true, data: lead });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: any }
) {
    const resolvedParams = await params;
    const id = resolvedParams.id;

    const auth = await authenticateRequest(request);
    if (!auth.success || !auth.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Require ADMIN role or higher
    if (auth.user.roleLevel < ROLE_LEVELS.ADMIN) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const tenantId = auth.user.tenantId || request.nextUrl.searchParams.get('tenantId');
    if (!tenantId) {
        return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });
    }

    try {
        await LeadService.deleteLead(id, tenantId);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
