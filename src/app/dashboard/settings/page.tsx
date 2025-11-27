'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import SubscriptionCard from '@/components/dashboard/SubscriptionCard';
import { FaBuilding, FaCreditCard, FaCog } from 'react-icons/fa';

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [loadingSubscription, setLoadingSubscription] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      loadSubscription(parsedUser.tenantId);
    }
  }, []);

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

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Pengaturan Showroom</h1>
        <p className="text-gray-600">Kelola informasi showroom dan pengaturan sistem</p>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Quick Settings Links */}
        <div className="lg:col-span-2 space-y-4">
          {/* Business Information */}
          <Link
            href="/dashboard/settings/business"
            className="block bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <FaBuilding className="text-blue-600 text-xl" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Informasi Bisnis</h3>
                <p className="text-sm text-gray-600">
                  Kelola informasi kontak, alamat, jam operasional, dan media sosial showroom
                </p>
              </div>
              <div className="text-gray-400">→</div>
            </div>
          </Link>

          {/* System Settings */}
          <div className="block bg-white rounded-lg shadow p-6 opacity-75">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <FaCog className="text-gray-600 text-xl" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Pengaturan Sistem</h3>
                <p className="text-sm text-gray-600">
                  Notifikasi, integrasi, dan preferensi sistem lainnya
                </p>
                <span className="inline-block mt-2 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  Coming Soon
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Subscription Info */}
        <div className="lg:col-span-1">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <FaCreditCard className="text-blue-600" />
              Status Langganan
            </h2>
            <p className="text-sm text-gray-600">
              Informasi paket dan status langganan Anda
            </p>
          </div>
          {!loadingSubscription && <SubscriptionCard subscription={subscription} />}
        </div>
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
