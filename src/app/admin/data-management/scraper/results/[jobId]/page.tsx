'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Result {
  id: string;
  make: string;
  model: string;
  year: number;
  priceDisplay: string;
  location: string | null;
  variant: string | null;
  mileage: number | null;
  transmission: string | null;
  fuelType: string | null;
  color: string | null;
  status: string;
  confidence: number;
  url: string;
}

export default function ResultsPage({ params }: { params: { jobId: string } }) {
  const router = useRouter();
  const [results, setResults] = useState<Result[]>([]);
  const [filteredResults, setFilteredResults] = useState<Result[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  useEffect(() => {
    loadResults();
  }, [params.jobId]);

  useEffect(() => {
    filterResults();
  }, [results, search, filter]);

  const loadResults = async () => {
    try {
      const res = await fetch(`/api/admin/scraper/results/${params.jobId}`);

      if (!res.ok) {
        throw new Error('Job not found or failed to load results');
      }

      const data = await res.json();
      setResults(data.results || []);
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
      await fetch(`/api/admin/scraper/approve/${resultId}`, { method: 'POST' });
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
        fetch(`/api/admin/scraper/approve/${id}`, { method: 'POST' })
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
      const res = await fetch(`/api/admin/scraper/import/${params.jobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      alert(`Imported: ${data.imported}, Updated: ${data.updated}, Skipped: ${data.skipped}`);
      router.push('/admin/data-management/scraper');
    } catch (error) {
      alert('Import failed');
    }
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
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-red-800 mb-2">Error Loading Results</h2>
          <p className="text-red-700">{error}</p>
          <p className="text-gray-600 mt-4">The job may not exist or has been deleted.</p>
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
        <div className="p-4 bg-white rounded-lg shadow">
          <div className="text-2xl font-bold">{results.length}</div>
          <div className="text-sm text-gray-600">Total</div>
        </div>
        <div className="p-4 bg-yellow-50 rounded-lg shadow">
          <div className="text-2xl font-bold text-yellow-700">{stats.pending}</div>
          <div className="text-sm text-yellow-600">Pending</div>
        </div>
        <div className="p-4 bg-green-50 rounded-lg shadow">
          <div className="text-2xl font-bold text-green-700">{stats.approved}</div>
          <div className="text-sm text-green-600">Approved</div>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg shadow">
          <div className="text-2xl font-bold text-gray-700">{stats.duplicate}</div>
          <div className="text-sm text-gray-600">Duplicates</div>
        </div>
      </div>

      {/* Filters and Bulk Actions */}
      <div className="flex gap-4 mb-6">
        <input
          type="text"
          placeholder="Search make, model, year..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 border rounded-lg"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="duplicate">Duplicate</option>
        </select>
        {filter === 'pending' && filteredResults.length > 0 && (
          <button
            onClick={toggleSelectAll}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            {selectedIds.size === filteredResults.length ? '☑ Deselect All' : '☐ Select All'}
          </button>
        )}
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 w-12">
                  {filter === 'pending' && (
                    <input
                      type="checkbox"
                      checked={selectedIds.size > 0 && selectedIds.size === filteredResults.filter(r => r.status === 'pending').length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                  )}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehicle</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Year</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Specs</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredResults.map((result) => (
                <tr key={result.id} className={`hover:bg-gray-50 ${selectedIds.has(result.id) ? 'bg-blue-50' : ''}`}>
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
                    <div className="font-medium">{result.make} {result.model}</div>
                    {result.variant && (
                      <div className="text-xs text-gray-500">{result.variant}</div>
                    )}
                    {result.confidence > 0 && (
                      <div className="text-xs text-orange-500">Dup: {result.confidence}%</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">{result.year || 'N/A'}</td>
                  <td className="px-4 py-3 text-sm font-medium text-green-600">{result.priceDisplay}</td>
                  <td className="px-4 py-3 text-xs">
                    <div className="space-y-1">
                      {result.transmission && (
                        <div className="flex items-center gap-1">
                          <span className="text-gray-500">⚙️</span>
                          <span>{result.transmission}</span>
                        </div>
                      )}
                      {result.fuelType && (
                        <div className="flex items-center gap-1">
                          <span className="text-gray-500">⛽</span>
                          <span>{result.fuelType}</span>
                        </div>
                      )}
                      {result.mileage && (
                        <div className="flex items-center gap-1">
                          <span className="text-gray-500">📏</span>
                          <span>{result.mileage.toLocaleString()} km</span>
                        </div>
                      )}
                      {result.color && (
                        <div className="flex items-center gap-1">
                          <span className="text-gray-500">🎨</span>
                          <span>{result.color}</span>
                        </div>
                      )}
                      {!result.transmission && !result.fuelType && !result.mileage && !result.color && (
                        <span className="text-gray-400">No specs</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{result.location || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      result.status === 'approved' ? 'bg-green-100 text-green-800' :
                      result.status === 'duplicate' ? 'bg-gray-100 text-gray-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {result.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm space-x-2">
                    {result.status === 'pending' && (
                      <button
                        onClick={() => approveResult(result.id)}
                        className="text-green-600 hover:text-green-800 font-medium"
                      >
                        ✓ Approve
                      </button>
                    )}
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800"
                    >
                      View →
                    </a>
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
    </div>
  );
}
