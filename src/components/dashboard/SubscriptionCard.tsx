/**
 * Subscription Card Component - Compact Version
 * Read-only display of subscription status for showroom admin
 */

'use client';

import React from 'react';
import { FaCheckCircle, FaExclamationTriangle, FaTimesCircle, FaClock } from 'react-icons/fa';

interface SubscriptionCardProps {
  subscription: {
    plan: string;
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    trialEnd: string | null;
    pricePerMonth: number;
    currency: string;
  } | null;
}

export default function SubscriptionCard({ subscription }: SubscriptionCardProps) {
  if (!subscription) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-full">
        <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
            <span>💳</span>
            Subscription
          </h2>
        </div>
        <div className="p-4">
          <div className="text-center py-4">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center mx-auto mb-2">
              <FaExclamationTriangle className="text-amber-500 text-sm" />
            </div>
            <p className="text-xs text-gray-700 font-medium">No active subscription</p>
            <p className="text-[10px] text-gray-500 mt-1">Please contact administrator</p>
          </div>
        </div>
      </div>
    );
  }

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
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const daysRemaining = () => {
    const endDate = new Date(subscription.currentPeriodEnd);
    const today = new Date();
    const diffTime = endDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const days = daysRemaining();
  const annualPrice = subscription.pricePerMonth * 12;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-full">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-blue-50">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
            <span>💳</span>
            Subscription
          </h2>
          <div className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${getStatusColor()}`}>
            {getStatusLabel()}
          </div>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {/* Price */}
        <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg p-3 text-white">
          <p className="text-[10px] text-blue-100">Kontrak Tahunan</p>
          <p className="text-lg font-bold">
            Rp {annualPrice.toLocaleString('id-ID')}
            <span className="text-[10px] text-blue-200 font-normal">/thn</span>
          </p>
        </div>

        {/* Period & Progress */}
        <div className="bg-gray-50 rounded-lg p-2.5">
          <div className="flex justify-between text-[10px] text-gray-500 mb-1.5">
            <span>{formatDate(subscription.currentPeriodStart)}</span>
            <span>{formatDate(subscription.currentPeriodEnd)}</span>
          </div>
          <div className="bg-gray-200 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-1.5 rounded-full"
              style={{ width: `${Math.max(0, Math.min(100, (days / 365) * 100))}%` }}
            ></div>
          </div>
          <p className="text-center text-xs font-medium text-gray-700 mt-1.5">
            {days > 0 ? `${days} hari tersisa` : 'Kontrak berakhir'}
          </p>
        </div>

        {/* Warning */}
        {days > 0 && days <= 30 && (
          <div className="bg-amber-50 rounded-lg p-2 border border-amber-100">
            <p className="text-[10px] text-amber-700 font-medium flex items-center gap-1">
              <FaClock className="text-amber-500" />
              Segera berakhir! Hubungi admin.
            </p>
          </div>
        )}

        {days <= 0 && (
          <div className="bg-red-50 rounded-lg p-2 border border-red-100">
            <p className="text-[10px] text-red-600 font-medium flex items-center gap-1">
              <FaExclamationTriangle className="text-red-500" />
              Kontrak berakhir. Hubungi admin.
            </p>
          </div>
        )}

        {/* Features - Compact */}
        <div className="grid grid-cols-2 gap-1">
          {['Unlimited kendaraan', 'WhatsApp AI', 'Custom domain', 'Support 24/7'].map((f) => (
            <div key={f} className="flex items-center gap-1 text-[10px] text-gray-600">
              <FaCheckCircle className="text-green-500 text-[8px]" />
              <span>{f}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
