/**
 * Subscription Card Component - Compact Version
 * Read-only display of subscription status for showroom admin
 */

'use client';

import React from 'react';
import { FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';

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
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden h-full">
        <div className="px-2 md:px-3 py-2 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-[10px] md:text-xs font-semibold text-gray-700 flex items-center gap-1">
            <span className="text-sm md:text-base">💳</span>
            <span className="truncate">Subscription</span>
          </h2>
        </div>
        <div className="p-3 md:p-4 text-center">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-amber-100 rounded-xl flex items-center justify-center mx-auto mb-2">
            <FaExclamationTriangle className="text-amber-500 text-lg md:text-xl" />
          </div>
          <p className="text-xs md:text-sm text-gray-700 font-medium">No active subscription</p>
          <p className="text-[10px] md:text-xs text-gray-500 mt-1">Please contact administrator</p>
        </div>
      </div>
    );
  }

  const getStatusColor = () => {
    switch (subscription.status.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-700';
      case 'trialing':
        return 'bg-blue-100 text-blue-700';
      case 'past_due':
        return 'bg-yellow-100 text-yellow-700';
      case 'canceled':
      case 'expired':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
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

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden h-full">
      {/* Header */}
      <div className="px-2 md:px-3 py-2 border-b border-gray-100 flex items-center justify-between gap-1">
        <h2 className="text-[10px] md:text-xs font-semibold text-gray-700 flex items-center gap-1 min-w-0">
          <span className="text-sm md:text-base flex-shrink-0">💳</span>
          <span className="truncate">Subscription</span>
        </h2>
        <span className={`px-1.5 md:px-2 py-0.5 rounded-full text-[9px] md:text-[10px] font-semibold flex-shrink-0 ${getStatusColor()}`}>
          {getStatusLabel()}
        </span>
      </div>

      <div className="p-2 md:p-3 space-y-2 md:space-y-3">
        {/* Period Info */}
        <div className="text-center">
          <p className="text-[10px] md:text-xs text-gray-500">Berlaku hingga</p>
          <p className="text-xs md:text-sm font-semibold text-gray-900">{formatDate(subscription.currentPeriodEnd)}</p>
          <p className="text-[10px] md:text-xs text-blue-600 font-medium mt-0.5">{days > 0 ? `${days} hari tersisa` : 'Berakhir'}</p>
        </div>

        {/* Progress Bar */}
        <div>
          <div className="bg-gray-100 rounded-full h-1 md:h-1.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-1 md:h-1.5 rounded-full transition-all"
              style={{ width: `${Math.max(0, Math.min(100, (days / 365) * 100))}%` }}
            ></div>
          </div>
        </div>

        {/* Warning */}
        {days > 0 && days <= 30 && (
          <div className="bg-amber-50 rounded-lg p-1.5 md:p-2 border border-amber-100 text-center">
            <p className="text-[9px] md:text-[10px] text-amber-700 font-medium">Segera berakhir! Hubungi admin.</p>
          </div>
        )}

        {/* Features - 2 columns compact */}
        <div className="grid grid-cols-2 gap-1">
          {['Unlimited kendaraan', 'WhatsApp AI', 'Custom domain', 'Support 24/7'].map((f) => (
            <div key={f} className="flex items-center gap-1 text-[9px] md:text-[10px] text-gray-600">
              <FaCheckCircle className="text-green-500 text-[7px] md:text-[8px] flex-shrink-0" />
              <span className="truncate">{f}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
