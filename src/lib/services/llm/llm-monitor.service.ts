/**
 * LLM Monitor Service
 * -------------------------------------------------------------
 * Records every LLM API call for the super-admin monitoring dashboard.
 * Writes are fire-and-forget: logging must never break a user-facing call.
 */

import { prisma } from '@/lib/prisma';

export type LlmFeature = 'chat' | 'vision' | 'blog' | 'json' | 'eval' | 'other';

export interface LlmCallRecord {
  provider: string;
  model: string;
  feature: LlmFeature;
  tenantId?: string | null;
  success: boolean;
  errorMessage?: string | null;
  finishReason?: string | null;
  latencyMs: number;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  metadata?: Record<string, any> | null;
}

/** Infer a coarse provider name from a base URL. */
export function providerFromBaseUrl(baseUrl?: string | null): string {
  const u = (baseUrl || '').toLowerCase();
  if (u.includes('nvidia')) return 'nvidia';
  if (u.includes('openrouter')) return 'openrouter';
  if (u.includes('deepseek')) return 'deepseek';
  if (u.includes('kimi')) return 'kimi';
  if (u.includes('stepfun')) return 'stepfun';
  if (u.includes('z.ai') || u.includes('bigmodel') || u.includes('glm')) return 'zai';
  if (u.includes('openai')) return 'openai';
  return 'custom';
}

/**
 * Persist an LLM call log. Never throws.
 */
export function recordLlmCall(record: LlmCallRecord): void {
  // Intentionally not awaited by callers; swallow all errors.
  prisma.llmCallLog
    .create({
      data: {
        provider: record.provider,
        model: record.model,
        feature: record.feature,
        tenantId: record.tenantId ?? null,
        success: record.success,
        errorMessage: record.errorMessage ?? null,
        finishReason: record.finishReason ?? null,
        latencyMs: Math.max(0, Math.round(record.latencyMs)),
        promptTokens: record.promptTokens ?? null,
        completionTokens: record.completionTokens ?? null,
        totalTokens: record.totalTokens ?? null,
        metadata: (record.metadata as any) ?? undefined,
      },
    })
    .catch((err) => {
      // Don't let monitoring failures surface to callers.
      console.error('[LlmMonitor] Failed to record LLM call:', err?.message);
    });
}

// ==================== AGGREGATION (dashboard) ====================

export interface MonitoringQuery {
  sinceHours?: number;
  provider?: string;
  feature?: string;
  tenantId?: string;
}

export async function getMonitoringStats(q: MonitoringQuery = {}) {
  const sinceHours = q.sinceHours ?? 24;
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);

  const where: any = { createdAt: { gte: since } };
  if (q.provider) where.provider = q.provider;
  if (q.feature) where.feature = q.feature;
  if (q.tenantId) where.tenantId = q.tenantId;

  const [total, succeeded, agg, byModel, byFeature, recentErrors, recent] = await Promise.all([
    prisma.llmCallLog.count({ where }),
    prisma.llmCallLog.count({ where: { ...where, success: true } }),
    prisma.llmCallLog.aggregate({
      where,
      _avg: { latencyMs: true, totalTokens: true },
      _sum: { totalTokens: true, promptTokens: true, completionTokens: true },
    }),
    prisma.llmCallLog.groupBy({
      by: ['provider', 'model'],
      where,
      _count: { _all: true },
      _avg: { latencyMs: true },
      _sum: { totalTokens: true },
    }),
    prisma.llmCallLog.groupBy({
      by: ['feature'],
      where,
      _count: { _all: true },
    }),
    prisma.llmCallLog.findMany({
      where: { ...where, success: false },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.llmCallLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ]);

  // p95 latency (approximate, computed in-app over recent window)
  const latencySample = await prisma.llmCallLog.findMany({
    where,
    select: { latencyMs: true },
    orderBy: { latencyMs: 'asc' },
    take: 1000,
  });
  const p95 =
    latencySample.length > 0
      ? latencySample[Math.min(latencySample.length - 1, Math.floor(latencySample.length * 0.95))].latencyMs
      : 0;

  return {
    windowHours: sinceHours,
    totals: {
      calls: total,
      succeeded,
      failed: total - succeeded,
      successRate: total > 0 ? succeeded / total : null,
      avgLatencyMs: Math.round(agg._avg.latencyMs || 0),
      p95LatencyMs: p95,
      totalTokens: agg._sum.totalTokens || 0,
      promptTokens: agg._sum.promptTokens || 0,
      completionTokens: agg._sum.completionTokens || 0,
    },
    byModel: byModel.map((m) => ({
      provider: m.provider,
      model: m.model,
      calls: m._count._all,
      avgLatencyMs: Math.round(m._avg.latencyMs || 0),
      totalTokens: m._sum.totalTokens || 0,
    })),
    byFeature: byFeature.map((f) => ({ feature: f.feature, calls: f._count._all })),
    recentErrors,
    recent,
  };
}
