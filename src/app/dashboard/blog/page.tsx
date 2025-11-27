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
        setError('User tenant information not found');
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
    try {
      const response = await fetch(`/api/v1/blog/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PUBLISHED' }),
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
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Blog Management</h1>
          <p className="text-gray-600">
            Kelola artikel blog SEO-optimized untuk showroom Anda
          </p>
        </div>
        <button
          onClick={() => router.push('/dashboard/blog/generate')}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold flex items-center gap-2"
        >
          🤖 Generate New Post
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <input
              type="text"
              placeholder="🔍 Cari judul atau konten..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as BlogStatus | 'ALL')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
        <div className="mt-4 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            Menampilkan {filteredPosts.length} dari {pagination.total} artikel
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('table')}
              className={`px-4 py-2 rounded-lg ${
                viewMode === 'table'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              📊 Table
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-4 py-2 rounded-lg ${
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

      {/* Loading State */}
      {isLoading && (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat blog posts...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredPosts.length === 0 && (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <div className="text-6xl mb-4">📝</div>
          <h3 className="text-xl font-semibold mb-2">Belum ada artikel</h3>
          <p className="text-gray-600 mb-6">
            {searchQuery
              ? 'Tidak ada artikel yang sesuai dengan pencarian Anda'
              : 'Mulai buat artikel pertama Anda dengan AI'}
          </p>
          {!searchQuery && (
            <button
              onClick={() => router.push('/dashboard/blog/generate')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
            >
              🤖 Generate Blog Post
            </button>
          )}
        </div>
      )}

      {/* Table View */}
      {!isLoading && filteredPosts.length > 0 && viewMode === 'table' && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Artikel
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kategori
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    SEO
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Views
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tanggal
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPosts.map((post) => (
                  <tr key={post.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="max-w-md">
                        <div className="font-semibold text-gray-900 mb-1">
                          {post.title}
                        </div>
                        <div className="text-sm text-gray-600 line-clamp-2">
                          {post.excerpt}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {post.wordCount} kata • {post.authorName}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                        {CATEGORY_LABELS[post.category]}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs rounded ${STATUS_COLORS[post.status]}`}
                      >
                        {post.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`font-semibold ${getSEOScoreColor(post.seoScore)}`}
                      >
                        {post.seoScore}/100
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                      {post.views.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {formatDate(post.publishedAt || post.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPosts.map((post) => (
            <div key={post.id} className="bg-white rounded-lg shadow-md overflow-hidden">
              {/* Featured Image Placeholder */}
              <div className="h-48 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <div className="text-white text-6xl">
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
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                    {CATEGORY_LABELS[post.category]}
                  </span>
                  <span
                    className={`px-2 py-1 text-xs rounded ${STATUS_COLORS[post.status]}`}
                  >
                    {post.status}
                  </span>
                </div>

                <h3 className="font-semibold text-lg mb-2 line-clamp-2">
                  {post.title}
                </h3>

                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                  {post.excerpt}
                </p>

                <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                  <div>
                    <span className={`font-semibold ${getSEOScoreColor(post.seoScore)}`}>
                      SEO: {post.seoScore}/100
                    </span>
                  </div>
                  <div>{post.views} views</div>
                </div>

                <div className="text-xs text-gray-500 mb-3">
                  {post.wordCount} kata • {formatDate(post.publishedAt || post.createdAt)}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-3 border-t">
                  {post.status === 'DRAFT' && (
                    <button
                      onClick={() => handlePublish(post.id)}
                      className="flex-1 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                    >
                      Publish
                    </button>
                  )}
                  <button
                    onClick={() => router.push(`/dashboard/blog/${post.id}/edit`)}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => window.open(`/blog/${post.slug}`, '_blank')}
                    className="px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
                  >
                    👁️
                  </button>
                  <button
                    onClick={() => handleDelete(post.id, post.title)}
                    className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
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
        <div className="mt-6 flex justify-center items-center gap-2">
          <button
            onClick={() =>
              setPagination({ ...pagination, page: Math.max(1, pagination.page - 1) })
            }
            disabled={pagination.page === 1}
            className={`px-4 py-2 rounded-lg ${
              pagination.page === 1
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            ← Previous
          </button>

          <div className="flex gap-2">
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(
              (pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => setPagination({ ...pagination, page: pageNum })}
                  className={`px-4 py-2 rounded-lg ${
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
            className={`px-4 py-2 rounded-lg ${
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
  );
}
