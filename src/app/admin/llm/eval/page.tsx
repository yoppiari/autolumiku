/**
 * LLM Eval Dashboard (Super Admin)
 * Define behavior scenarios with assertions, run them against the active LLM,
 * and review pass/fail results. Inspired by MotoVax /llm/eval.
 */
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';

interface Scenario {
  id: string;
  name: string;
  category?: string;
  userPrompt: string;
  assertions: any[];
  enabled: boolean;
}
interface Run {
  id: string;
  provider: string;
  model: string;
  status: string;
  passed: boolean;
  score: number | null;
  totalAssertions: number;
  passedAssertions: number;
  latencyMs: number;
  errorMessage?: string | null;
  responseText?: string | null;
  details?: any;
  createdAt: string;
  scenario?: { name: string; category?: string } | null;
}

const statusColor = (s: string) =>
  s === 'passed' ? 'bg-green-100 text-green-800' : s === 'failed' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800';

export default function LlmEvalPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // New scenario form
  const [form, setForm] = useState({ name: '', category: '', userPrompt: '', assertions: '[\n  { "type": "contains", "value": "" }\n]' });

  const load = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([
        api.get('/api/v1/admin/llm/eval/scenarios'),
        api.get('/api/v1/admin/llm/eval/runs?limit=50'),
      ]);
      if (s.success) setScenarios(s.data);
      if (r.success) setRuns(r.data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const runOne = async (scenarioId: string) => {
    setBusy(scenarioId);
    setError(null);
    try {
      await api.post('/api/v1/admin/llm/eval/run', { scenarioId });
      await load();
    } catch (e: any) {
      setError(e?.message || 'Run failed');
    } finally {
      setBusy(null);
    }
  };

  const runAll = async () => {
    setBusy('all');
    setError(null);
    try {
      await api.post('/api/v1/admin/llm/eval/run', { all: true });
      await load();
    } catch (e: any) {
      setError(e?.message || 'Run failed');
    } finally {
      setBusy(null);
    }
  };

  const createScenario = async () => {
    setError(null);
    let assertions;
    try {
      assertions = JSON.parse(form.assertions);
    } catch {
      setError('Assertions harus JSON array yang valid');
      return;
    }
    setBusy('create');
    try {
      const res = await api.post('/api/v1/admin/llm/eval/scenarios', {
        name: form.name,
        category: form.category || undefined,
        userPrompt: form.userPrompt,
        assertions,
      });
      if (res.success) {
        setForm({ name: '', category: '', userPrompt: '', assertions: '[\n  { "type": "contains", "value": "" }\n]' });
        await load();
      } else setError(res.error || 'Create failed');
    } catch (e: any) {
      setError(e?.message || 'Create failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">LLM Eval</h1>
          <p className="text-sm text-gray-500">Uji perilaku AI dengan skenario + assertion (contains / regex / tool_call)</p>
        </div>
        <button onClick={runAll} disabled={busy === 'all'} className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {busy === 'all' ? 'Menjalankan…' : '▶ Jalankan Semua'}
        </button>
      </div>

      {error && <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Scenarios */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-3 font-semibold text-gray-900">Skenario ({scenarios.length})</h2>
          <div className="space-y-2">
            {scenarios.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded border border-gray-100 p-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-gray-900">{s.name}</div>
                  <div className="truncate text-xs text-gray-400">{s.category || 'umum'} · {s.assertions?.length || 0} assertion</div>
                </div>
                <button onClick={() => runOne(s.id)} disabled={busy === s.id} className="ml-2 shrink-0 rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50">
                  {busy === s.id ? '…' : 'Run'}
                </button>
              </div>
            ))}
            {scenarios.length === 0 && <div className="text-sm text-gray-400">Belum ada skenario. Buat di bawah.</div>}
          </div>

          {/* Create form */}
          <div className="mt-4 border-t border-gray-100 pt-4">
            <h3 className="mb-2 text-sm font-semibold text-gray-700">Buat Skenario</h3>
            <div className="space-y-2">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nama" className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm" />
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Kategori (opsional)" className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm" />
              <textarea value={form.userPrompt} onChange={(e) => setForm({ ...form, userPrompt: e.target.value })} placeholder="User prompt, mis: 'Ada Avanza matic budget 150 juta?'" rows={2} className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm" />
              <textarea value={form.assertions} onChange={(e) => setForm({ ...form, assertions: e.target.value })} rows={4} className="w-full rounded border border-gray-300 px-3 py-1.5 font-mono text-xs" />
              <button onClick={createScenario} disabled={busy === 'create' || !form.name || !form.userPrompt} className="rounded bg-green-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">
                + Tambah
              </button>
            </div>
          </div>
        </div>

        {/* Runs */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-3 font-semibold text-gray-900">Hasil Run Terbaru</h2>
          <div className="space-y-2">
            {runs.map((r) => (
              <div key={r.id} className="rounded border border-gray-100 p-2">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-gray-900">{r.scenario?.name || '(ad-hoc)'}</div>
                    <div className="truncate text-xs text-gray-400">{r.provider}/{r.model} · {r.latencyMs}ms · {new Date(r.createdAt).toLocaleString('id-ID')}</div>
                  </div>
                  <span className={`ml-2 shrink-0 rounded px-2 py-0.5 text-xs font-medium ${statusColor(r.status)}`}>
                    {r.status} {r.totalAssertions > 0 && `${r.passedAssertions}/${r.totalAssertions}`}
                  </span>
                </div>
                <button onClick={() => setExpanded(expanded === r.id ? null : r.id)} className="mt-1 text-xs text-blue-600">
                  {expanded === r.id ? 'Sembunyikan' : 'Detail'}
                </button>
                {expanded === r.id && (
                  <div className="mt-2 space-y-1 border-t border-gray-100 pt-2 text-xs">
                    {r.errorMessage && <div className="rounded bg-red-50 p-1.5 text-red-700">{r.errorMessage}</div>}
                    {(r.details?.assertions || []).map((a: any, i: number) => (
                      <div key={i} className={a.passed ? 'text-green-700' : 'text-red-700'}>
                        {a.passed ? '✓' : '✗'} {a.description} <span className="text-gray-400">— {a.reason}</span>
                      </div>
                    ))}
                    {r.responseText && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-gray-500">Response</summary>
                        <pre className="mt-1 whitespace-pre-wrap rounded bg-gray-50 p-2 text-gray-700">{r.responseText}</pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
            ))}
            {runs.length === 0 && <div className="text-sm text-gray-400">Belum ada run.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
