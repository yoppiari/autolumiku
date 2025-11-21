/**
 * Billing & Subscription Page
 * Epic 1: Subscription & Billing Management UI
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Plan {
  id: string;
  name: string;
  price: number;
  interval: string;
  features: string[];
  limits: {
    users: number;
    vehicles: number;
    storage: number;
  };
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  status: string;
  dueDate: string;
  createdAt: string;
}

export default function BillingPage() {
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [usage, setUsage] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const headers = {
        Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
      };

      // Fetch subscription info
      const subResponse = await fetch(`/api/v1/billing/subscription/${user.tenantId}`, {
        headers,
      });
      const subResult = await subResponse.json();
      if (subResult.success) {
        setCurrentPlan(subResult.data);
      }

      // Fetch available plans
      const plansResponse = await fetch('/api/v1/billing/plans');
      const plansResult = await plansResponse.json();
      if (plansResult.success) {
        setPlans(plansResult.data);
      }

      // Fetch invoices
      const invoicesResponse = await fetch(`/api/v1/billing/invoices/${user.tenantId}`, {
        headers,
      });
      const invoicesResult = await invoicesResponse.json();
      if (invoicesResult.success) {
        setInvoices(invoicesResult.data.invoices || []);
      }

      // Fetch usage stats
      const usageResponse = await fetch(`/api/v1/billing/usage/${user.tenantId}`, {
        headers,
      });
      const usageResult = await usageResponse.json();
      if (usageResult.success) {
        setUsage(usageResult.data);
      }
    } catch (error) {
      console.error('Failed to fetch billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      paid: 'bg-green-100 text-green-800',
      overdue: 'bg-red-100 text-red-800',
      canceled: 'bg-gray-100 text-gray-800',
    };

    return (
      <span
        className={`px-2 py-1 text-xs font-medium rounded-full ${
          styles[status as keyof typeof styles]
        }`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Billing & Subscription</h1>
        <p className="text-gray-600 mt-1">Manage your subscription and billing</p>
      </div>

      {/* Current Subscription */}
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
        </CardHeader>
        <CardContent>
          {currentPlan ? (
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">{currentPlan.name}</h3>
                <p className="text-gray-600 mt-1">
                  {formatCurrency(currentPlan.price)} / {currentPlan.interval}
                </p>
                <div className="mt-4 space-y-2">
                  {currentPlan.features.slice(0, 3).map((feature, index) => (
                    <div key={index} className="flex items-center text-sm text-gray-600">
                      <svg
                        className="w-5 h-5 text-green-500 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      {feature}
                    </div>
                  ))}
                </div>
              </div>
              <Button variant="outline" className="border-blue-600 text-blue-600">
                Change Plan
              </Button>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">No active subscription</p>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                Choose a Plan
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage Stats */}
      {usage && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-600">Users</h3>
                <svg
                  className="w-5 h-5 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-bold text-gray-900">
                  {usage.users.current}
                </span>
                <span className="text-sm text-gray-600">
                  / {usage.users.limit === -1 ? '∞' : usage.users.limit}
                </span>
              </div>
              <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{
                    width: `${
                      usage.users.limit === -1
                        ? 0
                        : (usage.users.current / usage.users.limit) * 100
                    }%`,
                  }}
                ></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-600">Vehicles</h3>
                <svg
                  className="w-5 h-5 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-bold text-gray-900">
                  {usage.vehicles.current}
                </span>
                <span className="text-sm text-gray-600">
                  / {usage.vehicles.limit === -1 ? '∞' : usage.vehicles.limit}
                </span>
              </div>
              <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{
                    width: `${
                      usage.vehicles.limit === -1
                        ? 0
                        : (usage.vehicles.current / usage.vehicles.limit) * 100
                    }%`,
                  }}
                ></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-600">Storage</h3>
                <svg
                  className="w-5 h-5 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
                  />
                </svg>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-bold text-gray-900">
                  {usage.storage.current}
                </span>
                <span className="text-sm text-gray-600">/ {usage.storage.limit} GB</span>
              </div>
              <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-purple-600 h-2 rounded-full"
                  style={{
                    width: `${(usage.storage.current / usage.storage.limit) * 100}%`,
                  }}
                ></div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Invoices */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No invoices yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                      Invoice #
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                      Amount
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                      Due Date
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-4 px-4 text-sm font-medium text-gray-900">
                        {invoice.invoiceNumber}
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-900">
                        {formatCurrency(invoice.amount)}
                      </td>
                      <td className="py-4 px-4">{getStatusBadge(invoice.status)}</td>
                      <td className="py-4 px-4 text-sm text-gray-600">
                        {new Date(invoice.dueDate).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <Button
                          variant="outline"
                          className="text-sm border-blue-600 text-blue-600"
                        >
                          Download
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Plans */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Available Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`relative ${
                currentPlan?.id === plan.id ? 'border-2 border-blue-600' : ''
              }`}
            >
              {currentPlan?.id === plan.id && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-blue-600 text-white text-xs font-medium px-3 py-1 rounded-full">
                    Current Plan
                  </span>
                </div>
              )}
              <CardContent className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                <div className="mb-4">
                  <span className="text-3xl font-bold text-gray-900">
                    {formatCurrency(plan.price)}
                  </span>
                  <span className="text-gray-600">/{plan.interval}</span>
                </div>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start text-sm text-gray-600">
                      <svg
                        className="w-5 h-5 text-green-500 mr-2 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  className={`w-full ${
                    currentPlan?.id === plan.id
                      ? 'bg-gray-200 text-gray-700'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                  disabled={currentPlan?.id === plan.id}
                >
                  {currentPlan?.id === plan.id ? 'Current Plan' : 'Upgrade'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
