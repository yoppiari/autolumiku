/**
 * Subscription Card Component
 * Read-only display of subscription status for showroom admin
 */

'use client';

import React from 'react';
import Link from 'next/link';
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
    switch (subscription.status) {
      case 'Active':
        return <FaCheckCircle className="text-green-500" />;
      case 'Trial':
        return <FaClock className="text-blue-500" />;
      case 'Suspended':
        return <FaExclamationTriangle className="text-yellow-500" />;
      case 'Expired':
        return <FaTimesCircle className="text-red-500" />;
      default:
        return <FaClock className="text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    switch (subscription.status) {
      case 'Active':
        return 'bg-green-100 text-green-800';
      case 'Trial':
        return 'bg-blue-100 text-blue-800';
      case 'Suspended':
        return 'bg-yellow-100 text-yellow-800';
      case 'Expired':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
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

  const days = daysRemaining();

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">Subscription</h2>
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor()}`}>
          {subscription.status}
        </div>
      </div>

      <div className="space-y-4">
        {/* Plan */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Current Plan</p>
            <p className="text-xl font-bold text-gray-900">{subscription.plan}</p>
          </div>
          <div className="text-3xl">
            {getStatusIcon()}
          </div>
        </div>

        {/* Price */}
        <div className="border-t pt-4">
          <p className="text-sm text-gray-500 mb-1">Monthly Rate</p>
          <p className="text-2xl font-bold text-gray-900">
            Rp {subscription.pricePerMonth.toLocaleString('id-ID')}
            <span className="text-sm text-gray-500 font-normal">/{subscription.currency}</span>
          </p>
        </div>

        {/* Period */}
        <div className="border-t pt-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500 mb-1">Period Start</p>
            <p className="text-sm font-medium text-gray-900">
              {formatDate(subscription.currentPeriodStart)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Period End</p>
            <p className="text-sm font-medium text-gray-900">
              {formatDate(subscription.currentPeriodEnd)}
            </p>
          </div>
        </div>

        {/* Days Remaining */}
        {days > 0 && (
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm text-blue-600 font-medium">
              {days} day{days !== 1 ? 's' : ''} remaining
            </p>
            <div className="mt-2 bg-blue-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{
                  width: `${Math.max(0, Math.min(100, (days / 30) * 100))}%`,
                }}
              ></div>
            </div>
          </div>
        )}

        {days <= 0 && (
          <div className="bg-red-50 rounded-lg p-4">
            <p className="text-sm text-red-600 font-medium">
              Subscription expired
            </p>
          </div>
        )}

        {/* Trial Info */}
        {subscription.trialEnd && subscription.status === 'Trial' && (
          <div className="bg-yellow-50 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              Trial ends: {formatDate(subscription.trialEnd)}
            </p>
          </div>
        )}

        {/* Plan Features */}
        <div className="border-t pt-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Plan Features</p>
          <ul className="text-sm text-gray-600 space-y-1">
            {subscription.plan === 'Basic' && (
              <>
                <li>✓ Up to 100 vehicles</li>
                <li>✓ Basic analytics</li>
                <li>✓ Email support</li>
              </>
            )}
            {subscription.plan === 'Professional' && (
              <>
                <li>✓ Up to 500 vehicles</li>
                <li>✓ Advanced analytics</li>
                <li>✓ Priority support</li>
                <li>✓ Custom branding</li>
              </>
            )}
            {subscription.plan === 'Enterprise' && (
              <>
                <li>✓ Unlimited vehicles</li>
                <li>✓ Premium analytics</li>
                <li>✓ 24/7 dedicated support</li>
                <li>✓ Custom branding</li>
                <li>✓ API access</li>
              </>
            )}
          </ul>
        </div>

        {/* Contact Admin */}
        <div className="border-t pt-4">
          <p className="text-xs text-gray-500">
            Need to upgrade or have questions? Contact your administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
