/**
 * Super-admin LLM Eval Runner API
 * POST /api/v1/admin/llm/eval/run
 *   body: { scenarioId?: string, endpointId?: string, all?: boolean,
 *           adhoc?: { systemPrompt?, userPrompt, assertions[] } }
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withSuperAdminAuth } from '@/lib/auth/middleware';
import { runScenario, runAllScenarios } from '@/lib/services/llm/llm-eval.service';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const adhocSchema = z.object({
  systemPrompt: z.string().optional(),
  userPrompt: z.string().min(1),
  assertions: z.array(z.any()).default([]),
});

const bodySchema = z.object({
  scenarioId: z.string().optional(),
  endpointId: z.string().optional(),
  all: z.boolean().optional(),
  adhoc: adhocSchema.optional(),
});

export async function POST(request: NextRequest) {
  return withSuperAdminAuth(request, async (req) => {
    try {
      const v = bodySchema.parse(await req.json());

      if (v.all) {
        const runs = await runAllScenarios(v.endpointId);
        return NextResponse.json({ success: true, data: { runs } });
      }

      if (v.adhoc) {
        const run = await runScenario({
          systemPrompt: v.adhoc.systemPrompt,
          userPrompt: v.adhoc.userPrompt,
          assertions: v.adhoc.assertions as any,
          endpointId: v.endpointId,
        });
        return NextResponse.json({ success: true, data: { run } });
      }

      if (v.scenarioId) {
        const s = await prisma.llmEvalScenario.findUnique({ where: { id: v.scenarioId } });
        if (!s) return NextResponse.json({ success: false, error: 'Scenario not found' }, { status: 404 });
        const run = await runScenario({
          systemPrompt: s.systemPrompt,
          userPrompt: s.userPrompt,
          assertions: (s.assertions as any) || [],
          scenarioId: s.id,
          endpointId: v.endpointId,
        });
        return NextResponse.json({ success: true, data: { run } });
      }

      return NextResponse.json({ success: false, error: 'Provide scenarioId, all=true, or adhoc' }, { status: 400 });
    } catch (err: any) {
      if (err?.name === 'ZodError') {
        return NextResponse.json({ success: false, error: 'Validation failed', details: err.errors }, { status: 400 });
      }
      console.error('[LLM Eval Run API]', err);
      return NextResponse.json({ success: false, error: err?.message || 'Internal error' }, { status: 500 });
    }
  });
}
