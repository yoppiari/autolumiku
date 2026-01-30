'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import { ROLE_LEVELS } from '@/lib/rbac';

interface ReportDetailData {
    id: string;
    name: string;
    icon: string;
    formula: string;
    analysis: string[];
    recommendations: string[];
    metrics: { label: string; value: string | number; color?: string }[];
    chartType: 'pie' | 'bar' | 'line' | 'donut';
    chartData: { label: string; value: number; color: string }[];
}

export default function ReportDetailPage() {
    const params = useParams();
    const router = useRouter();
    const reportId = params.id as string;

    const [isLoading, setIsLoading] = useState(true);
    const [report, setReport] = useState<ReportDetailData | null>(null);
    const [tenantId, setTenantId] = useState<string>('');

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try {
                const user = JSON.parse(storedUser);
                if (user.tenantId) setTenantId(user.tenantId);
            } catch (e) {
                console.error('Failed to parse user from localStorage');
            }
        }
    }, []);

    useEffect(() => {
        const fetchReportData = async () => {
            if (!reportId || !tenantId) return;
            setIsLoading(true);
            try {
                const result = await api.get(`/api/v1/analytics/reports/${reportId}?tenantId=${tenantId}`);
                if (result.success) {
                    setReport(result.data);
                } else {
                    console.error('Report fetch failed:', result.error);
                }
            } catch (error) {
                console.error('Failed to fetch report data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchReportData();
    }, [reportId, tenantId]);

    if (isLoading) {
        return (
            <div className="p-6 flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-3 text-gray-600">Generating detailed analysis...</p>
                </div>
            </div>
        );
    }

    if (!report) {
        return (
            <div className="p-6 text-center">
                <h2 className="text-xl font-bold text-gray-800">Report Not Found</h2>
                <p className="text-gray-500 mt-2 mb-6">Maaf, laporan yang Anda cari tidak tersedia atau terjadi kesalahan saat memuat data.</p>
                <Link href="/dashboard/whatsapp-ai/analytics" className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-md">
                    Return to Analytics
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen !bg-[#1a1a1a] p-4 md:p-8" style={{ backgroundColor: '#1a1a1a', minHeight: '100vh', colorScheme: 'dark' }}>
            <div className="max-w-6xl mx-auto">
                {/* Breadcrumbs */}
                <nav className="flex mb-6 text-sm text-gray-400 gap-2">
                    <Link
                        href={`/dashboard/whatsapp-ai/analytics?tab=${report?.id.startsWith('sales') || report?.id === 'one-page-sales' || report?.id === 'total-sales' || report?.id === 'sales-trends' || report?.id === 'sales-summary' || report?.id === 'sales-metrics' || report?.id === 'sales-report' ? 'sales' : 'whatsapp'}`}
                        className="hover:text-gray-300 transition-colors"
                    >
                        Analytics
                    </Link>
                    <span>/</span>
                    <span className="text-gray-200 font-medium">Report Detail</span>
                </nav>

                {/* Header Card */}
                <div className="bg-[#2a2a2a] rounded-2xl border border-gray-700/50 p-6 md:p-8 mb-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5 text-8xl pointer-events-none">
                        {report.icon}
                    </div>

                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-14 h-14 bg-[#3a3a4a] rounded-xl flex items-center justify-center text-3xl flex-shrink-0">
                            {report.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h1 className="text-xl md:text-2xl font-bold text-white break-words">{report.name}</h1>
                            <p className="text-gray-400 text-sm">Comprehensive Analytics Detail</p>
                        </div>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 gap-3 md:gap-4">
                        {report?.metrics?.map((m, i) => (
                            <div key={i} className="bg-[#242430] rounded-xl p-3 md:p-4 border border-gray-700/30 overflow-hidden">
                                <p className="text-[9px] md:text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1 truncate">
                                    {m.label}
                                </p>
                                <p className={`text-base md:text-xl font-bold break-words ${m.color || 'text-white'}`} style={{
                                    wordBreak: 'break-word',
                                    overflowWrap: 'break-word',
                                    hyphens: 'auto'
                                }}>
                                    {m.value}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column: Visuals */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Chart Section */}
                        <div className="bg-[#2a2a2a] rounded-2xl border border-gray-700/50 p-6">
                            <h3 className="text-base md:text-lg font-bold text-white mb-6 flex items-center gap-2">
                                <span>📊</span> Data Visualization
                            </h3>

                            <div className="flex flex-col items-center gap-6 py-2">
                                {report.chartType === 'bar' ? (
                                    <div className="w-full space-y-5">
                                        {report?.chartData?.map((item, i) => (
                                            <div key={i} className="space-y-2">
                                                <div className="flex justify-between text-sm font-semibold text-gray-300">
                                                    <span className="truncate pr-2">{item.label}</span>
                                                    <span className="flex-shrink-0">{item.value}%</span>
                                                </div>
                                                <div className="w-full bg-[#1a1a1a] rounded-full h-3 overflow-hidden border border-gray-700/50">
                                                    <div
                                                        className="h-full rounded-full transition-all duration-1000 ease-out"
                                                        style={{
                                                            width: `${item.value}%`,
                                                            backgroundColor: item.color,
                                                            boxShadow: `0 0 8px ${item.color}60`
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                        {(!report?.chartData || report.chartData.length === 0) && (
                                            <div className="h-32 flex items-center justify-center text-gray-500 italic text-sm">
                                                No Sales
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex flex-col md:flex-row items-center gap-6 w-full">
                                        {/* Donut Chart */}
                                        <div className="relative w-40 h-40 md:w-48 md:h-48 flex-shrink-0">
                                            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                                                <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#2a2a2a" strokeWidth="3.5" />
                                                {(() => {
                                                    let accumulatedPercent = 0;
                                                    const hasData = report.chartData.some(d => d.value > 0);

                                                    if (!hasData) return null;

                                                    return report.chartData.map((segment, idx) => {
                                                        const val = Number(segment.value) || 0;
                                                        const length = (val / 100) * 100;
                                                        const dashArray = `${length} ${100 - length}`;
                                                        const offset = 100 - accumulatedPercent;
                                                        accumulatedPercent += length;
                                                        return (
                                                            <circle
                                                                key={idx}
                                                                cx="18" cy="18" r="15.9155"
                                                                fill="none"
                                                                stroke={segment.color}
                                                                strokeWidth="3.5"
                                                                strokeDasharray={dashArray}
                                                                strokeDashoffset={offset}
                                                                strokeLinecap="round"
                                                            />
                                                        );
                                                    });
                                                })()}
                                            </svg>
                                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                <span className="text-3xl md:text-4xl font-bold text-white">
                                                    {report.chartData.some(d => d.value > 0) ? '100%' : '0%'}
                                                </span>
                                                <span className="text-[9px] text-gray-400 uppercase font-semibold tracking-wider text-center mt-1">
                                                    Total Share
                                                </span>
                                            </div>
                                        </div>

                                        {/* Legend */}
                                        <div className="flex-1 space-y-3 w-full">
                                            {report?.chartData?.map((item, i) => (
                                                <div key={i} className="flex items-center justify-between p-2 hover:bg-[#242430] rounded-lg transition-colors">
                                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                                                        <span className="text-sm font-medium text-gray-300 truncate">{item.label}</span>
                                                    </div>
                                                    <span className="text-sm font-bold text-white ml-2 flex-shrink-0">{item.value}%</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Analysis Section */}
                        <div className="bg-[#2a2a2a] rounded-2xl border border-gray-700/50 p-6">
                            <h3 className="text-base md:text-lg font-bold text-white mb-6 flex items-center gap-2">
                                <span>🧐</span> Deep Analysis
                            </h3>
                            <div className="space-y-3">
                                {report?.analysis?.map((point, i) => (
                                    <div key={i} className="flex gap-3 items-start p-3 bg-[#242430] rounded-xl border-l-4 border-indigo-500">
                                        <span className="w-5 h-5 bg-indigo-500/20 rounded-full flex items-center justify-center text-xs font-bold text-indigo-400 flex-shrink-0 mt-0.5">
                                            {i + 1}
                                        </span>
                                        <p className="text-sm text-gray-300 leading-relaxed break-words">{point}</p>
                                    </div>
                                ))}
                                {(!report?.analysis || report.analysis.length === 0) && (
                                    <p className="text-gray-500 italic text-sm p-3">Analisis mendalam belum tersedia untuk periode ini.</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-6">
                        {/* Formula Section */}
                        {report.formula && (
                            <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl p-6 text-white overflow-hidden relative">
                                <div className="absolute -bottom-4 -right-4 opacity-10 text-7xl font-black italic">f(x)</div>
                                <h3 className="text-base md:text-lg font-bold mb-4 flex items-center gap-2 relative z-10">
                                    <span>🧮</span> Metodologi & Rumus
                                </h3>
                                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20 relative z-10">
                                    <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed break-words" style={{
                                        wordBreak: 'break-word',
                                        overflowWrap: 'break-word'
                                    }}>
                                        {report.formula}
                                    </pre>
                                </div>
                                <p className="text-[9px] mt-3 opacity-70 italic relative z-10">Calculated using Prima Mobil advanced analytics engine.</p>
                            </div>
                        )}

                        {/* Recommendations Section */}
                        {report.recommendations && report.recommendations.length > 0 && (
                            <div className="bg-[#2a2a2a] rounded-2xl border border-gray-700/50 p-6">
                                <h3 className="text-base md:text-lg font-bold text-white mb-6 flex items-center gap-2">
                                    <span className="text-green-400">⚡</span> Strategic Recommendations
                                </h3>
                                <div className="space-y-3">
                                    {report.recommendations.map((rec, i) => (
                                        <div key={i} className="flex gap-3 items-start group">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-400 mt-2 flex-shrink-0 group-hover:scale-125 transition-transform" />
                                            <p className="text-sm text-gray-300 leading-relaxed break-words">{rec}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
