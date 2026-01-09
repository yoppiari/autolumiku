'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api-client';

interface Stats {
  lastRun: string | null;
  totalVehicles: number;
  pendingReview: number;
  todayImported: number;
}

interface Job {
  id: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  vehiclesFound: number;
  vehiclesNew: number;
  duplicates: number;
  source: string;
}

export default function ScraperDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<'OLX' | 'CARSOME' | 'MOBIL123' | 'SEVA' | 'CARMUDI' | 'OTO' | 'CAROLINE' | 'AUTO2000' | 'MOBIL88' | 'CARRO' | 'OLX_AUTOS' | 'ALL'>('ALL');

  useEffect(() => {
    loadData();

    // Auto-refresh every 5 seconds to show live progress of running jobs
    const interval = setInterval(() => {
      loadData();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [statsData, jobsData] = await Promise.all([
        api.get('/api/admin/scraper/stats'),
        api.get('/api/admin/scraper/jobs?pageSize=10'),
      ]);

      setStats(statsData.data?.stats || null);
      setJobs(jobsData.data?.jobs || []);
      setError(null);
    } catch (error) {
      console.error('Failed to load data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load data');
      setStats(null);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  const runScraper = async () => {
    const sourceLabel = selectedSource === 'ALL' ? 'All Sources' : selectedSource;
    const estimatedTime = selectedSource === 'ALL' ? '4-5' : '2-3';

    if (!confirm(`Run ${sourceLabel} scraper? This will take ${estimatedTime} minutes.`)) return;

    setIsRunning(true);
    try {
      const data = await api.post('/api/admin/scraper/run', {
        source: selectedSource,
        targetCount: 50,
      });

      if (data.success) {
        // Fix: Use correct ID path from API wrapper
        const jobId = data.data?.job?.id || 'unknown';
        alert(`Scraper started! Job ID: ${jobId}\nSource: ${sourceLabel}`);
        loadData();
      }
    } catch (error) {
      alert('Failed to start scraper');
    } finally {
      setIsRunning(false);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  if (error) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-red-800 mb-2">Database Setup Required</h2>
          <p className="text-red-700 mb-4">{error}</p>
          <div className="bg-white rounded p-4 border border-red-200">
            <p className="font-medium text-gray-900 mb-2">Please run the following command:</p>
            <code className="block bg-gray-100 p-3 rounded text-sm">
              npx prisma migrate dev --name add_scraper_tables
            </code>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Vehicle Data Scraper</h1>
        <div className="flex gap-4 items-center">
          {/* Source Selector */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Source:</label>
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isRunning}
            >
              <option value="ALL">🌐 All Sources</option>
              <option disabled>──────────</option>
              <option value="OLX_AUTOS">🟠 OLX Autos (AI Powered)</option>
              <option value="MOBIL123">🔴 Mobil123 (AI Powered)</option>
              <option value="CARSOME">🔵 Carsome</option>
              <option value="SEVA">🟢 Seva.id</option>
              <option value="CARMUDI">🟤 Carmudi</option>
              <option value="OTO">⚪ Oto.com</option>
              <option value="CAROLINE">🟡 Caroline.id</option>
              <option value="AUTO2000">🟦 Auto2000</option>
              <option value="MOBIL88">🟥 Mobil88</option>
              <option value="CARRO">🟧 Carro</option>
            </select>
          </div>
          <button
            onClick={runScraper}
            disabled={isRunning}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {isRunning ? '⏳ Running...' : '▶ Start New Job'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="p-6 bg-gradient-to-br from-purple-500 to-purple-700 text-white rounded-lg shadow">
          <div className="text-3xl font-bold">{stats?.lastRun ? new Date(stats.lastRun).toLocaleDateString() : 'Never'}</div>
          <div className="text-sm opacity-90">Last Run</div>
        </div>
        <div className="p-6 bg-gradient-to-br from-green-500 to-green-700 text-white rounded-lg shadow">
          <div className="text-3xl font-bold">{stats?.totalVehicles || 0}</div>
          <div className="text-sm opacity-90">Total Vehicles</div>
        </div>
        <div className="p-6 bg-gradient-to-br from-orange-500 to-orange-700 text-white rounded-lg shadow">
          <div className="text-3xl font-bold">{stats?.pendingReview || 0}</div>
          <div className="text-sm opacity-90">Pending Review</div>
        </div>
        <div className="p-6 bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-lg shadow">
          <div className="text-3xl font-bold">{stats?.todayImported || 0}</div>
          <div className="text-sm opacity-90">Imported Today</div>
        </div>
      </div>

      {/* Recent Jobs */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <h2 className="text-xl font-semibold">Recent Jobs</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Found</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">New</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duplicates</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {new Date(job.startedAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${job.status === 'completed' ? 'bg-green-100 text-green-800' :
                      job.status === 'running' ? 'bg-blue-100 text-blue-800' :
                        job.status === 'failed' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                      }`}>
                      {job.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{job.source}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{job.vehiclesFound}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{job.vehiclesNew}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{job.duplicates}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {job.status === 'completed' && (
                      <Link
                        href={`/admin/data-management/scraper/results/${job.id}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        View Results →
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
