/**
 * Analytics Page
 * Epic 7: Analytics & Business Intelligence Dashboard
 */

'use client';

import React from 'react';
import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard';

export default function AnalyticsPage() {
  // TODO: Get tenantId and userId from session/auth context
  // For now, using placeholder values
  const tenantId = 'demo-tenant-id';
  const userId = 'demo-user-id';

  return (
    <div className="container mx-auto px-4 py-8">
      <AnalyticsDashboard tenantId={tenantId} userId={userId} />
    </div>
  );
}
