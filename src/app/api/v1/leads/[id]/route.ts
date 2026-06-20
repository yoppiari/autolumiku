/**
 * GET/PUT/DELETE /api/v1/leads/[id]
 * Single lead operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { LeadService } from '@/lib/services/leads/lead-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authGate = await requireAuth(request);
  if (authGate instanceof NextResponse) return authGate;

  const isSuperAdmin = authGate.user.role?.toLowerCase() === 'super_admin';

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const clientTenantId = searchParams.get('tenantId');

    // Cross-tenant IDOR protection: non-super users are forced to their own tenant
    const tenantId = isSuperAdmin
      ? (clientTenantId || authGate.user.tenantId)
      : authGate.user.tenantId;
    if (!tenantId) return NextResponse.json({ error: 'Forbidden - no tenant' }, { status: 403 });

    const lead = await LeadService.getLeadById(id, tenantId);

    if (!lead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: lead,
    });
  } catch (error) {
    console.error('Get lead error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get lead',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authGate = await requireAuth(request);
  if (authGate instanceof NextResponse) return authGate;

  const isSuperAdmin = authGate.user.role?.toLowerCase() === 'super_admin';

  try {
    const { id } = await params;
    const body = await request.json();
    const { tenantId: clientTenantId, ...updateData } = body;

    // Cross-tenant IDOR protection: non-super users are forced to their own tenant
    const tenantId = isSuperAdmin
      ? (clientTenantId || authGate.user.tenantId)
      : authGate.user.tenantId;
    if (!tenantId) return NextResponse.json({ error: 'Forbidden - no tenant' }, { status: 403 });

    // Convert followUpDate string to Date if provided
    if (updateData.followUpDate) {
      updateData.followUpDate = new Date(updateData.followUpDate);
    }

    await LeadService.updateLead(id, tenantId, updateData);

    // Get updated lead
    const lead = await LeadService.getLeadById(id, tenantId);

    return NextResponse.json({
      success: true,
      data: lead,
    });
  } catch (error) {
    console.error('Update lead error:', error);
    return NextResponse.json(
      {
        error: 'Failed to update lead',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authGate = await requireAuth(request);
  if (authGate instanceof NextResponse) return authGate;

  const isSuperAdmin = authGate.user.role?.toLowerCase() === 'super_admin';

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const clientTenantId = searchParams.get('tenantId');

    // Cross-tenant IDOR protection: non-super users are forced to their own tenant
    const tenantId = isSuperAdmin
      ? (clientTenantId || authGate.user.tenantId)
      : authGate.user.tenantId;
    if (!tenantId) return NextResponse.json({ error: 'Forbidden - no tenant' }, { status: 403 });

    await LeadService.deleteLead(id, tenantId);

    return NextResponse.json({
      success: true,
      message: 'Lead deleted successfully',
    });
  } catch (error) {
    console.error('Delete lead error:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete lead',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
