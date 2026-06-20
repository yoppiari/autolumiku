/**
 * Super-admin LLM Eval Runs history API
 * GET /api/v1/admin/llm/eval/runs?limit=50&scenarioId=&status=
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withSuperAdminAuth } from '@/lib/auth/middleware';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withSuperAdminAuth(request, async (req) => {
    const sp = req.nextUrl.searchParams;
    const where: any = {};
    if (sp.get('scenarioId')) where.scenarioId = sp.get('scenarioId');
    if (sp.get('status')) where.status = sp.get('status');

    const runs = await prisma.llmEvalRun.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(parseInt(sp.get('limit') || '50'), 200),
      include: { scenario: { select: { name: true, category: true } } },
    });
    return NextResponse.json({ success: true, data: runs });
  });
}
