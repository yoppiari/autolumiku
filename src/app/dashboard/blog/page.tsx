'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ROLE_LEVELS } from '@/lib/rbac';

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
  DRAFT: 'bg-gray-700 text-gray-300 border border-gray-600',
  PUBLISHED: 'bg-green-900/40 text-green-300 border border-green-800/50',
  SCHEDULED: 'bg-blue-900/40 text-blue-300 border border-blue-800/50',
  ARCHIVED: 'bg-red-900/40 text-red-300 border border-red-800/50',
};

export default function BlogListPage() {
  const router = useRouter();
  const [tenantId, setTenantId] = useState<string>('');
  const [userRoleLevel, setUserRoleLevel] = useState<number>(0);
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

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setTenantId(parsedUser.tenantId || '');
      setUserRoleLevel(parsedUser.roleLevel || 0);
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
          <h1 className="text-2xl font-bold text-white">Blog Management</h1>
          <p className="text-gray-400 text-sm">
            Kelola artikel blog SEO-optimized untuk showroom Anda
          </p>
        </div>
        <button
          onClick={() => {
            if (userRoleLevel < (ROLE_LEVELS?.ADMIN || 90)) {
              alert('Akses Ditolak: Fitur ini hanya untuk Owner, Admin, dan Super Admin.');
              return;
            }
            router.push('/dashboard/blog/generate');
          }}
          className={`px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold flex items-center gap-2 text-sm ${userRoleLevel < (ROLE_LEVELS?.ADMIN || 90) ? 'opacity-70 grayscale cursor-not-allowed' : ''}`}
        >
          🤖 Generate New Post
        </button>
      </div>

      {/* Filters */}
      <div className="bg-[#2a2a2a] rounded-lg shadow-sm p-3 mb-3 flex-shrink-0 border border-[#3a3a3a]">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Search */}
          <div className="md:col-span-2">
            <input
              type="text"
              placeholder="🔍 Cari judul atau konten..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 text-sm bg-[#333] border border-[#444] text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-500"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as BlogStatus | 'ALL')}
              className="w-full px-3 py-1.5 text-sm bg-[#333] border border-[#444] text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="w-full px-3 py-1.5 text-sm bg-[#333] border border-[#444] text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          <div className="text-xs text-gray-400">
            Menampilkan {filteredPosts.length} dari {pagination.total} artikel
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 text-sm rounded-lg ${viewMode === 'table'
                ? 'bg-blue-600 text-white'
                : 'bg-[#333] text-gray-300 hover:bg-[#444]'
                }`}
            >
              📊 Table
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 text-sm rounded-lg ${viewMode === 'grid'
                ? 'bg-blue-600 text-white'
                : 'bg-[#333] text-gray-300 hover:bg-[#444]'
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
          <div className="bg-[#2a2a2a] rounded-lg shadow-sm p-8 text-center border border-[#3a3a3a]">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
            <p className="text-gray-400 text-sm">Memuat blog posts...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 mb-3">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredPosts.length === 0 && (
          <div className="bg-[#2a2a2a] rounded-lg shadow-sm p-8 text-center border border-[#3a3a3a]">
            <div className="text-5xl mb-3">📝</div>
            <h3 className="text-lg font-semibold mb-1 text-white">Belum ada artikel</h3>
            <p className="text-gray-400 mb-4 text-sm">
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
          <div className="bg-[#2a2a2a] rounded-lg shadow-sm overflow-hidden border border-[#3a3a3a]">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#333] border-b border-[#444]">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Artikel
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Kategori
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      SEO
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Views
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Tanggal
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-[#2a2a2a] divide-y divide-[#3a3a3a]">
                  {filteredPosts.map((post) => (
                    <tr key={post.id} className="hover:bg-[#333] transition-colors">
                      <td className="px-4 py-2">
                        <div className="max-w-md">
                          <div className="font-semibold text-white text-sm">
                            {post.title}
                          </div>
                          <div className="text-xs text-gray-400 line-clamp-1">
                            {post.excerpt}
                          </div>
                          <div className="text-xs text-gray-500">
                            {post.wordCount ?? 0} kata • {post.authorName}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span className="px-2 py-0.5 text-xs bg-blue-900/40 text-blue-300 border border-blue-800/50 rounded">
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
                      <td className="px-4 py-2 whitespace-nowrap text-gray-400 text-sm">
                        {post.views.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-400">
                        {formatDate(post.publishedAt || post.createdAt)}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          {post.status === 'DRAFT' && (
                            <button
                              onClick={() => handlePublish(post.id)}
                              className="text-green-500 hover:text-green-400"
                              title="Publish"
                            >
                              ✅
                            </button>
                          )}
                          <button
                            onClick={() =>
                              router.push(`/dashboard/blog/${post.id}/edit`)
                            }
                            className="text-blue-500 hover:text-blue-400"
                            title="Edit"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => window.open(`/blog/${post.slug}`, '_blank')}
                            className="text-purple-500 hover:text-purple-400"
                            title="Preview"
                          >
                            👁️
                          </button>
                          <button
                            onClick={() => {
                              if (userRoleLevel < (ROLE_LEVELS?.ADMIN || 90)) {
                                alert('Akses Ditolak: Fitur ini hanya untuk Owner, Admin, dan Super Admin.');
                                return;
                              }
                              handleDelete(post.id, post.title);
                            }}
                            className={`text-red-500 hover:text-red-400 ${userRoleLevel < (ROLE_LEVELS?.ADMIN || 90) ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
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
              <div key={post.id} className="bg-[#2a2a2a] rounded-lg shadow-sm overflow-hidden border border-[#3a3a3a]">
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

                  <p className="text-xs text-gray-400 mb-2 line-clamp-1">
                    {post.excerpt}
                  </p>

                  <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
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
                      onClick={() => {
                        if (userRoleLevel < (ROLE_LEVELS?.ADMIN || 90)) {
                          alert('Akses Ditolak: Fitur ini hanya untuk Owner, Admin, dan Super Admin.');
                          return;
                        }
                        handleDelete(post.id, post.title);
                      }}
                      className={`px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs ${userRoleLevel < (ROLE_LEVELS?.ADMIN || 90) ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
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
              className={`px-3 py-1.5 text-sm rounded-lg ${pagination.page === 1
                ? 'bg-[#333] text-gray-600 cursor-not-allowed'
                : 'bg-[#2a2a2a] text-gray-300 hover:bg-[#333] border border-[#3a3a3a]'
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
                    className={`px-3 py-1.5 text-sm rounded-lg ${pageNum === pagination.page
                      ? 'bg-blue-600 text-white'
                      : 'bg-[#2a2a2a] text-gray-300 hover:bg-[#333] border border-[#3a3a3a]'
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
              className={`px-3 py-1.5 text-sm rounded-lg ${pagination.page === pagination.totalPages
                ? 'bg-[#333] text-gray-600 cursor-not-allowed'
                : 'bg-[#2a2a2a] text-gray-300 hover:bg-[#333] border border-[#3a3a3a]'
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
