/**
 * Super-admin LLM Endpoints API
 * GET  /api/v1/admin/llm/endpoints   - list (api keys masked)
 * POST /api/v1/admin/llm/endpoints   - create
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withSuperAdminAuth } from '@/lib/auth/middleware';

export const dynamic = 'force-dynamic';

const maskKey = (k: string) => (k.length <= 8 ? '****' : `${k.slice(0, 4)}…${k.slice(-4)}`);

const createSchema = z.object({
  name: z.string().min(1),
  provider: z.string().min(1),
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
  model: z.string().min(1),
  kind: z.enum(['text', 'vision']).optional(),
  enabled: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  return withSuperAdminAuth(request, async () => {
    const endpoints = await prisma.llmEndpoint.findMany({ orderBy: { createdAt: 'desc' } });
    // Never leak full API keys to the client.
    const masked = endpoints.map((e) => ({ ...e, apiKey: maskKey(e.apiKey) }));
    return NextResponse.json({ success: true, data: masked });
  });
}

export async function POST(request: NextRequest) {
  return withSuperAdminAuth(request, async (req) => {
    try {
      const v = createSchema.parse(await req.json());
      const created = await prisma.llmEndpoint.create({
        data: {
          name: v.name,
          provider: v.provider,
          baseUrl: v.baseUrl,
          apiKey: v.apiKey,
          model: v.model,
          kind: v.kind ?? 'text',
          enabled: v.enabled ?? true,
          isDefault: v.isDefault ?? false,
          notes: v.notes,
        },
      });
      return NextResponse.json({ success: true, data: { ...created, apiKey: maskKey(created.apiKey) } }, { status: 201 });
    } catch (err: any) {
      if (err?.name === 'ZodError') {
        return NextResponse.json({ success: false, error: 'Validation failed', details: err.errors }, { status: 400 });
      }
      if (err?.code === 'P2002') {
        return NextResponse.json({ success: false, error: 'Endpoint name already exists' }, { status: 409 });
      }
      console.error('[LLM Endpoints API]', err);
      return NextResponse.json({ success: false, error: err?.message || 'Internal error' }, { status: 500 });
    }
  });
}
