'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FaBuilding, FaCreditCard, FaChevronDown, FaChevronUp, FaCheckCircle, FaExclamationTriangle, FaTimesCircle } from 'react-icons/fa';
import Link from 'next/link';
import { ROLE_LEVELS } from '@/lib/rbac';

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [loadingSubscription, setLoadingSubscription] = useState(true);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  // Access guard: ADMIN+ only (Super Admin, Owner, Admin)
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      const roleLevel = parsedUser.roleLevel || ROLE_LEVELS.SALES;

      setUser(parsedUser);
      loadSubscription(parsedUser.tenantId);
    }
  }, [router]);

  const loadSubscription = async (tenantId: string) => {
    try {
      const response = await fetch(`/api/v1/tenants/${tenantId}/subscription`);
      if (response.ok) {
        const data = await response.json();
        setSubscription(data.data?.subscription || null);
      }
    } catch (error) {
      console.error('Failed to load subscription:', error);
    } finally {
      setLoadingSubscription(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const getStatusBadge = () => {
    if (!subscription) {
      return (
        <span className="px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800 flex items-center gap-1">
          <FaExclamationTriangle className="text-xs" />
          Tidak Aktif
        </span>
      );
    }

    const status = subscription.status.toLowerCase();
    if (status === 'active') {
      return (
        <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 flex items-center gap-1">
          <FaCheckCircle className="text-xs" />
          Aktif
        </span>
      );
    } else if (status === 'past_due') {
      return (
        <span className="px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800 flex items-center gap-1">
          <FaExclamationTriangle className="text-xs" />
          Menunggak
        </span>
      );
    } else {
      return (
        <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 flex items-center gap-1">
          <FaTimesCircle className="text-xs" />
          Tidak Aktif
        </span>
      );
    }
  };

  const getDaysRemaining = () => {
    if (!subscription) return 0;
    const endDate = new Date(subscription.currentPeriodEnd);
    const today = new Date();
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const daysRemaining = getDaysRemaining();
  const monthsRemaining = Math.ceil(daysRemaining / 30);

  // Show nothing while checking access or if access denied
  // No access restrictions for viewing
  if (false && (accessDenied || !user)) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Pengaturan Showroom</h1>
        <p className="text-gray-600">Kelola langganan dan informasi showroom Anda</p>
      </div>

      {/* Subscription Status Section */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <button
          onClick={() => toggleSection('subscription')}
          className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-4 flex-1">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <FaCreditCard className="text-blue-600 text-xl" />
            </div>
            <div className="flex-1 text-left">
              <div className="flex items-center gap-3 mb-1">
                <h3 className="text-lg font-semibold text-gray-900">Status Langganan</h3>
                {getStatusBadge()}
              </div>
              {!loadingSubscription && subscription && (
                <p className="text-sm text-gray-600">
                  Sisa kontrak: <span className="font-semibold text-blue-600">{daysRemaining} hari</span> ({monthsRemaining} bulan)
                </p>
              )}
              {!loadingSubscription && !subscription && (
                <p className="text-sm text-gray-600">Tidak ada langganan aktif</p>
              )}
            </div>
          </div>
          {expandedSection === 'subscription' ? (
            <FaChevronUp className="text-gray-400 flex-shrink-0" />
          ) : (
            <FaChevronDown className="text-gray-400 flex-shrink-0" />
          )}
        </button>

        {/* Expanded Content */}
        {expandedSection === 'subscription' && (
          <div className="border-t border-gray-200 p-6 bg-gray-50">
            {loadingSubscription ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-600 mt-4">Memuat data langganan...</p>
              </div>
            ) : !subscription ? (
              <div className="text-center py-8">
                <FaExclamationTriangle className="text-yellow-500 text-4xl mx-auto mb-4" />
                <p className="text-gray-600 mb-2">Tidak ada langganan aktif</p>
                <p className="text-sm text-gray-500">Hubungi administrator untuk mengaktifkan langganan</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Contract Info */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-100">
                  <p className="text-sm text-gray-600 mb-1">Kontrak Tahunan Enterprise</p>
                  <p className="text-3xl font-bold text-gray-900">
                    Rp {(subscription.pricePerMonth * 12).toLocaleString('id-ID')}
                    <span className="text-sm text-gray-500 font-normal">/tahun</span>
                  </p>
                </div>

                {/* Contract Period */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Mulai Kontrak</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatDate(subscription.currentPeriodStart)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Berakhir Kontrak</p>
                    <p className="text-sm font-bold text-blue-600">
                      {formatDate(subscription.currentPeriodEnd)}
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                {daysRemaining > 0 && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-blue-700 font-medium">Sisa Kontrak</p>
                      <p className="text-lg font-bold text-blue-900">
                        {daysRemaining} hari ({monthsRemaining} bulan)
                      </p>
                    </div>
                    <div className="bg-blue-200 rounded-full h-2.5">
                      <div
                        className="bg-blue-600 h-2.5 rounded-full transition-all"
                        style={{ width: `${Math.max(0, Math.min(100, (daysRemaining / 365) * 100))}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Warning if expiring soon */}
                {daysRemaining > 0 && daysRemaining <= 30 && (
                  <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                    <p className="text-sm text-yellow-800 font-medium">
                      ⏰ Kontrak akan segera berakhir!
                    </p>
                    <p className="text-xs text-yellow-700 mt-1">
                      Segera hubungi administrator untuk perpanjangan kontrak
                    </p>
                  </div>
                )}

                {/* Enterprise Features */}
                <div className="pt-4 border-t">
                  <p className="text-sm font-medium text-gray-700 mb-3">Fitur Enterprise</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {[
                      'Unlimited kendaraan',
                      'Analytics & reporting lengkap',
                      'WhatsApp integration',
                      'AI-powered blog generator',
                      'Custom branding & domain',
                      'Priority support 24/7',
                      'API access',
                    ].map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                        <span className="text-green-500">✓</span>
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Contact Admin */}
                <div className="pt-4 border-t">
                  <p className="text-xs text-gray-500 text-center">
                    Pertanyaan tentang langganan? Hubungi administrator platform
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Business Information Section */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <Link
          href="/dashboard/settings/business"
          className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-4 flex-1">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <FaBuilding className="text-green-600 text-xl" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Informasi Bisnis</h3>
              <p className="text-sm text-gray-600">
                Kelola kontak, alamat, jam operasional, dan media sosial showroom
              </p>
            </div>
          </div>
          <div className="text-gray-400 text-xl flex-shrink-0">→</div>
        </Link>
      </div>

      {/* Information Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          💡 <strong>Tips:</strong> Pastikan informasi bisnis Anda selalu up-to-date agar pelanggan dapat menghubungi showroom dengan mudah.
        </p>
      </div>
    </div>
  );
}
