/**
 * Super-admin LLM Eval Scenarios API
 * GET  /api/v1/admin/llm/eval/scenarios   - list scenarios
 * POST /api/v1/admin/llm/eval/scenarios   - create scenario
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withSuperAdminAuth } from '@/lib/auth/middleware';

export const dynamic = 'force-dynamic';

const assertionSchema = z.object({
  type: z.enum(['contains', 'not_contains', 'contains_any', 'matches_regex', 'not_matches_regex', 'tool_call']),
  value: z.string().optional(),
  values: z.array(z.string()).optional(),
  tool: z.string().optional(),
  mustCall: z.boolean().optional(),
  argsMustContain: z.array(z.string()).optional(),
  description: z.string().optional(),
});

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  systemPrompt: z.string().optional(),
  userPrompt: z.string().min(1),
  assertions: z.array(assertionSchema).min(1),
  enabled: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  return withSuperAdminAuth(request, async () => {
    const scenarios = await prisma.llmEvalScenario.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ success: true, data: scenarios });
  });
}

export async function POST(request: NextRequest) {
  return withSuperAdminAuth(request, async (req) => {
    try {
      const body = await req.json();
      const v = createSchema.parse(body);
      const created = await prisma.llmEvalScenario.create({
        data: {
          name: v.name,
          description: v.description,
          category: v.category,
          systemPrompt: v.systemPrompt,
          userPrompt: v.userPrompt,
          assertions: v.assertions as any,
          enabled: v.enabled ?? true,
        },
      });
      return NextResponse.json({ success: true, data: created }, { status: 201 });
    } catch (err: any) {
      if (err?.name === 'ZodError') {
        return NextResponse.json({ success: false, error: 'Validation failed', details: err.errors }, { status: 400 });
      }
      console.error('[LLM Eval Scenarios API]', err);
      return NextResponse.json({ success: false, error: err?.message || 'Internal error' }, { status: 500 });
    }
  });
}
