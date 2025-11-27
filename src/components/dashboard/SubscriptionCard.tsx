/**
 * Subscription Card Component
 * Read-only display of subscription status for showroom admin
 * Single plan: Enterprise Annual Contract
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { FaCheckCircle, FaExclamationTriangle, FaTimesCircle, FaClock } from 'react-icons/fa';

interface SubscriptionCardProps {
  subscription: {
    plan: string; // Always "enterprise"
    status: string; // active, past_due, canceled, expired
    currentPeriodStart: string;
    currentPeriodEnd: string;
    trialEnd: string | null;
    pricePerMonth: number; // Will be annual price / 12
    currency: string;
  } | null;
}

export default function SubscriptionCard({ subscription }: SubscriptionCardProps) {
  if (!subscription) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Subscription</h2>
        <div className="text-center py-8">
          <FaExclamationTriangle className="text-yellow-500 text-4xl mx-auto mb-4" />
          <p className="text-gray-600">No active subscription</p>
          <p className="text-sm text-gray-500 mt-2">Please contact administrator</p>
        </div>
      </div>
    );
  }

  const getStatusIcon = () => {
    switch (subscription.status.toLowerCase()) {
      case 'active':
        return <FaCheckCircle className="text-green-500" />;
      case 'trialing':
        return <FaClock className="text-blue-500" />;
      case 'past_due':
        return <FaExclamationTriangle className="text-yellow-500" />;
      case 'canceled':
      case 'expired':
        return <FaTimesCircle className="text-red-500" />;
      default:
        return <FaClock className="text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    switch (subscription.status.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'trialing':
        return 'bg-blue-100 text-blue-800';
      case 'past_due':
        return 'bg-yellow-100 text-yellow-800';
      case 'canceled':
      case 'expired':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = () => {
    switch (subscription.status.toLowerCase()) {
      case 'active':
        return 'Aktif';
      case 'trialing':
        return 'Trial';
      case 'past_due':
        return 'Menunggak';
      case 'canceled':
        return 'Dibatalkan';
      case 'expired':
        return 'Kedaluwarsa';
      default:
        return subscription.status;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const daysRemaining = () => {
    const endDate = new Date(subscription.currentPeriodEnd);
    const today = new Date();
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const monthsRemaining = () => {
    const days = daysRemaining();
    return Math.ceil(days / 30);
  };

  const days = daysRemaining();
  const months = monthsRemaining();
  const annualPrice = subscription.pricePerMonth * 12; // Calculate annual from monthly

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">Langganan Enterprise</h2>
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor()}`}>
          {getStatusLabel()}
        </div>
      </div>

      <div className="space-y-4">
        {/* Status Icon */}
        <div className="flex items-center justify-center py-4">
          <div className="text-6xl">
            {getStatusIcon()}
          </div>
        </div>

        {/* Annual Contract Info */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-100">
          <p className="text-sm text-gray-600 mb-1">Kontrak Tahunan</p>
          <p className="text-3xl font-bold text-gray-900">
            Rp {annualPrice.toLocaleString('id-ID')}
            <span className="text-sm text-gray-500 font-normal">/tahun</span>
          </p>
        </div>

        {/* Contract Period */}
        <div className="border-t pt-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
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

          {/* Contract Status */}
          {days > 0 && (
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-blue-700 font-medium">
                  Sisa Kontrak
                </p>
                <p className="text-lg font-bold text-blue-900">
                  {days} hari ({months} bulan)
                </p>
              </div>
              <div className="bg-blue-200 rounded-full h-2.5">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all"
                  style={{
                    width: `${Math.max(0, Math.min(100, (days / 365) * 100))}%`,
                  }}
                ></div>
              </div>
            </div>
          )}

          {days <= 0 && (
            <div className="bg-red-50 rounded-lg p-4">
              <p className="text-sm text-red-600 font-medium">
                ⚠️ Kontrak telah berakhir
              </p>
              <p className="text-xs text-red-500 mt-1">
                Hubungi administrator untuk perpanjangan
              </p>
            </div>
          )}

          {/* Renewal Warning - 30 days before expiry */}
          {days > 0 && days <= 30 && (
            <div className="bg-yellow-50 rounded-lg p-4 mt-2">
              <p className="text-sm text-yellow-800 font-medium">
                ⏰ Kontrak akan segera berakhir!
              </p>
              <p className="text-xs text-yellow-700 mt-1">
                Segera hubungi administrator untuk perpanjangan kontrak
              </p>
            </div>
          )}
        </div>

        {/* Enterprise Features */}
        <div className="border-t pt-4">
          <p className="text-sm font-medium text-gray-700 mb-3">Fitur Enterprise</p>
          <ul className="text-sm text-gray-600 space-y-2">
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <span>Unlimited kendaraan</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <span>Analytics & reporting lengkap</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <span>WhatsApp integration</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <span>AI-powered blog generator</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <span>Custom branding & domain</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <span>Priority support 24/7</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <span>API access</span>
            </li>
          </ul>
        </div>

        {/* Contact Admin */}
        <div className="border-t pt-4">
          <p className="text-xs text-gray-500 text-center">
            Pertanyaan tentang langganan? Hubungi administrator platform
          </p>
        </div>
      </div>
    </div>
  );
}
