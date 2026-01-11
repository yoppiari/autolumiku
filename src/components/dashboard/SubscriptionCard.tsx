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
      <div className="bg-[#2a2a2a] rounded-lg border border-[#3a3a3a]">
        <div className="px-2 py-1.5 border-b border-[#3a3a3a] flex items-center justify-center gap-1.5">
          <span className="text-sm">💳</span>
          <span className="text-[10px] md:text-xs font-semibold text-gray-200">Subscription</span>
        </div>
        <div className="p-2 text-center">
          <FaExclamationTriangle className="text-amber-500 text-lg mx-auto mb-1" />
          <p className="text-[10px] text-gray-300 font-medium">No active subscription</p>
        </div>
      </div>
    );
  }

  const getStatusColor = () => {
    switch (subscription.status.toLowerCase()) {
      case 'active':
        return 'bg-green-900/30 text-green-400 border border-green-800/50';
      case 'trialing':
        return 'bg-blue-900/30 text-blue-400 border border-blue-800/50';
      case 'past_due':
        return 'bg-yellow-900/30 text-yellow-400 border border-yellow-800/50';
      case 'canceled':
      case 'expired':
        return 'bg-red-900/30 text-red-400 border border-red-800/50';
      default:
        return 'bg-gray-800 text-gray-300';
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
    <div className="bg-[#2a2a2a] rounded-lg border border-[#3a3a3a]">
      {/* Header */}
      <div className="px-2 py-1.5 border-b border-[#3a3a3a] flex items-center justify-center gap-1.5">
        <span className="text-sm">💳</span>
        <span className="text-[10px] md:text-xs font-semibold text-gray-200">Subscription</span>
        <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-semibold ${getStatusColor()}`}>
          {getStatusLabel()}
        </span>
      </div>

      {/* Content - compact */}
      <div className="px-3 py-2">
        {/* Period Info */}
        <div className="text-center">
          <p className="text-[9px] text-gray-400">Berlaku hingga</p>
          <p className="text-sm font-bold text-white">{formatDate(subscription.currentPeriodEnd)}</p>
          <p className="text-[10px] text-blue-400 font-medium">{days > 0 ? `${days} hari tersisa` : 'Berakhir'}</p>
        </div>

        {/* Progress Bar */}
        <div className="my-2">
          <div className="bg-gray-700 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-1.5 rounded-full"
              style={{ width: `${Math.max(0, Math.min(100, (days / 365) * 100))}%` }}
            ></div>
          </div>
        </div>

        {/* Warning if expiring soon */}
        {days > 0 && days <= 30 && (
          <div className="bg-amber-900/20 rounded p-1 border border-amber-800/30 text-center mb-2">
            <p className="text-[8px] text-amber-500 font-medium">Segera berakhir!</p>
          </div>
        )}

        {/* Features - 2 columns */}
        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
          {['Unlimited kendaraan', 'WhatsApp AI', 'Custom domain', 'Support 24/7'].map((f) => (
            <div key={f} className="flex items-center gap-1">
              <FaCheckCircle className="text-green-500 text-[8px] flex-shrink-0" />
              <span className="text-[9px] text-gray-400">{f}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
