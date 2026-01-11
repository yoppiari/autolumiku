'use client';

import { useState, useEffect, useRef } from 'react';
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
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [post, setPost] = useState<BlogPost | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Handle image upload
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !post) return;

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
            setError('Format file tidak didukung. Gunakan JPEG, PNG, WebP, atau GIF.');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            setError('Ukuran file terlalu besar. Maksimal 5MB.');
            return;
        }

        setIsUploading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('tenantId', user?.tenantId || 'default');

            const response = await fetch('/api/v1/blog/upload', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Gagal upload gambar');
            }

            const data = await response.json();
            setPost({ ...post, featuredImage: data.data.url });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Gagal upload gambar');
        } finally {
            setIsUploading(false);
        }
    };

    const handleRemoveImage = () => {
        if (post) {
            setPost({ ...post, featuredImage: null });
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

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

        // Validate tenantId
        if (!user?.tenantId) {
            console.error('[Blog Edit] Missing tenantId', { user });
            setError('Error: User tenant ID tidak ditemukan. Silakan login ulang.');
            return;
        }

        setIsSaving(true);
        setError(null);

        console.log('[Blog Edit] Saving post:', {
            postId: params.id,
            tenantId: user.tenantId,
            status: status || post.status,
            slug: post.slug,
        });

        try {
            const response = await fetch(`/api/v1/blog/${params.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...post,
                    status: status || post.status,
                    tenantId: user.tenantId,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                console.error('[Blog Edit] API Error:', errorData);
                throw new Error(errorData.error || errorData.message || 'Gagal menyimpan perubahan');
            }

            const result = await response.json();
            console.log('[Blog Edit] Save successful:', result);

            alert('Perubahan berhasil disimpan!');
            router.push('/dashboard/blog');
        } catch (err) {
            console.error('[Blog Edit] Save error:', err);
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
                    <h3 className="text-lg font-semibold mb-3">Featured Image</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Upload Section */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Upload Gambar
                            </label>
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/gif"
                                    onChange={handleImageUpload}
                                    className="hidden"
                                    id="featured-image-upload"
                                />
                                <label
                                    htmlFor="featured-image-upload"
                                    className={`cursor-pointer flex flex-col items-center ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
                                >
                                    {isUploading ? (
                                        <>
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                                            <span className="text-gray-600 text-sm">Mengupload...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-3xl mb-2">+</span>
                                            <span className="text-blue-600 font-medium text-sm">Klik untuk upload</span>
                                            <span className="text-xs text-gray-500 mt-1">JPEG, PNG, WebP, GIF (max 5MB)</span>
                                        </>
                                    )}
                                </label>
                            </div>
                            <p className="mt-2 text-xs text-gray-500">
                                Gambar akan di-resize ke 1200x630 untuk optimal social sharing.
                            </p>
                        </div>
                        {/* Preview Section */}
                        <div className="flex items-center justify-center bg-gray-200 rounded-lg h-48 overflow-hidden relative">
                            {post.featuredImage ? (
                                <>
                                    <img
                                        src={post.featuredImage}
                                        alt="Preview"
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src =
                                                'https://via.placeholder.com/400x300?text=Invalid+Image+URL';
                                        }}
                                    />
                                    <button
                                        onClick={handleRemoveImage}
                                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600"
                                    >
                                        X
                                    </button>
                                </>
                            ) : (
                                <div className="text-gray-400 flex flex-col items-center">
                                    <span className="text-4xl mb-2">No Image</span>
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
