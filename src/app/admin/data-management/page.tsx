'use client';

import Link from 'next/link';

export default function DataManagementPage() {
    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                <div>
                    <h2 className="text-2xl font-bold text-white">Data Management</h2>
                    <p className="text-sm text-gray-300 mt-1">
                        Manage data sources, scrapers, and system data
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Vehicle Scraper Card */}
                <Link
                    href="/admin/data-management/scraper"
                    className="block group"
                >
                    <div className="bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 p-6 hover:bg-white/10 transition-all duration-200 h-full">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-cyan-500/20 rounded-lg group-hover:bg-cyan-500/30 transition-colors">
                                <span className="text-2xl">🤖</span>
                            </div>
                            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-500/20 text-green-300 border border-green-500/30">
                                Active
                            </span>
                        </div>

                        <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-cyan-300">
                            Vehicle Scraper
                        </h3>
                        <p className="text-sm text-gray-400">
                            Automated scraping tool for gathering vehicle data from multiple sources (OLX, Carsome, etc.) enriched with AI.
                        </p>
                    </div>
                </Link>

                {/* Placeholder for Future Tools */}
                <div className="bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 p-6 opacity-60">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-gray-500/20 rounded-lg">
                            <span className="text-2xl">📥</span>
                        </div>
                        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-500/20 text-gray-400 border border-gray-500/30">
                            Coming Soon
                        </span>
                    </div>

                    <h3 className="text-lg font-semibold text-gray-300 mb-2">
                        Data Import/Export
                    </h3>
                    <p className="text-sm text-gray-500">
                        Bulk import and export capabilities for vehicle and user data.
                    </p>
                </div>
            </div>
        </div>
    );
}
