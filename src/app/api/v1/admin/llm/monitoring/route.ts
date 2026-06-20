/**
 * Super-admin LLM Monitoring API
 * GET /api/v1/admin/llm/monitoring?hours=24&provider=&feature=
 */
import { NextRequest, NextResponse } from 'next/server';
import { withSuperAdminAuth } from '@/lib/auth/middleware';
import { getMonitoringStats } from '@/lib/services/llm/llm-monitor.service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withSuperAdminAuth(request, async (req) => {
    try {
      const sp = req.nextUrl.searchParams;
      const stats = await getMonitoringStats({
        sinceHours: sp.get('hours') ? parseInt(sp.get('hours')!) : 24,
        provider: sp.get('provider') || undefined,
        feature: sp.get('feature') || undefined,
        tenantId: sp.get('tenantId') || undefined,
      });
      return NextResponse.json({ success: true, data: stats });
    } catch (err: any) {
      console.error('[LLM Monitoring API]', err);
      return NextResponse.json({ success: false, error: err?.message || 'Internal error' }, { status: 500 });
    }
  });
}
