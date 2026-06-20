/**
 * LLM Monitoring Dashboard (Super Admin)
 * Observability for every LLM call: volume, success rate, latency, tokens, errors.
 */
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';

interface Stats {
  windowHours: number;
  totals: {
    calls: number;
    succeeded: number;
    failed: number;
    successRate: number | null;
    avgLatencyMs: number;
    p95LatencyMs: number;
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
  };
  byModel: { provider: string; model: string; calls: number; avgLatencyMs: number; totalTokens: number }[];
  byFeature: { feature: string; calls: number }[];
  recentErrors: any[];
  recent: any[];
}

const fmt = (n: number) => n.toLocaleString('id-ID');
const pct = (n: number | null) => (n === null ? '—' : `${(n * 100).toFixed(1)}%`);

export default function LlmMonitoringPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [hours, setHours] = useState(24);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);
      const res = await api.get(`/api/v1/admin/llm/monitoring?hours=${hours}`);
      if (res.success) setStats(res.data);
      else setError(res.error || 'Failed to load');
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [hours]);

  useEffect(() => {
    fetchStats();
    const id = setInterval(() => fetchStats(false), 15000);
    return () => clearInterval(id);
  }, [fetchStats]);

  const Card = ({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) => (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-gray-900">{value}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">LLM Monitoring</h1>
          <p className="text-sm text-gray-500">Observability untuk semua panggilan LLM (auto-refresh 15s)</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value={1}>1 jam</option>
            <option value={24}>24 jam</option>
            <option value={168}>7 hari</option>
            <option value={720}>30 hari</option>
          </select>
          <button onClick={() => fetchStats()} className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white">
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {loading && !stats && <div className="text-gray-500">Memuat…</div>}

      {stats && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Card label="Total Calls" value={fmt(stats.totals.calls)} />
            <Card label="Success Rate" value={pct(stats.totals.successRate)} sub={`${fmt(stats.totals.failed)} gagal`} />
            <Card label="Avg Latency" value={`${fmt(stats.totals.avgLatencyMs)} ms`} sub={`p95 ${fmt(stats.totals.p95LatencyMs)} ms`} />
            <Card label="Total Tokens" value={fmt(stats.totals.totalTokens)} sub={`${fmt(stats.totals.promptTokens)} in / ${fmt(stats.totals.completionTokens)} out`} />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h2 className="mb-3 font-semibold text-gray-900">Per Model</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="pb-2">Provider/Model</th>
                    <th className="pb-2 text-right">Calls</th>
                    <th className="pb-2 text-right">Avg ms</th>
                    <th className="pb-2 text-right">Tokens</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.byModel.map((m, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="py-2"><span className="text-gray-400">{m.provider}</span> / {m.model}</td>
                      <td className="py-2 text-right">{fmt(m.calls)}</td>
                      <td className="py-2 text-right">{fmt(m.avgLatencyMs)}</td>
                      <td className="py-2 text-right">{fmt(m.totalTokens)}</td>
                    </tr>
                  ))}
                  {stats.byModel.length === 0 && <tr><td colSpan={4} className="py-3 text-gray-400">Belum ada data</td></tr>}
                </tbody>
              </table>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h2 className="mb-3 font-semibold text-gray-900">Per Fitur</h2>
              <div className="space-y-2">
                {stats.byFeature.map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="rounded bg-gray-100 px-2 py-0.5 font-medium text-gray-700">{f.feature}</span>
                    <span className="text-gray-900">{fmt(f.calls)}</span>
                  </div>
                ))}
                {stats.byFeature.length === 0 && <div className="text-gray-400">Belum ada data</div>}
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-3 font-semibold text-gray-900">Error Terbaru</h2>
            <div className="space-y-2">
              {stats.recentErrors.map((e: any) => (
                <div key={e.id} className="rounded bg-red-50 p-2 text-xs text-red-800">
                  <span className="font-mono">{new Date(e.createdAt).toLocaleString('id-ID')}</span> · {e.provider}/{e.model} · {e.feature} —{' '}
                  {e.errorMessage || 'unknown error'}
                </div>
              ))}
              {stats.recentErrors.length === 0 && <div className="text-sm text-gray-400">Tidak ada error 🎉</div>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
