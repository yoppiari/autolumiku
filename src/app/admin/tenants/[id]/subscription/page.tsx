/**
 * Super Admin - Tenant Subscription Management
 * Assign/Update subscription plans for tenants
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

interface Subscription {
  id: string;
  plan: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEnd: string | null;
  pricePerMonth: number;
  currency: string;
}

interface Tenant {
  id: string;
  name: string;
  subscription: Subscription | null;
}

export default function TenantSubscriptionPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState({
    plan: 'Basic',
    status: 'Trial',
    currentPeriodStart: '',
    currentPeriodEnd: '',
    trialEnd: '',
    pricePerMonth: '0',
  });

  useEffect(() => {
    loadTenantSubscription();
  }, [tenantId]);

  const loadTenantSubscription = async () => {
    try {
      const response = await fetch(`/api/v1/tenants/${tenantId}/subscription`);
      if (response.ok) {
        const data = await response.json();
        setTenant(data.data);

        if (data.data.subscription) {
          const sub = data.data.subscription;
          setFormData({
            plan: sub.plan,
            status: sub.status,
            currentPeriodStart: new Date(sub.currentPeriodStart).toISOString().split('T')[0],
            currentPeriodEnd: new Date(sub.currentPeriodEnd).toISOString().split('T')[0],
            trialEnd: sub.trialEnd ? new Date(sub.trialEnd).toISOString().split('T')[0] : '',
            pricePerMonth: sub.pricePerMonth.toString(),
          });
        } else {
          // Set default dates for new subscription
          const today = new Date();
          const endDate = new Date(today);
          endDate.setMonth(endDate.getMonth() + 1);

          setFormData({
            plan: 'Basic',
            status: 'Trial',
            currentPeriodStart: today.toISOString().split('T')[0],
            currentPeriodEnd: endDate.toISOString().split('T')[0],
            trialEnd: endDate.toISOString().split('T')[0],
            pricePerMonth: '0',
          });
        }
      }
    } catch (error) {
      console.error('Failed to load subscription:', error);
      setMessage({ type: 'error', text: 'Failed to load subscription data' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/v1/tenants/${tenantId}/subscription`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Subscription updated successfully!' });
        setTimeout(() => {
          router.push('/admin/tenants');
        }, 1500);
      } else {
        throw new Error('Failed to update subscription');
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update subscription. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handlePlanChange = (plan: string) => {
    setFormData({ ...formData, plan });

    // Update price based on plan
    const prices: Record<string, string> = {
      'Basic': '99000',
      'Professional': '299000',
      'Enterprise': '999000',
    };

    setFormData(prev => ({
      ...prev,
      plan,
      pricePerMonth: prices[plan] || '0',
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Link href="/admin/tenants" className="text-blue-600 hover:text-blue-800">
            ← Back to Tenants
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Manage Subscription</h1>
        {tenant && (
          <p className="text-gray-600">Tenant: {tenant.name}</p>
        )}
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-6 p-4 rounded-md ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Plan Selection */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Subscription Plan</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {['Basic', 'Professional', 'Enterprise'].map((plan) => (
              <div
                key={plan}
                onClick={() => handlePlanChange(plan)}
                className={`cursor-pointer border-2 rounded-lg p-4 transition-all ${
                  formData.plan === plan
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <h3 className="font-semibold text-lg mb-2">{plan}</h3>
                <p className="text-2xl font-bold text-blue-600">
                  Rp {plan === 'Basic' ? '99K' : plan === 'Professional' ? '299K' : '999K'}
                  <span className="text-sm text-gray-500">/bulan</span>
                </p>
                <ul className="mt-4 text-sm text-gray-600 space-y-1">
                  {plan === 'Basic' && (
                    <>
                      <li>✓ 100 vehicles</li>
                      <li>✓ Basic analytics</li>
                      <li>✓ Email support</li>
                    </>
                  )}
                  {plan === 'Professional' && (
                    <>
                      <li>✓ 500 vehicles</li>
                      <li>✓ Advanced analytics</li>
                      <li>✓ Priority support</li>
                    </>
                  )}
                  {plan === 'Enterprise' && (
                    <>
                      <li>✓ Unlimited vehicles</li>
                      <li>✓ Premium analytics</li>
                      <li>✓ 24/7 support</li>
                    </>
                  )}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Status & Dates */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Subscription Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="Trial">Trial</option>
                <option value="Active">Active</option>
                <option value="Suspended">Suspended</option>
                <option value="Expired">Expired</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price per Month (IDR)
              </label>
              <input
                type="number"
                value={formData.pricePerMonth}
                onChange={(e) => setFormData({ ...formData, pricePerMonth: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Period Start Date
              </label>
              <input
                type="date"
                value={formData.currentPeriodStart}
                onChange={(e) => setFormData({ ...formData, currentPeriodStart: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Period End Date
              </label>
              <input
                type="date"
                value={formData.currentPeriodEnd}
                onChange={(e) => setFormData({ ...formData, currentPeriodEnd: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Trial End Date (Optional)
              </label>
              <input
                type="date"
                value={formData.trialEnd}
                onChange={(e) => setFormData({ ...formData, trialEnd: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Link
            href="/admin/tenants"
            className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
          >
            {saving ? 'Saving...' : tenant?.subscription ? 'Update Subscription' : 'Create Subscription'}
          </button>
        </div>
      </form>
    </div>
  );
}
