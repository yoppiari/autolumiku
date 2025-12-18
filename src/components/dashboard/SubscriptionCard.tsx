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
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden h-full">
        <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <span className="text-xl">💳</span>
            Subscription
          </h2>
        </div>
        <div className="p-6">
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FaExclamationTriangle className="text-amber-500 text-2xl" />
            </div>
            <p className="text-gray-700 font-medium">No active subscription</p>
            <p className="text-sm text-gray-500 mt-2">Please contact administrator</p>
          </div>
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
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-blue-50">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <span className="text-xl">💳</span>
            Langganan Enterprise
          </h2>
          <div className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 ${getStatusColor()}`}>
            {getStatusIcon()}
            {getStatusLabel()}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Annual Contract Info */}
        <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl p-5 text-white shadow-lg">
          <p className="text-sm text-blue-100 mb-1">Kontrak Tahunan</p>
          <p className="text-3xl font-bold">
            Rp {annualPrice.toLocaleString('id-ID')}
            <span className="text-sm text-blue-200 font-normal ml-1">/tahun</span>
          </p>
        </div>

        {/* Contract Period */}
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <p className="text-xs text-gray-500 mb-1">Mulai Kontrak</p>
              <p className="text-sm font-semibold text-gray-900">
                {formatDate(subscription.currentPeriodStart)}
              </p>
            </div>
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <p className="text-xs text-gray-500 mb-1">Berakhir Kontrak</p>
              <p className="text-sm font-semibold text-blue-600">
                {formatDate(subscription.currentPeriodEnd)}
              </p>
            </div>
          </div>

          {/* Contract Status */}
          {days > 0 && (
            <div className="mt-4 bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-600 font-medium">
                  Sisa Kontrak
                </p>
                <p className="text-base font-bold text-blue-600">
                  {days} hari <span className="text-gray-400 font-normal">({months} bulan)</span>
                </p>
              </div>
              <div className="bg-gray-200 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-2.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(0, Math.min(100, (days / 365) * 100))}%`,
                  }}
                ></div>
              </div>
            </div>
          )}

          {days <= 0 && (
            <div className="mt-4 bg-red-50 rounded-lg p-4 border border-red-100">
              <p className="text-sm text-red-600 font-semibold flex items-center gap-2">
                <FaExclamationTriangle className="text-red-500" />
                Kontrak telah berakhir
              </p>
              <p className="text-xs text-red-500 mt-1 ml-6">
                Hubungi administrator untuk perpanjangan
              </p>
            </div>
          )}

          {/* Renewal Warning - 30 days before expiry */}
          {days > 0 && days <= 30 && (
            <div className="mt-3 bg-amber-50 rounded-lg p-4 border border-amber-100">
              <p className="text-sm text-amber-700 font-semibold flex items-center gap-2">
                <FaClock className="text-amber-500" />
                Kontrak akan segera berakhir!
              </p>
              <p className="text-xs text-amber-600 mt-1 ml-6">
                Segera hubungi administrator untuk perpanjangan kontrak
              </p>
            </div>
          )}
        </div>

        {/* Enterprise Features */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
          <p className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <span className="text-lg">✨</span>
            Fitur Enterprise
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <FaCheckCircle className="text-green-500 text-xs flex-shrink-0" />
              <span>Unlimited kendaraan</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <FaCheckCircle className="text-green-500 text-xs flex-shrink-0" />
              <span>Analytics lengkap</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <FaCheckCircle className="text-green-500 text-xs flex-shrink-0" />
              <span>WhatsApp AI</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <FaCheckCircle className="text-green-500 text-xs flex-shrink-0" />
              <span>AI blog generator</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <FaCheckCircle className="text-green-500 text-xs flex-shrink-0" />
              <span>Custom domain</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <FaCheckCircle className="text-green-500 text-xs flex-shrink-0" />
              <span>Support 24/7</span>
            </div>
          </div>
        </div>

        {/* Contact Admin */}
        <div className="text-center py-2">
          <p className="text-xs text-gray-400">
            Pertanyaan? Hubungi administrator platform
          </p>
        </div>
      </div>
    </div>
  );
}
