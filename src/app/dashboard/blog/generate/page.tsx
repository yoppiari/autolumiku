'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

type BlogCategory =
  | 'BUYING_GUIDE'
  | 'COMPARISON'
  | 'MAINTENANCE_TIPS'
  | 'MARKET_NEWS'
  | 'FEATURE_REVIEW'
  | 'FINANCING'
  | 'LOCAL_INSIGHTS';

type BlogTone = 'FORMAL' | 'CASUAL' | 'FRIENDLY';

interface GeneratedBlog {
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
  relatedTopics: string[];
  featuredImage?: string;
}

const CATEGORIES = [
  {
    id: 'BUYING_GUIDE',
    name: 'Panduan Membeli',
    icon: '📖',
    description: 'Tips dan checklist membeli mobil bekas',
  },
  {
    id: 'COMPARISON',
    name: 'Perbandingan',
    icon: '⚖️',
    description: 'Bandingkan model kendaraan',
  },
  {
    id: 'MAINTENANCE_TIPS',
    name: 'Tips Perawatan',
    icon: '🔧',
    description: 'Panduan merawat kendaraan',
  },
  {
    id: 'MARKET_NEWS',
    name: 'Berita Pasar',
    icon: '📰',
    description: 'Update harga dan tren pasar',
  },
  {
    id: 'FEATURE_REVIEW',
    name: 'Review Fitur',
    icon: '⭐',
    description: 'Ulasan fitur kendaraan',
  },
  {
    id: 'FINANCING',
    name: 'Panduan Kredit',
    icon: '💰',
    description: 'Info pembiayaan dan kredit',
  },
  {
    id: 'LOCAL_INSIGHTS',
    name: 'Insight Lokal',
    icon: '📍',
    description: 'Tips berkendara di area lokal',
  },
];

export default function BlogGeneratorPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState<'form' | 'preview'>('form');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [category, setCategory] = useState<BlogCategory>('BUYING_GUIDE');
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState<BlogTone>('CASUAL');
  const [targetLocation, setTargetLocation] = useState('Jakarta');

  // Generated blog state
  const [generatedBlog, setGeneratedBlog] = useState<GeneratedBlog | null>(null);
  const [editedBlog, setEditedBlog] = useState<GeneratedBlog | null>(null);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError('Topik tidak boleh kosong');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      if (!user?.tenantId) {
        setError('Blog hanya bisa dibuat oleh Showroom Admin. Super Admin tidak memiliki tenant. Silakan login sebagai Showroom Admin untuk membuat blog.');
        setIsGenerating(false);
        return;
      }

      const response = await fetch('/api/v1/blog/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          topic,
          tone,
          targetLocation,
          tenantId: user.tenantId, // ✅ From auth context
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Gagal generate blog');
      }

      const data = await response.json();
      setGeneratedBlog(data.data);
      setEditedBlog(data.data);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async (status: 'DRAFT' | 'PUBLISHED') => {
    if (!editedBlog) return;

    try {
      if (!user?.tenantId || !user?.id) {
        setError('Blog hanya bisa disimpan oleh Showroom Admin. Super Admin tidak memiliki tenant. Silakan login sebagai Showroom Admin untuk menyimpan blog.');
        return;
      }

      // Remove relatedTopics from data (not in schema)
      const { relatedTopics, ...blogData } = editedBlog;

      const response = await fetch('/api/v1/blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...blogData,
          category,
          tone,
          targetLocation,
          status,
          tenantId: user.tenantId,      // ✅ From auth context
          authorId: user.id,            // ✅ From auth context
          authorName: user.fullName,    // ✅ From auth context
        }),
      });

      if (!response.ok) {
        throw new Error('Gagal menyimpan blog');
      }

      alert(
        status === 'DRAFT'
          ? 'Blog berhasil disimpan sebagai draft!'
          : 'Blog berhasil dipublish!'
      );
      router.push('/dashboard/blog');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan');
    }
  };

  if (step === 'preview' && editedBlog) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => setStep('form')}
            className="text-blue-600 hover:text-blue-800 flex items-center gap-2"
          >
            ← Kembali ke Form
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <h1 className="text-2xl font-bold">Preview Article</h1>
            <div className="flex gap-4 text-sm">
              <div className="text-center">
                <div className="font-semibold text-lg text-blue-600">
                  {editedBlog.seoScore}/100
                </div>
                <div className="text-gray-600">SEO Score</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-lg text-green-600">
                  {editedBlog.wordCount}
                </div>
                <div className="text-gray-600">Words</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-lg text-purple-600">
                  {editedBlog.readabilityScore.toFixed(0)}
                </div>
                <div className="text-gray-600">Readability</div>
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
                    value={editedBlog.featuredImage || ''}
                    onChange={(e) =>
                      setEditedBlog({ ...editedBlog, featuredImage: e.target.value })
                    }
                    placeholder="https://example.com/image.jpg"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    Masukkan URL gambar yang ingin ditampilkan sebagai cover artikel.
                  </p>
                </div>
                <div className="flex items-center justify-center bg-gray-200 rounded-lg h-48 overflow-hidden">
                  {editedBlog.featuredImage ? (
                    <img
                      src={editedBlog.featuredImage}
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
          </div>

          {/* Title */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title <span className="text-gray-500">({editedBlog.title.length}/60 chars)</span>
            </label>
            <input
              type="text"
              value={editedBlog.title}
              onChange={(e) =>
                setEditedBlog({ ...editedBlog, title: e.target.value })
              }
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {editedBlog.title.length > 60 && (
              <p className="mt-1 text-xs text-orange-600">
                ⚠️ Title terlalu panjang untuk SEO optimal
              </p>
            )}
          </div>

          {/* Meta Description */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Meta Description{' '}
              <span className="text-gray-500">({editedBlog.metaDescription.length}/160 chars)</span>
            </label>
            <textarea
              value={editedBlog.metaDescription}
              onChange={(e) =>
                setEditedBlog({ ...editedBlog, metaDescription: e.target.value })
              }
              rows={2}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {(editedBlog.metaDescription.length < 140 ||
              editedBlog.metaDescription.length > 160) && (
                <p className="mt-1 text-xs text-orange-600">
                  ⚠️ Panjang ideal: 140-160 karakter
                </p>
              )}
          </div>

          {/* Keywords */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Keywords
            </label>
            <div className="flex flex-wrap gap-2">
              {editedBlog.keywords.map((keyword, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>

          {/* Local Keywords */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Local Keywords
            </label>
            <div className="flex flex-wrap gap-2">
              {editedBlog.localKeywords.map((keyword, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
                >
                  📍 {keyword}
                </span>
              ))}
            </div>
          </div>

          {/* Content Preview */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Content Preview
            </label>
            <div
              className="prose max-w-none p-4 border border-gray-300 rounded-lg bg-gray-50"
              dangerouslySetInnerHTML={{ __html: editedBlog.content }}
            />
          </div>

          {/* Related Topics */}
          {editedBlog.relatedTopics && editedBlog.relatedTopics.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Related Topics (for internal linking)
              </label>
              <div className="flex flex-wrap gap-2">
                {editedBlog.relatedTopics.map((topic, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                  >
                    🔗 {topic}
                  </span>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between pt-4 border-t">
            <button
              onClick={() => router.push('/dashboard/blog')}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Batal
            </button>
            <div className="flex gap-3">
              <button
                onClick={() => handleSave('DRAFT')}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Simpan sebagai Draft
              </button>
              <button
                onClick={() => handleSave('PUBLISHED')}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Publish Sekarang
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold mb-2">Generate Blog Post dengan AI</h1>
        <p className="text-gray-600 mb-8">
          Buat artikel SEO-optimized dalam hitungan menit
        </p>

        {/* Tenant Warning - Show if user has no tenantId */}
        {!user?.tenantId && (
          <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium">Super Admin tidak bisa membuat blog</h3>
                <div className="mt-2 text-sm">
                  <p>Blog posts harus terkait dengan tenant (showroom) tertentu. Silakan login sebagai <strong>Showroom Admin</strong> untuk menggunakan fitur ini.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Category */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">1. Pilih Tipe Konten</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id as BlogCategory)}
                className={`p-4 border-2 rounded-lg text-left transition-all ${category === cat.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300'
                  }`}
              >
                <div className="text-3xl mb-2">{cat.icon}</div>
                <div className="font-semibold text-sm mb-1">{cat.name}</div>
                <div className="text-xs text-gray-600">{cat.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Topic */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">2. Input Topik</h2>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder='Contoh: "Toyota Avanza 2020" atau "Perbandingan SUV keluarga"'
            className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="mt-2 text-sm text-gray-600">
            💡 Tip: Semakin spesifik topik, semakin relevan artikel yang dihasilkan
          </p>
        </div>

        {/* Step 3: Tone */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">3. Pilih Tone</h2>
          <div className="space-y-3">
            <label className="flex items-start gap-3 p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="tone"
                value="FORMAL"
                checked={tone === 'FORMAL'}
                onChange={(e) => setTone(e.target.value as BlogTone)}
                className="mt-1"
              />
              <div>
                <div className="font-semibold">Formal</div>
                <div className="text-sm text-gray-600">
                  Profesional, edukatif - untuk artikel teknis dan panduan detail
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="tone"
                value="CASUAL"
                checked={tone === 'CASUAL'}
                onChange={(e) => setTone(e.target.value as BlogTone)}
                className="mt-1"
              />
              <div>
                <div className="font-semibold">
                  Casual <span className="text-blue-600 text-xs">✓ Recommended</span>
                </div>
                <div className="text-sm text-gray-600">
                  Santai, mudah dipahami - untuk artikel umum dan tips
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="tone"
                value="FRIENDLY"
                checked={tone === 'FRIENDLY'}
                onChange={(e) => setTone(e.target.value as BlogTone)}
                className="mt-1"
              />
              <div>
                <div className="font-semibold">Friendly</div>
                <div className="text-sm text-gray-600">
                  Hangat, personal - untuk artikel yang engaging dan dekat dengan pembaca
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Step 4: Location */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">4. Lokasi Target (Local SEO)</h2>
          <input
            type="text"
            value={targetLocation}
            onChange={(e) => setTargetLocation(e.target.value)}
            placeholder="Jakarta"
            className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="mt-2 text-sm text-gray-600">
            💡 Artikel akan dioptimasi untuk pencarian lokal di area ini
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Generate Button */}
        <div className="flex justify-between pt-6 border-t">
          <button
            onClick={() => router.push('/dashboard/blog')}
            className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Batal
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !topic.trim()}
            className={`px-8 py-3 rounded-lg font-semibold flex items-center gap-2 ${isGenerating || !topic.trim()
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
          >
            {isGenerating ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Generating...
              </>
            ) : (
              <>
                🤖 Generate Article
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
