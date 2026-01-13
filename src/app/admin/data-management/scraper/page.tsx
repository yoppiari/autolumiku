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
  const [filterSource, setFilterSource] = useState('ALL');

  useEffect(() => {
    loadData();

    // Auto-refresh every 5 seconds to show live progress of running jobs
    const interval = setInterval(() => {
      loadData();
    }, 5000);

    return () => clearInterval(interval);
  }, [filterSource]);

  const loadData = async () => {
    try {
      const filterQuery = filterSource !== 'ALL' ? `&source=${filterSource}` : '';
      const [statsData, jobsData] = await Promise.all([
        api.get('/api/admin/scraper/stats'),
        api.get(`/api/admin/scraper/jobs?pageSize=10${filterQuery}`),
      ]);

      // Check both structures (direct or wrapped in data)
      setStats((statsData as any).stats || statsData.data?.stats || null);
      setJobs((jobsData as any).jobs || jobsData.data?.jobs || []);
      setError(null);
    } catch (error: any) {
      console.error('Failed to load data:', error);
      // Don't show full error UI on polling failure to prevent flickering
      if (loading) {
        setError(error.message || 'Failed to load data');
      }
    } finally {
      setLoading(false);
    }
  };

  const runScraper = async () => {
    const sourceLabel = selectedSource === 'ALL' ? 'All Sources' : selectedSource;
    // Sequential execution takes longer
    const estimatedTime = selectedSource === 'ALL' ? '5-10' : '2-3';

    if (!confirm(`Run ${sourceLabel} scraper? This will take ${estimatedTime} minutes.`)) return;

    setIsRunning(true);
    try {
      const data = await api.post('/api/admin/scraper/run', {
        source: selectedSource,
        targetCount: 50,
      });

      if (data.success) {
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
          <h2 className="text-xl font-semibold text-red-800 mb-2">Error Loading Dashboard</h2>
          <p className="text-red-700 mb-4">{error}</p>
          <div className="bg-white/5 backdrop-blur-sm rounded p-4 border border-red-200">
            <p className="text-sm text-gray-400">Check server logs or connection.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-white">Vehicle Data Scraper</h1>
        <div className="flex gap-4 items-center">
          {/* Source Selector */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-300">Source:</label>
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value as any)}
              className="px-4 py-2 bg-[#0a3d47] border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isRunning}
            >
              <option value="ALL" className="bg-[#0a3d47] text-white">🌐 All Sources</option>
              <option disabled className="bg-[#0a3d47] text-gray-500">──────────</option>
              {/* Added AI Powered Labels */}
              <option value="OLX_AUTOS" className="bg-[#0a3d47] text-white">🟠 OLX Autos (AI Powered)</option>
              <option value="CARSOME" className="bg-[#0a3d47] text-white">🔵 Carsome (AI Powered)</option>
              <option value="SEVA" className="bg-[#0a3d47] text-white">🟢 Seva.id (AI Powered)</option>
              <option value="CARMUDI" className="bg-[#0a3d47] text-white">🟤 Carmudi (AI Powered)</option>
              <option value="OTO" className="bg-[#0a3d47] text-white">⚪ Oto.com (AI Powered)</option>
              <option value="CAROLINE" className="bg-[#0a3d47] text-white">🟡 Caroline.id (AI Powered)</option>
              <option value="AUTO2000" className="bg-[#0a3d47] text-white">🟦 Auto2000 (AI Powered)</option>
              <option value="MOBIL88" className="bg-[#0a3d47] text-white">🟥 Mobil88 (AI Powered)</option>
              <option value="CARRO" className="bg-[#0a3d47] text-white">🟧 Carro (AI Powered)</option>
            </select>
          </div>
          <button
            type="button"
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
        <div className="p-6 bg-gradient-to-br from-purple-500/20 to-purple-900/40 border border-purple-500/30 text-white rounded-lg shadow backdrop-blur-sm">
          <div className="text-3xl font-bold">{stats?.lastRun ? new Date(stats.lastRun).toLocaleDateString() : 'Never'}</div>
          <div className="text-sm opacity-90 text-purple-200">Last Run</div>
        </div>
        <div className="p-6 bg-gradient-to-br from-green-500/20 to-green-900/40 border border-green-500/30 text-white rounded-lg shadow backdrop-blur-sm">
          <div className="text-3xl font-bold">{stats?.totalVehicles || 0}</div>
          <div className="text-sm opacity-90 text-green-200">Total Vehicles</div>
        </div>
        <div className="p-6 bg-gradient-to-br from-orange-500/20 to-orange-900/40 border border-orange-500/30 text-white rounded-lg shadow backdrop-blur-sm">
          <div className="text-3xl font-bold">{stats?.pendingReview || 0}</div>
          <div className="text-sm opacity-90 text-orange-200">Pending Review</div>
        </div>
        <div className="p-6 bg-gradient-to-br from-cyan-500/20 to-cyan-900/40 border border-cyan-500/30 text-white rounded-lg shadow backdrop-blur-sm">
          <div className="text-3xl font-bold">{stats?.todayImported || 0}</div>
          <div className="text-sm opacity-90 text-cyan-200">Imported Today</div>
        </div>
      </div>

      {/* Recent Jobs */}
      <div className="bg-white/5 backdrop-blur-sm rounded-lg shadow border border-white/10">
        <div className="px-6 py-4 border-b border-white/10">
          <h2 className="text-xl font-semibold text-white">Recent Jobs</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#0a3d47]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Source</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Found</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">New</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Duplicates</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {new Date(job.startedAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${job.status === 'completed' ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
                      job.status === 'running' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                        job.status === 'failed' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                          'bg-gray-500/20 text-gray-300 border border-gray-500/30'
                      }`}>
                      {job.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{job.source}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{job.vehiclesFound}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{job.vehiclesNew}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{job.duplicates}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {job.status === 'completed' && (
                      <Link
                        href={`/admin/data-management/scraper/results/${job.id}`}
                        className="text-cyan-400 hover:text-cyan-300"
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
