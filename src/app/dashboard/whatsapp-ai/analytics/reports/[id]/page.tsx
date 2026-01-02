'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
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

    useEffect(() => {
        // Fetch report data from API
        const fetchReportData = async () => {
            setIsLoading(true);
            try {
                let url = `/api/v1/analytics/reports/${reportId}`;
                const storedUser = localStorage.getItem('user');
                const token = localStorage.getItem('token');

                if (storedUser) {
                    const user = JSON.parse(storedUser);
                    if (user.tenantId) {
                        url += `?tenantId=${user.tenantId}`;
                    }
                }

                const headers: HeadersInit = {
                    'Content-Type': 'application/json',
                };

                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }

                const response = await fetch(url, { headers });
                if (response.ok) {
                    const result = await response.json();
                    if (result.success) {
                        setReport(result.data);
                    }
                } else {
                    console.error('Report fetch failed:', response.status);
                }
            } catch (error) {
                console.error('Failed to fetch report data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        if (reportId) {
            fetchReportData();
        }
    }, [reportId]);

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
                <h2 className="text-xl font-bold">Report not found</h2>
                <Link href="/dashboard/whatsapp-ai/analytics?tab=reports" className="text-blue-600 mt-4 inline-block">
                    Return to Dashboard
                </Link>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 max-w-6xl mx-auto">
            {/* Breadcrumbs */}
            <nav className="flex mb-6 text-sm text-gray-500 gap-2">
                <Link href="/dashboard/whatsapp-ai/analytics?tab=reports" className="hover:text-indigo-600">Analytics</Link>
                <span>/</span>
                <span className="text-gray-900 font-medium">Report Detail</span>
            </nav>

            {/* Header */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 mb-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10 text-8xl pointer-events-none">
                    {report.icon}
                </div>

                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-3xl shadow-inner">
                        {report.icon}
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-gray-900">{report.name}</h1>
                        <p className="text-gray-500 font-medium">Comprehensive Analytics Detail</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                    {report.metrics.map((m, i) => (
                        <div key={i} className="bg-gray-50 rounded-xl p-4 border border-gray-100 transition-hover hover:border-indigo-200">
                            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">{m.label}</p>
                            <p className={`text-xl font-black ${m.color || 'text-gray-900'}`}>{m.value}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Analysis & Visuals */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Chart/Visual Section */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                            <span className="text-indigo-600">📊</span> Data Visualization
                        </h3>

                        <div className="flex flex-col md:flex-row items-center gap-8 py-4">
                            {/* Simplified Pie/Donut Chart Component */}
                            <div className="relative w-48 h-48 md:w-64 md:h-64 flex-shrink-0">
                                <svg className="w-full h-full" viewBox="0 0 36 36">
                                    <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#f3f4f6" strokeWidth="4" />
                                    {(() => {
                                        let accumulatedPercent = 0;
                                        return report.chartData.map((segment, idx) => {
                                            const length = (segment.value / 100) * 100;
                                            const dashArray = `${length} ${100 - length}`;
                                            const offset = 100 - accumulatedPercent;
                                            accumulatedPercent += length;
                                            return (
                                                <circle
                                                    key={idx}
                                                    cx="18" cy="18" r="15.9155"
                                                    fill="none"
                                                    stroke={segment.color}
                                                    strokeWidth="4"
                                                    strokeDasharray={dashArray}
                                                    strokeDashoffset={offset}
                                                    strokeLinecap="round"
                                                    transform="rotate(-90 18 18)"
                                                />
                                            );
                                        });
                                    })()}
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-3xl font-black text-gray-900">100%</span>
                                    <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Total Share</span>
                                </div>
                            </div>

                            {/* Legend */}
                            <div className="flex-1 space-y-4 w-full">
                                {report.chartData.map((item, i) => (
                                    <div key={i} className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                            <span className="text-sm font-semibold text-gray-700">{item.label}</span>
                                        </div>
                                        <span className="text-sm font-black text-gray-900">{item.value}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Detailed Analysis Section */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                            <span className="text-indigo-600">🧐</span> Deep Analysis
                        </h3>
                        <div className="space-y-4">
                            {report.analysis.map((point, i) => (
                                <div key={i} className="flex gap-4 items-start p-4 bg-gray-50 rounded-xl border-l-4 border-indigo-500">
                                    <span className="w-6 h-6 bg-white rounded-full flex items-center justify-center text-xs font-bold text-indigo-600 shadow-sm border border-indigo-50 flex-shrink-0">
                                        {i + 1}
                                    </span>
                                    <p className="text-sm text-gray-700 leading-relaxed font-medium">{point}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column: Formulas & Recommendations */}
                <div className="space-y-8">
                    {/* Formula Section */}
                    {report.formula && (
                        <div className="bg-indigo-600 rounded-2xl shadow-lg p-6 text-white overflow-hidden relative">
                            <div className="absolute -bottom-4 -right-4 opacity-10 text-8xl font-black italic">f(x)</div>
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <span>🧮</span> Metodologi & Rumus
                            </h3>
                            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                                <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed py-2">
                                    {report.formula}
                                </pre>
                            </div>
                            <p className="text-[10px] mt-4 opacity-70 italic">Calculated using Prima Mobil advanced analytics engine.</p>
                        </div>
                    )}

                    {/* Recommendations Section */}
                    {report.recommendations && report.recommendations.length > 0 && (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                                <span className="text-green-500">⚡</span> Strategic Recommendations
                            </h3>
                            <div className="space-y-4">
                                {report.recommendations.map((rec, i) => (
                                    <div key={i} className="flex gap-3 items-start group">
                                        <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0 group-hover:scale-125 transition-transform" />
                                        <p className="text-sm text-gray-600 font-medium leading-relaxed">{rec}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
