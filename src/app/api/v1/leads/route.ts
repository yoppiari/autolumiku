/**
 * GET/POST /api/v1/leads
 * Lead management API
 */

import { NextRequest, NextResponse } from 'next/server';
import { LeadService } from '@/lib/services/lead-service';

import { withAuth } from '@/lib/auth/middleware';

export async function GET(request: NextRequest) {
  return withAuth(request, async (request, auth) => {
    try {
      const { searchParams } = new URL(request.url);
      const tenantId = searchParams.get('tenantId');
      const status = searchParams.get('status');
      const priority = searchParams.get('priority');
      const source = searchParams.get('source');
      const assignedTo = searchParams.get('assignedTo');
      const vehicleId = searchParams.get('vehicleId');
      const search = searchParams.get('search');
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '20');
      const action = searchParams.get('action'); // 'stats' or 'list'

      if (!tenantId) {
        return NextResponse.json(
          { error: 'tenantId is required' },
          { status: 400 }
        );
      }

      // STRICT TENANT ISOLATION CHECK
      // Only Super Admin can access any tenant.
      // Other users can ONLY access their own tenant.
      const user = auth.user!;
      const isSuperAdmin = user.role.toLowerCase() === 'super_admin';

      // If user has a tenantId, they must match the requested tenantId
      if (!isSuperAdmin && user.tenantId && user.tenantId !== tenantId) {
        return NextResponse.json(
          { error: 'Forbidden: Access denied to this tenant' },
          { status: 403 }
        );
      }

      // Platform Admins (role=ADMIN, tenantId=null) can access any tenant? 
      // User requirement says "Autolumiku... mengakses Tenant B". 
      // Assuming Platform Admin (Autolumiku) CAN access everything.
      // If user.tenantId is null (Platform Admin), we allow access.
      // If user.tenantId is SET (Tenant Admin/Staff), we blocked above.

      // Get statistics
      if (action === 'stats') {
        const stats = await LeadService.getLeadStats(tenantId);
        return NextResponse.json({
          success: true,
          data: stats,
        });
      }

      // List leads
      const result = await LeadService.listLeads(
        tenantId,
        {
          status: status as any,
          priority: priority as any,
          source: source || undefined,
          assignedTo: assignedTo || undefined,
          vehicleId: vehicleId || undefined,
          search: search || undefined,
        },
        page,
        limit
      );

      return NextResponse.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Get leads error:', error);
      return NextResponse.json(
        {
          error: 'Failed to get leads',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (request, auth) => {
    try {
      const body = await request.json();
      const {
        tenantId,
        vehicleId,
        name,
        email,
        phone,
        whatsappNumber,
        message,
        source,
        status,
        priority,
        interestedIn,
        budgetRange,
        timeframe,
        assignedTo,
      } = body;

      if (!tenantId || !name || !phone || !message) {
        return NextResponse.json(
          { error: 'tenantId, name, phone, and message are required' },
          { status: 400 }
        );
      }

      // STRICT TENANT ISOLATION CHECK
      const user = auth.user!;
      const isSuperAdmin = user.role.toLowerCase() === 'super_admin';

      // If user has a tenantId, they must match the target tenantId
      if (!isSuperAdmin && user.tenantId && user.tenantId !== tenantId) {
        return NextResponse.json(
          { error: 'Forbidden: You cannot create leads for another tenant' },
          { status: 403 }
        );
      }

      const lead = await LeadService.createLead({
        tenantId,
        vehicleId,
        name,
        email,
        phone,
        whatsappNumber,
        message,
        source,
        status,
        priority,
        interestedIn,
        budgetRange,
        timeframe,
        assignedTo,
      });

      return NextResponse.json({
        success: true,
        data: lead,
      });
    } catch (error) {
      console.error('Create lead error:', error);
      return NextResponse.json(
        {
          error: 'Failed to create lead',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  });
}
