'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type BlogStatus = 'DRAFT' | 'PUBLISHED' | 'SCHEDULED' | 'ARCHIVED';
type BlogCategory =
  | 'BUYING_GUIDE'
  | 'COMPARISON'
  | 'MAINTENANCE_TIPS'
  | 'MARKET_NEWS'
  | 'FEATURE_REVIEW'
  | 'FINANCING'
  | 'LOCAL_INSIGHTS';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  category: BlogCategory;
  status: BlogStatus;
  seoScore: number;
  wordCount: number;
  views: number;
  publishedAt: string | null;
  createdAt: string;
  authorName: string;
  featuredImage: string | null;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const CATEGORY_LABELS: Record<BlogCategory, string> = {
  BUYING_GUIDE: 'Panduan Membeli',
  COMPARISON: 'Perbandingan',
  MAINTENANCE_TIPS: 'Tips Perawatan',
  MARKET_NEWS: 'Berita Pasar',
  FEATURE_REVIEW: 'Review Fitur',
  FINANCING: 'Panduan Kredit',
  LOCAL_INSIGHTS: 'Insight Lokal',
};

const STATUS_COLORS: Record<BlogStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  PUBLISHED: 'bg-green-100 text-green-800',
  SCHEDULED: 'bg-blue-100 text-blue-800',
  ARCHIVED: 'bg-red-100 text-red-800',
};

export default function BlogListPage() {
  const router = useRouter();
  const [tenantId, setTenantId] = useState<string>('');
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<BlogStatus | 'ALL'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<BlogCategory | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Load tenantId from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setTenantId(parsedUser.tenantId || '');
    }
  }, []);

  useEffect(() => {
    if (tenantId) {
      fetchPosts();
    }
  }, [tenantId, pagination.page, statusFilter, categoryFilter]);

  const fetchPosts = async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (!tenantId) {
        setError('Blog hanya bisa dikelola oleh Showroom Admin. Super Admin tidak memiliki tenant. Silakan login sebagai Showroom Admin untuk melihat dan mengelola blog.');
        setIsLoading(false);
        return;
      }

      const params = new URLSearchParams({
        tenantId: tenantId,
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (statusFilter !== 'ALL') {
        params.append('status', statusFilter);
      }

      if (categoryFilter !== 'ALL') {
        params.append('category', categoryFilter);
      }

      const response = await fetch(`/api/v1/blog?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Gagal memuat blog posts');
      }

      const data = await response.json();
      setPosts(data.data);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!tenantId) {
      alert('Blog hanya bisa dihapus oleh Showroom Admin. Super Admin tidak memiliki tenant.');
      return;
    }

    if (!confirm(`Apakah Anda yakin ingin menghapus "${title}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/blog/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Gagal menghapus blog post');
      }

      alert('Blog post berhasil dihapus!');
      fetchPosts();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal menghapus');
    }
  };

  const handlePublish = async (id: string) => {
    if (!tenantId) {
      alert('Blog hanya bisa dipublish oleh Showroom Admin. Super Admin tidak memiliki tenant.');
      return;
    }

    try {
      const response = await fetch(`/api/v1/blog/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'PUBLISHED',
          tenantId, // ✅ FIX: Add tenantId for API security validation
        }),
      });

      if (!response.ok) {
        throw new Error('Gagal publish blog post');
      }

      alert('Blog post berhasil dipublish!');
      fetchPosts();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal publish');
    }
  };

  const filteredPosts = posts.filter((post) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        post.title.toLowerCase().includes(query) ||
        post.excerpt?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getSEOScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="p-3 h-[calc(100vh-64px)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="mb-3 flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold">Blog Management</h1>
          <p className="text-gray-600 text-sm">
            Kelola artikel blog SEO-optimized untuk showroom Anda
          </p>
        </div>
        <button
          onClick={() => router.push('/dashboard/blog/generate')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold flex items-center gap-2 text-sm"
        >
          🤖 Generate New Post
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-3 mb-3 flex-shrink-0 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Search */}
          <div className="md:col-span-2">
            <input
              type="text"
              placeholder="🔍 Cari judul atau konten..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as BlogStatus | 'ALL')}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="ALL">Semua Status</option>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as BlogCategory | 'ALL')}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="ALL">Semua Kategori</option>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="mt-2 flex justify-between items-center">
          <div className="text-xs text-gray-600">
            Menampilkan {filteredPosts.length} dari {pagination.total} artikel
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 text-sm rounded-lg ${
                viewMode === 'table'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              📊 Table
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 text-sm rounded-lg ${
                viewMode === 'grid'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              🎴 Grid
            </button>
          </div>
        </div>
      </div>

      {/* Main Content - Scrollable */}
      <div className="flex-1 overflow-auto">
        {/* Loading State */}
        {isLoading && (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center border border-gray-200">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
            <p className="text-gray-600 text-sm">Memuat blog posts...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredPosts.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center border border-gray-200">
            <div className="text-5xl mb-3">📝</div>
            <h3 className="text-lg font-semibold mb-1">Belum ada artikel</h3>
            <p className="text-gray-600 mb-4 text-sm">
              {searchQuery
                ? 'Tidak ada artikel yang sesuai dengan pencarian Anda'
                : 'Mulai buat artikel pertama Anda dengan AI'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => router.push('/dashboard/blog/generate')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-sm"
              >
                🤖 Generate Blog Post
              </button>
            )}
          </div>
        )}

        {/* Table View */}
        {!isLoading && filteredPosts.length > 0 && viewMode === 'table' && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Artikel
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Kategori
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      SEO
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Views
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tanggal
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredPosts.map((post) => (
                    <tr key={post.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <div className="max-w-md">
                          <div className="font-semibold text-gray-900 text-sm">
                            {post.title}
                          </div>
                          <div className="text-xs text-gray-600 line-clamp-1">
                            {post.excerpt}
                          </div>
                          <div className="text-xs text-gray-500">
                            {post.wordCount ?? 0} kata • {post.authorName}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
                          {CATEGORY_LABELS[post.category]}
                        </span>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 text-xs rounded ${STATUS_COLORS[post.status]}`}
                        >
                          {post.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span
                          className={`font-semibold text-sm ${getSEOScoreColor(post.seoScore)}`}
                        >
                          {post.seoScore}/100
                        </span>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-gray-600 text-sm">
                        {post.views.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-600">
                        {formatDate(post.publishedAt || post.createdAt)}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          {post.status === 'DRAFT' && (
                            <button
                              onClick={() => handlePublish(post.id)}
                              className="text-green-600 hover:text-green-900"
                              title="Publish"
                            >
                              ✅
                            </button>
                          )}
                          <button
                            onClick={() =>
                              router.push(`/dashboard/blog/${post.id}/edit`)
                            }
                            className="text-blue-600 hover:text-blue-900"
                            title="Edit"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => window.open(`/blog/${post.slug}`, '_blank')}
                            className="text-purple-600 hover:text-purple-900"
                            title="Preview"
                          >
                            👁️
                          </button>
                          <button
                            onClick={() => handleDelete(post.id, post.title)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Grid View */}
        {!isLoading && filteredPosts.length > 0 && viewMode === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredPosts.map((post) => (
              <div key={post.id} className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
                {/* Featured Image Placeholder */}
                <div className="h-32 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <div className="text-white text-4xl">
                    {post.featuredImage ? (
                      <img
                        src={post.featuredImage}
                        alt={post.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      '📝'
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
                      {CATEGORY_LABELS[post.category]}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-xs rounded ${STATUS_COLORS[post.status]}`}
                    >
                      {post.status}
                    </span>
                  </div>

                  <h3 className="font-semibold text-sm mb-1 line-clamp-2">
                    {post.title}
                  </h3>

                  <p className="text-xs text-gray-600 mb-2 line-clamp-1">
                    {post.excerpt}
                  </p>

                  <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                    <span className={`font-semibold ${getSEOScoreColor(post.seoScore)}`}>
                      SEO: {post.seoScore}/100
                    </span>
                    <span>{post.views} views</span>
                  </div>

                  <div className="text-xs text-gray-500 mb-2">
                    {post.wordCount ?? 0} kata • {formatDate(post.publishedAt || post.createdAt)}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 pt-2 border-t">
                    {post.status === 'DRAFT' && (
                      <button
                        onClick={() => handlePublish(post.id)}
                        className="flex-1 px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                      >
                        Publish
                      </button>
                    )}
                    <button
                      onClick={() => router.push(`/dashboard/blog/${post.id}/edit`)}
                      className="flex-1 px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => window.open(`/blog/${post.slug}`, '_blank')}
                      className="px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-xs"
                    >
                      👁️
                    </button>
                    <button
                      onClick={() => handleDelete(post.id, post.title)}
                      className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!isLoading && filteredPosts.length > 0 && pagination.totalPages > 1 && (
          <div className="mt-3 flex justify-center items-center gap-2">
            <button
              onClick={() =>
                setPagination({ ...pagination, page: Math.max(1, pagination.page - 1) })
              }
              disabled={pagination.page === 1}
              className={`px-3 py-1.5 text-sm rounded-lg ${
                pagination.page === 1
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
              }`}
            >
              ← Prev
            </button>

            <div className="flex gap-1">
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(
                (pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => setPagination({ ...pagination, page: pageNum })}
                    className={`px-3 py-1.5 text-sm rounded-lg ${
                      pageNum === pagination.page
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              )}
            </div>

            <button
              onClick={() =>
                setPagination({
                  ...pagination,
                  page: Math.min(pagination.totalPages, pagination.page + 1),
                })
              }
              disabled={pagination.page === pagination.totalPages}
              className={`px-3 py-1.5 text-sm rounded-lg ${
                pagination.page === pagination.totalPages
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
              }`}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
