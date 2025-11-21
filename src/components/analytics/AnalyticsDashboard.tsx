/**
 * Analytics Dashboard Component
 * Epic 7: Main analytics dashboard with all metrics
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DollarSign,
  Package,
  Users,
  TrendingUp,
  Calendar,
  Download,
  RefreshCw,
} from 'lucide-react';
import { KPICard } from './KPICard';
import { SalesChart } from './SalesChart';
import { ConversionFunnel } from './ConversionFunnel';
import { InventoryChart } from './InventoryChart';
import { DateRange, TimePeriod } from '@/services/analytics-service/types';

interface AnalyticsDashboardProps {
  tenantId: string;
  userId: string;
}

export function AnalyticsDashboard({ tenantId, userId }: AnalyticsDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<TimePeriod>('month');
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [salesAnalytics, setSalesAnalytics] = useState<any>(null);
  const [inventoryAnalytics, setInventoryAnalytics] = useState<any>(null);

  useEffect(() => {
    loadAllData();
  }, [period]);

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      loadDashboardData(),
      loadSalesAnalytics(),
      loadInventoryAnalytics(),
    ]);
    setLoading(false);
  };

  const loadDashboardData = async () => {
    try {
      const response = await fetch('/api/v1/analytics/overview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          period,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setDashboardData(result.data);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  };

  const loadSalesAnalytics = async () => {
    try {
      const response = await fetch('/api/v1/analytics/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          period,
          comparisonPeriod: 'previous',
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setSalesAnalytics(result.data);
      }
    } catch (error) {
      console.error('Failed to load sales analytics:', error);
    }
  };

  const loadInventoryAnalytics = async () => {
    try {
      const response = await fetch('/api/v1/analytics/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          period,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setInventoryAnalytics(result.data);
      }
    } catch (error) {
      console.error('Failed to load inventory analytics:', error);
    }
  };

  const handleRefresh = () => {
    loadAllData();
  };

  const handleExport = async () => {
    // TODO: Implement export functionality
    console.log('Export dashboard');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Analytics Dashboard</h2>
          <p className="text-muted-foreground mt-1">
            Comprehensive business insights and performance metrics
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Period Selector */}
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-muted-foreground" />
        <div className="flex gap-1">
          {(['today', 'week', 'month', 'quarter', 'year'] as TimePeriod[]).map((p) => (
            <Button
              key={p}
              variant={period === p ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriod(p)}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Revenue"
          value={dashboardData?.sales?.totalRevenue || 0}
          trend={dashboardData?.sales?.trend}
          trendPercentage={dashboardData?.sales?.changePercent}
          icon={<DollarSign className="w-6 h-6" />}
          format="currency"
          loading={loading}
        />

        <KPICard
          title="Total Sales"
          value={dashboardData?.sales?.totalSales || 0}
          trend={dashboardData?.sales?.trend}
          icon={<TrendingUp className="w-6 h-6" />}
          format="number"
          loading={loading}
        />

        <KPICard
          title="Active Inventory"
          value={dashboardData?.inventory?.totalVehicles || 0}
          icon={<Package className="w-6 h-6" />}
          format="number"
          loading={loading}
        />

        <KPICard
          title="Total Customers"
          value={dashboardData?.customers?.totalCustomers || 0}
          trend={dashboardData?.customers?.trend}
          icon={<Users className="w-6 h-6" />}
          format="number"
          loading={loading}
        />
      </div>

      {/* Detailed Analytics Tabs */}
      <Tabs defaultValue="sales" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-4 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SalesChart
              data={salesAnalytics?.salesByPeriod || []}
              title="Sales Volume"
              description="Number of vehicles sold over time"
              showRevenue={false}
              loading={loading}
            />
            <SalesChart
              data={salesAnalytics?.revenueByPeriod || []}
              title="Revenue Trends"
              description="Total revenue generated over time"
              showRevenue={true}
              type="area"
              loading={loading}
            />
          </div>
          <ConversionFunnel
            data={salesAnalytics?.conversionFunnel || null}
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <InventoryChart
              agingData={inventoryAnalytics?.agingAnalysis || []}
              type="aging"
              loading={loading}
            />
            <InventoryChart
              turnoverData={inventoryAnalytics?.turnoverByCategory || []}
              type="turnover"
              loading={loading}
            />
          </div>
        </TabsContent>

        <TabsContent value="customers" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer Analytics</CardTitle>
              <CardDescription>
                Understand customer demographics, behavior, and preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Customer analytics chart will be displayed here</p>
                <p className="text-sm mt-2">Coming soon: Demographics and behavior analysis</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financial" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Financial Performance</CardTitle>
              <CardDescription>
                Track revenue, profit margins, and financial trends
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Financial analytics chart will be displayed here</p>
                <p className="text-sm mt-2">Coming soon: Revenue forecasting and profit analysis</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Alerts */}
      {dashboardData?.alerts && dashboardData.alerts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Alerts & Notifications</h3>
          {dashboardData.alerts.map((alert: any) => (
            <Card key={alert.id} className="border-l-4 border-l-yellow-500">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium">{alert.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                  </div>
                  {alert.actionLabel && (
                    <Button variant="outline" size="sm">
                      {alert.actionLabel}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
