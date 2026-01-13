'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api-client';

interface Result {
  id: string;
  make: string;
  model: string;
  year: number;
  priceDisplay: string;
  location: string | null;
  variant: string | null;
  transmission: string | null;
  fuelType: string | null;
  bodyType: string | null;
  features: string | null;
  description: string | null;
  status: string;
  confidence: number;
  url: string;
}

// Helper function to extract source name from URL
const getSourceFromUrl = (url: string): string => {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes('olx')) return 'OLX';
    if (hostname.includes('carro')) return 'Carro';
    if (hostname.includes('mobil88')) return 'Mobil88';
    if (hostname.includes('auto2000')) return 'Auto2000';
    if (hostname.includes('carmudi')) return 'Carmudi';
    if (hostname.includes('seva')) return 'SEVA';
    if (hostname.includes('oto')) return 'OTO';
    if (hostname.includes('carsome')) return 'Carsome';
    return 'Source'; // Fallback
  } catch {
    return 'Source';
  }
};

export default function ResultsPage({ params }: { params: Promise<{ jobId: string }> | { jobId: string } }) {
  const router = useRouter();
  const resolvedParams = params instanceof Promise ? use(params) : params;
  const [results, setResults] = useState<Result[]>([]);
  const [filteredResults, setFilteredResults] = useState<Result[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState<Result | null>(null);

  useEffect(() => {
    loadResults();
  }, [resolvedParams.jobId]);

  useEffect(() => {
    filterResults();
  }, [results, search, filter]);

  const loadResults = async () => {
    try {
      const res = await api.get(`/api/admin/scraper/results/${resolvedParams.jobId}`);

      if (!res.success) {
        throw new Error(res.error || 'Job not found or failed to load results');
      }

      setResults((res as any).results || res.data?.results || []);
      setError(null);
    } catch (error) {
      console.error('Failed to load results:', error);
      setError(error instanceof Error ? error.message : 'Failed to load results');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const filterResults = () => {
    let filtered = results;

    if (filter !== 'all') {
      filtered = filtered.filter(r => r.status === filter);
    }

    if (search) {
      const query = search.toLowerCase();
      filtered = filtered.filter(r =>
        r.make.toLowerCase().includes(query) ||
        r.model.toLowerCase().includes(query) ||
        r.year.toString().includes(query)
      );
    }

    setFilteredResults(filtered);
  };

  const approveResult = async (resultId: string) => {
    try {
      await api.post(`/api/admin/scraper/approve/${resultId}`, {});
      loadResults();
    } catch (error) {
      alert('Failed to approve');
    }
  };

  const toggleSelection = (resultId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(resultId)) {
      newSelected.delete(resultId);
    } else {
      newSelected.add(resultId);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    const pendingResults = filteredResults.filter(r => r.status === 'pending');
    if (selectedIds.size === pendingResults.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingResults.map(r => r.id)));
    }
  };

  const bulkApprove = async () => {
    if (selectedIds.size === 0) {
      alert('No items selected');
      return;
    }

    if (!confirm(`Approve ${selectedIds.size} items?`)) return;

    setBulkActionLoading(true);
    try {
      const promises = Array.from(selectedIds).map(id =>
        api.post(`/api/admin/scraper/approve/${id}`, {})
      );

      await Promise.all(promises);
      setSelectedIds(new Set());
      loadResults();
      alert(`Successfully approved ${selectedIds.size} items`);
    } catch (error) {
      alert('Some items failed to approve');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const importAll = async () => {
    if (!confirm('Import all approved results to production?')) return;

    try {
      const res = await api.post(`/api/admin/scraper/import/${resolvedParams.jobId}`, {});

      const data = res.data;
      alert(`Imported: ${data.imported}, Updated: ${data.updated}, Skipped: ${data.skipped}`);
      router.push('/admin/data-management/scraper');
    } catch (error) {
      alert('Import failed');
    }
  };

  const openDetailModal = (result: Result) => {
    setSelectedResult(result);
    setDetailModalOpen(true);
  };

  const closeDetailModal = () => {
    setDetailModalOpen(false);
    setSelectedResult(null);
  };

  if (loading) return <div className="p-8">Loading...</div>;

  if (error) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="mb-6">
          <Link href="/admin/data-management/scraper" className="text-blue-600 hover:text-blue-800">
            ← Back to Dashboard
          </Link>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-red-400 mb-2">Error Loading Results</h2>
          <p className="text-red-300">{error}</p>
          <p className="text-gray-400 mt-4">The job may not exist or has been deleted.</p>
        </div>
      </div>
    );
  }

  const stats = {
    pending: results.filter(r => r.status === 'pending').length,
    approved: results.filter(r => r.status === 'approved').length,
    duplicate: results.filter(r => r.status === 'duplicate').length,
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <Link href="/admin/data-management/scraper" className="text-blue-600 hover:text-blue-800">
          ← Back to Dashboard
        </Link>
      </div>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Scraper Results</h1>
        <div className="flex gap-3">
          {selectedIds.size > 0 && (
            <button
              onClick={bulkApprove}
              disabled={bulkActionLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {bulkActionLoading ? 'Approving...' : `✓ Approve Selected (${selectedIds.size})`}
            </button>
          )}
          <button
            onClick={importAll}
            disabled={stats.approved === 0}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            Import Approved ({stats.approved})
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-white/5 border border-white/10 rounded-lg shadow backdrop-blur-sm">
          <div className="text-2xl font-bold text-white">{results.length}</div>
          <div className="text-sm text-gray-400">Total</div>
        </div>
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg shadow backdrop-blur-sm">
          <div className="text-2xl font-bold text-yellow-400">{stats.pending}</div>
          <div className="text-sm text-yellow-300">Pending</div>
        </div>
        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg shadow backdrop-blur-sm">
          <div className="text-2xl font-bold text-green-400">{stats.approved}</div>
          <div className="text-sm text-green-300">Approved</div>
        </div>
        <div className="p-4 bg-gray-500/10 border border-gray-500/20 rounded-lg shadow backdrop-blur-sm">
          <div className="text-2xl font-bold text-gray-300">{stats.duplicate}</div>
          <div className="text-sm text-gray-400">Duplicates</div>
        </div>
      </div>

      {/* Filters and Bulk Actions */}
      <div className="flex gap-4 mb-6">
        <input
          type="text"
          placeholder="Search make, model, year..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 bg-[#0a3d47] border border-white/10 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-4 py-2 bg-[#0a3d47] border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
        >
          <option value="all" className="bg-[#0a3d47] text-white">All Status</option>
          <option value="pending" className="bg-[#0a3d47] text-white">Pending</option>
          <option value="approved" className="bg-[#0a3d47] text-white">Approved</option>
          <option value="duplicate" className="bg-[#0a3d47] text-white">Duplicate</option>
        </select>
        {filter === 'pending' && filteredResults.length > 0 && (
          <button
            onClick={toggleSelectAll}
            className="px-4 py-2 bg-[#0a3d47] border border-white/10 rounded-lg text-white hover:bg-white/10"
          >
            {selectedIds.size === filteredResults.length ? '☑ Deselect All' : '☐ Select All'}
          </button>
        )}
      </div>

      {/* Results Table */}
      <div className="bg-white/5 border border-white/10 rounded-lg shadow overflow-hidden backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#0a3d47]">
              <tr>
                <th className="px-4 py-3 w-12">
                  {filter === 'pending' && (
                    <input
                      type="checkbox"
                      checked={selectedIds.size > 0 && selectedIds.size === filteredResults.filter(r => r.status === 'pending').length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 accent-cyan-500"
                    />
                  )}
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-300 uppercase tracking-wider">Vehicle</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-300 uppercase tracking-wider">Year</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-300 uppercase tracking-wider">Price</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-300 uppercase tracking-wider">Specs</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-300 uppercase tracking-wider">Data Quality</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-300 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filteredResults.map((result) => (
                <tr key={result.id} className={`hover:bg-white/5 ${selectedIds.has(result.id) ? 'bg-cyan-500/10' : ''}`}>
                  <td className="px-4 py-3">
                    {result.status === 'pending' && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(result.id)}
                        onChange={() => toggleSelection(result.id)}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{result.make} {result.model}</div>
                    {result.variant && (
                      <div className="text-xs text-gray-500 truncate max-w-xs">{result.variant}</div>
                    )}
                    {result.bodyType && (
                      <div className="text-xs text-blue-600">🚗 {result.bodyType}</div>
                    )}
                    {result.confidence > 0 && (
                      <div className="text-xs text-orange-500">⚠️ Dup: {result.confidence}%</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">{result.year || 'N/A'}</td>
                  <td className="px-4 py-3 text-sm font-medium text-green-600">{result.priceDisplay}</td>
                  <td className="px-4 py-3 text-xs">
                    <div className="space-y-1">
                      {result.transmission && result.fuelType ? (
                        <div className="text-gray-300">
                          ⚙️ {result.transmission} • ⛽ {result.fuelType}
                        </div>
                      ) : (
                        <div className="text-gray-400">No transmission/fuel data</div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="space-y-1">
                      {/* Count fields */}
                      {(() => {
                        const fields = [
                          result.variant,
                          result.bodyType,
                          result.transmission,
                          result.fuelType,
                          result.features,
                          result.description,
                        ].filter(Boolean);
                        const featureCount = result.features ? result.features.split(',').length : 0;
                        const totalFields = fields.length;
                        const quality = totalFields >= 5 ? 'High' : totalFields >= 3 ? 'Medium' : 'Low';
                        const qualityColor = quality === 'High' ? 'text-green-400' : quality === 'Medium' ? 'text-yellow-400' : 'text-red-400';

                        return (
                          <div>
                            <div className={`font-medium ${qualityColor}`}>
                              {quality} Quality
                            </div>
                            <div className="text-xs text-gray-500">
                              {totalFields}/6 fields
                            </div>
                            {featureCount > 0 && (
                              <div className="text-xs text-blue-600">
                                ✨ {featureCount} features
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full border ${result.status === 'approved' ? 'bg-green-500/20 text-green-300 border-green-500/30' :
                      result.status === 'duplicate' ? 'bg-gray-500/20 text-gray-300 border-gray-500/30' :
                        'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                      }`}>
                      {result.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => openDetailModal(result)}
                        className="text-purple-400 hover:text-purple-300 font-medium text-left"
                      >
                        📋 Details
                      </button>
                      {result.status === 'pending' && (
                        <button
                          onClick={() => approveResult(result.id)}
                          className="text-green-400 hover:text-green-300 font-medium text-left"
                        >
                          ✓ Approve
                        </button>
                      )}
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 hover:text-cyan-300"
                      >
                        🔗 {getSourceFromUrl(result.url)}
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredResults.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No results found
        </div>
      )}

      {/* Detail Modal */}
      {detailModalOpen && selectedResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0d4450] border border-white/10 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-[#0a3d47] border-b border-white/10 px-6 py-4 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-white">
                {selectedResult.make} {selectedResult.model} {selectedResult.year}
              </h2>
              <button
                onClick={closeDetailModal}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {/* Status Badge */}
              <div className="mb-6">
                <span className={`px-3 py-1 text-sm rounded-full border ${selectedResult.status === 'approved' ? 'bg-green-500/20 text-green-300 border-green-500/30' :
                  selectedResult.status === 'duplicate' ? 'bg-gray-500/20 text-gray-300 border-gray-500/30' :
                    'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                  }`}>
                  {selectedResult.status.toUpperCase()}
                </span>
                {selectedResult.confidence > 0 && (
                  <span className="ml-2 px-3 py-1 text-sm rounded-full bg-orange-100 text-orange-800">
                    Duplicate Confidence: {selectedResult.confidence}%
                  </span>
                )}
              </div>

              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-[#0a3d47] border border-white/10 p-4 rounded-lg">
                  <div className="text-sm text-gray-300 mb-1">Price</div>
                  <div className="text-xl font-bold text-green-400">{selectedResult.priceDisplay}</div>
                </div>
                <div className="bg-[#0a3d47] border border-white/10 p-4 rounded-lg">
                  <div className="text-sm text-gray-300 mb-1">Year</div>
                  <div className="text-xl font-bold text-white">{selectedResult.year || 'N/A'}</div>
                </div>
              </div>

              {/* Specifications */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3 border-b pb-2">Specifications</h3>
                <div className="grid grid-cols-2 gap-4">
                  {selectedResult.variant && (
                    <div className="flex items-start gap-2">
                      <span className="text-gray-500 text-xl">🏷️</span>
                      <div>
                        <div className="text-sm text-gray-500">Variant</div>
                        <div className="font-medium">{selectedResult.variant}</div>
                      </div>
                    </div>
                  )}
                  {selectedResult.bodyType && (
                    <div className="flex items-start gap-2">
                      <span className="text-gray-500 text-xl">🚗</span>
                      <div>
                        <div className="text-sm text-gray-500">Body Type</div>
                        <div className="font-medium">{selectedResult.bodyType}</div>
                      </div>
                    </div>
                  )}
                  {selectedResult.transmission && (
                    <div className="flex items-start gap-2">
                      <span className="text-gray-500 text-xl">⚙️</span>
                      <div>
                        <div className="text-sm text-gray-500">Transmission</div>
                        <div className="font-medium">{selectedResult.transmission}</div>
                      </div>
                    </div>
                  )}
                  {selectedResult.fuelType && (
                    <div className="flex items-start gap-2">
                      <span className="text-gray-500 text-xl">⛽</span>
                      <div>
                        <div className="text-sm text-gray-500">Fuel Type</div>
                        <div className="font-medium">{selectedResult.fuelType}</div>
                      </div>
                    </div>
                  )}
                  {selectedResult.location && (
                    <div className="flex items-start gap-2">
                      <span className="text-gray-500 text-xl">📍</span>
                      <div>
                        <div className="text-sm text-gray-500">Location</div>
                        <div className="font-medium">{selectedResult.location}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Features */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3 border-b pb-2">Features</h3>
                {selectedResult.features ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedResult.features.split(',').map((feature, idx) => (
                      <span key={idx} className="px-3 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full text-sm font-medium">
                        ✨ {feature.trim()}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500 italic">
                    No features detected from listing title. This vehicle may have limited feature information for AI content generation.
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3 border-b pb-2">Description</h3>
                {selectedResult.description ? (
                  <p className="text-gray-300 leading-relaxed">{selectedResult.description}</p>
                ) : (
                  <div className="text-gray-500 italic">
                    No description available. Title contains limited descriptive information.
                  </div>
                )}
              </div>

              {/* Source Link */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3 border-b pb-2">Source</h3>
                <a
                  href={selectedResult.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 break-all"
                >
                  {selectedResult.url}
                </a>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t">
                {selectedResult.status === 'pending' && (
                  <button
                    onClick={() => {
                      approveResult(selectedResult.id);
                      closeDetailModal();
                    }}
                    className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                  >
                    ✓ Approve This Vehicle
                  </button>
                )}
                <a
                  href={selectedResult.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-center"
                >
                  View on {getSourceFromUrl(selectedResult.url)} →
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
