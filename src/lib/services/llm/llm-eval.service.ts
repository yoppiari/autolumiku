/**
 * LLM Eval Service
 * -------------------------------------------------------------
 * Runs evaluation scenarios (prompt + assertions) against an LLM
 * endpoint and scores the result. Mirrors the MotoVax /llm/eval idea.
 *
 * Assertion types:
 *   { type: "contains", value }            response text must contain value
 *   { type: "not_contains", value }        response text must NOT contain value
 *   { type: "contains_any", values: [] }   response must contain at least one
 *   { type: "matches_regex", value }       response matches regex
 *   { type: "not_matches_regex", value }   response does NOT match regex
 *   { type: "tool_call", tool, mustCall,   a tool must (or must not) be called;
 *           argsMustContain: [] }          optionally its args contain strings
 * All assertions accept an optional "description".
 */

import { prisma } from '@/lib/prisma';
import { ZAIClient } from '@/lib/ai/zai-client';
import { recordLlmCall, providerFromBaseUrl } from './llm-monitor.service';

export interface EvalAssertion {
  type: 'contains' | 'not_contains' | 'contains_any' | 'matches_regex' | 'not_matches_regex' | 'tool_call';
  value?: string;
  values?: string[];
  tool?: string;
  mustCall?: boolean;
  argsMustContain?: string[];
  description?: string;
}

export interface AssertionResult {
  description: string;
  passed: boolean;
  reason: string;
}

export interface RunScenarioInput {
  systemPrompt?: string | null;
  userPrompt: string;
  assertions: EvalAssertion[];
  scenarioId?: string;
  endpointId?: string;
}

function evaluateAssertion(
  a: EvalAssertion,
  responseText: string,
  toolCalls: Array<{ name: string; args: string }>
): AssertionResult {
  const text = responseText || '';
  const lower = text.toLowerCase();
  const desc = a.description || `${a.type} ${a.value || (a.values || []).join('|') || a.tool || ''}`.trim();

  const ok = (passed: boolean, reason: string): AssertionResult => ({ description: desc, passed, reason });

  switch (a.type) {
    case 'contains':
      return ok(lower.includes((a.value || '').toLowerCase()), `expected to contain "${a.value}"`);
    case 'not_contains':
      return ok(!lower.includes((a.value || '').toLowerCase()), `expected NOT to contain "${a.value}"`);
    case 'contains_any': {
      const hit = (a.values || []).some((v) => lower.includes(v.toLowerCase()));
      return ok(hit, `expected any of: ${(a.values || []).join(', ')}`);
    }
    case 'matches_regex': {
      try {
        return ok(new RegExp(a.value || '', 'i').test(text), `expected to match /${a.value}/i`);
      } catch (e: any) {
        return ok(false, `invalid regex: ${e?.message}`);
      }
    }
    case 'not_matches_regex': {
      try {
        return ok(!new RegExp(a.value || '', 'i').test(text), `expected NOT to match /${a.value}/i`);
      } catch (e: any) {
        return ok(false, `invalid regex: ${e?.message}`);
      }
    }
    case 'tool_call': {
      const matching = toolCalls.filter((t) => t.name === a.tool);
      const called = matching.length > 0;
      const mustCall = a.mustCall !== false; // default: must be called
      if (mustCall && !called) return ok(false, `expected tool "${a.tool}" to be called`);
      if (!mustCall && called) return ok(false, `expected tool "${a.tool}" NOT to be called`);
      if (mustCall && called && a.argsMustContain?.length) {
        const argsBlob = matching.map((m) => m.args).join(' ').toLowerCase();
        const missing = a.argsMustContain.filter((s) => !argsBlob.includes(s.toLowerCase()));
        if (missing.length) return ok(false, `tool args missing: ${missing.join(', ')}`);
      }
      return ok(true, `tool "${a.tool}" ${mustCall ? 'called' : 'not called'} as expected`);
    }
    default:
      return ok(false, `unknown assertion type: ${(a as any).type}`);
  }
}

/**
 * Build a client for a given endpoint id, or the default env client.
 */
async function buildClientForEndpoint(endpointId?: string): Promise<{ client: ZAIClient; provider: string; model: string }> {
  if (endpointId) {
    const ep = await prisma.llmEndpoint.findUnique({ where: { id: endpointId } });
    if (!ep) throw new Error(`Endpoint ${endpointId} not found`);
    if (!ep.enabled) throw new Error(`Endpoint ${ep.name} is disabled`);
    const baseURL = ep.baseUrl.endsWith('/') ? ep.baseUrl : ep.baseUrl + '/';
    return {
      client: new ZAIClient({ apiKey: ep.apiKey, baseURL, textModel: ep.model, visionModel: ep.model }),
      provider: ep.provider || providerFromBaseUrl(ep.baseUrl),
      model: ep.model,
    };
  }
  // Default from env (the active provider configured in .env)
  const apiKey = process.env.ZAI_API_KEY || '';
  const baseURL = process.env.ZAI_BASE_URL || '';
  if (!apiKey || !baseURL) throw new Error('No endpoint specified and default LLM env not configured');
  const model = process.env.ZAI_TEXT_MODEL || 'glm-4.6';
  return {
    client: new ZAIClient({ apiKey, baseURL, textModel: model, visionModel: model }),
    provider: providerFromBaseUrl(baseURL),
    model,
  };
}

/**
 * Run a single scenario and persist an LlmEvalRun. Never throws — failures
 * are captured as status "error".
 */
export async function runScenario(input: RunScenarioInput) {
  const assertions = Array.isArray(input.assertions) ? input.assertions : [];
  const start = Date.now();

  let provider = 'unknown';
  let model = 'unknown';
  let responseText = '';
  let toolCalls: Array<{ name: string; args: string }> = [];
  let errorMessage: string | null = null;

  try {
    const built = await buildClientForEndpoint(input.endpointId);
    provider = built.provider;
    model = built.model;

    const res = await built.client.generateText({
      systemPrompt: input.systemPrompt || 'You are a helpful assistant.',
      userPrompt: input.userPrompt,
      includeTools: true,
    });
    responseText = res.content || '';
    toolCalls = (res.toolCalls || []).map((tc: any) => ({
      name: tc.function?.name || '',
      args: tc.function?.arguments || '',
    }));
  } catch (err: any) {
    errorMessage = err?.message || String(err);
  }

  const latencyMs = Date.now() - start;

  // Evaluate assertions (only meaningful if the call succeeded)
  const assertionResults: AssertionResult[] = errorMessage
    ? []
    : assertions.map((a) => evaluateAssertion(a, responseText, toolCalls));

  const total = assertionResults.length;
  const passedCount = assertionResults.filter((r) => r.passed).length;
  const allPassed = !errorMessage && total > 0 && passedCount === total;
  const status = errorMessage ? 'error' : allPassed ? 'passed' : 'failed';

  const run = await prisma.llmEvalRun.create({
    data: {
      scenarioId: input.scenarioId ?? null,
      endpointId: input.endpointId ?? null,
      provider,
      model,
      status,
      passed: allPassed,
      score: total > 0 ? passedCount / total : null,
      totalAssertions: total,
      passedAssertions: passedCount,
      responseText: responseText || null,
      latencyMs,
      errorMessage,
      details: { assertions: assertionResults, toolCalls } as any,
    },
  });

  // Also record in the monitoring stream tagged as an eval call.
  recordLlmCall({
    provider,
    model,
    feature: 'eval',
    success: !errorMessage,
    errorMessage,
    latencyMs,
    metadata: { scenarioId: input.scenarioId, status },
  });

  return run;
}

/** Run all enabled scenarios against an (optional) endpoint. */
export async function runAllScenarios(endpointId?: string) {
  const scenarios = await prisma.llmEvalScenario.findMany({ where: { enabled: true } });
  const runs = [];
  for (const s of scenarios) {
    const run = await runScenario({
      systemPrompt: s.systemPrompt,
      userPrompt: s.userPrompt,
      assertions: (s.assertions as any) || [],
      scenarioId: s.id,
      endpointId,
    });
    runs.push(run);
  }
  return runs;
}
