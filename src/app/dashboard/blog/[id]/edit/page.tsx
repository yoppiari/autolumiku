'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

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
    metaDescription: string;
    content: string;
    excerpt: string;
    keywords: string[];
    localKeywords: string[];
    focusKeyword: string;
    seoScore: number;
    wordCount: number;
    readabilityScore: number;
    category: BlogCategory;
    status: BlogStatus;
    featuredImage: string | null;
    relatedTopics?: string[]; // Optional as it might not be in DB but in generation
}

export default function BlogEditPage() {
    const router = useRouter();
    const params = useParams();
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [post, setPost] = useState<BlogPost | null>(null);

    useEffect(() => {
        const fetchPost = async () => {
            try {
                const response = await fetch(`/api/v1/blog/${params.id}`);
                if (!response.ok) {
                    throw new Error('Gagal memuat blog post');
                }
                const data = await response.json();
                setPost(data.data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
            } finally {
                setIsLoading(false);
            }
        };

        if (params.id) {
            fetchPost();
        }
    }, [params.id]);

    const handleSave = async (status?: BlogStatus) => {
        if (!post) return;

        setIsSaving(true);
        setError(null);

        try {
            const response = await fetch(`/api/v1/blog/${params.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...post,
                    status: status || post.status,
                    tenantId: user?.tenantId,
                }),
            });

            if (!response.ok) {
                throw new Error('Gagal menyimpan perubahan');
            }

            alert('Perubahan berhasil disimpan!');
            router.push('/dashboard/blog');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Gagal menyimpan');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Memuat data...</p>
            </div>
        );
    }

    if (error || !post) {
        return (
            <div className="p-6 max-w-4xl mx-auto">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                    {error || 'Blog post tidak ditemukan'}
                </div>
                <button
                    onClick={() => router.push('/dashboard/blog')}
                    className="mt-4 text-blue-600 hover:text-blue-800"
                >
                    ← Kembali ke List
                </button>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="mb-6 flex items-center justify-between">
                <button
                    onClick={() => router.push('/dashboard/blog')}
                    className="text-blue-600 hover:text-blue-800 flex items-center gap-2"
                >
                    ← Kembali
                </button>
                <div className="flex gap-3">
                    <button
                        onClick={() => handleSave()}
                        disabled={isSaving}
                        className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
                    >
                        {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                    </button>
                    {post.status === 'DRAFT' && (
                        <button
                            onClick={() => handleSave('PUBLISHED')}
                            disabled={isSaving}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                            Publish Sekarang
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                <div className="flex justify-between items-start mb-6">
                    <h1 className="text-2xl font-bold">Edit Article</h1>
                    <div className="flex gap-4 text-sm">
                        <div className="text-center">
                            <div className="font-semibold text-lg text-blue-600">
                                {post.seoScore}/100
                            </div>
                            <div className="text-gray-600">SEO Score</div>
                        </div>
                        <div className="text-center">
                            <div className="font-semibold text-lg text-green-600">
                                {post.wordCount ?? 0}
                            </div>
                            <div className="text-gray-600">Words</div>
                        </div>
                        <div className="text-center">
                            <div className="font-semibold text-lg text-purple-600">
                                {post.readabilityScore?.toFixed(0) || '-'}
                            </div>
                            <div className="text-gray-600">Readability</div>
                        </div>
                    </div>
                </div>

                {/* Featured Image */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h3 className="text-lg font-semibold mb-3">🖼️ Featured Image</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Image URL
                            </label>
                            <input
                                type="text"
                                value={post.featuredImage || ''}
                                onChange={(e) => setPost({ ...post, featuredImage: e.target.value })}
                                placeholder="https://example.com/image.jpg"
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <p className="mt-2 text-xs text-gray-500">
                                Masukkan URL gambar yang ingin ditampilkan sebagai cover artikel.
                            </p>
                        </div>
                        <div className="flex items-center justify-center bg-gray-200 rounded-lg h-48 overflow-hidden">
                            {post.featuredImage ? (
                                <img
                                    src={post.featuredImage}
                                    alt="Preview"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src =
                                            'https://via.placeholder.com/400x300?text=Invalid+Image+URL';
                                    }}
                                />
                            ) : (
                                <div className="text-gray-400 flex flex-col items-center">
                                    <span className="text-4xl mb-2">🖼️</span>
                                    <span>No Image Selected</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Title */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Title <span className="text-gray-500">({post.title.length}/60 chars)</span>
                    </label>
                    <input
                        type="text"
                        value={post.title}
                        onChange={(e) => setPost({ ...post, title: e.target.value })}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {post.title.length > 60 && (
                        <p className="mt-1 text-xs text-orange-600">
                            ⚠️ Title terlalu panjang untuk SEO optimal
                        </p>
                    )}
                </div>

                {/* Meta Description */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Meta Description{' '}
                        <span className="text-gray-500">
                            ({post.metaDescription.length}/160 chars)
                        </span>
                    </label>
                    <textarea
                        value={post.metaDescription}
                        onChange={(e) =>
                            setPost({ ...post, metaDescription: e.target.value })
                        }
                        rows={2}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {(post.metaDescription.length < 140 ||
                        post.metaDescription.length > 160) && (
                            <p className="mt-1 text-xs text-orange-600">
                                ⚠️ Panjang ideal: 140-160 karakter
                            </p>
                        )}
                </div>

                {/* Keywords */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Keywords (comma separated)
                    </label>
                    <input
                        type="text"
                        value={post.keywords.join(', ')}
                        onChange={(e) =>
                            setPost({
                                ...post,
                                keywords: e.target.value.split(',').map((k) => k.trim()),
                            })
                        }
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>

                {/* Content Editor */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Content (HTML)
                    </label>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Raw HTML Editor */}
                        <div className="flex flex-col">
                            <div className="text-xs text-gray-500 mb-1">HTML Source</div>
                            <textarea
                                value={post.content}
                                onChange={(e) => setPost({ ...post, content: e.target.value })}
                                className="w-full h-[600px] p-4 font-mono text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        {/* Live Preview */}
                        <div className="flex flex-col">
                            <div className="text-xs text-gray-500 mb-1">Live Preview</div>
                            <div
                                className="w-full h-[600px] overflow-y-auto p-8 border border-gray-300 rounded-lg bg-white prose prose-blue max-w-none"
                                dangerouslySetInnerHTML={{ __html: post.content }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
