/**
 * Sales Chart Component
 * Epic 7: Sales performance visualization with Recharts
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChartDataPoint } from '@/services/analytics-service/types';

interface SalesChartProps {
  data: ChartDataPoint[];
  title?: string;
  description?: string;
  type?: 'line' | 'area';
  showRevenue?: boolean;
  loading?: boolean;
}

export function SalesChart({
  data,
  title = 'Sales Performance',
  description = 'Sales and revenue trends over time',
  type = 'area',
  showRevenue = true,
  loading = false,
}: SalesChartProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] animate-pulse bg-muted rounded-md"></div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <p>No sales data available</p>
              <p className="text-sm mt-1">Data will appear once sales are recorded</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      notation: 'compact',
      compactDisplay: 'short',
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('id-ID').format(value);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              ></div>
              <span className="text-muted-foreground">{entry.name}:</span>
              <span className="font-medium">
                {showRevenue ? formatCurrency(entry.value) : formatNumber(entry.value)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          {type === 'area' ? (
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                className="text-xs"
                tick={{ fill: 'currentColor' }}
              />
              <YAxis
                className="text-xs"
                tick={{ fill: 'currentColor' }}
                tickFormatter={showRevenue ? formatCurrency : formatNumber}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                fillOpacity={1}
                fill="url(#colorValue)"
                name={showRevenue ? 'Revenue' : 'Sales'}
              />
            </AreaChart>
          ) : (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                className="text-xs"
                tick={{ fill: 'currentColor' }}
              />
              <YAxis
                className="text-xs"
                tick={{ fill: 'currentColor' }}
                tickFormatter={showRevenue ? formatCurrency : formatNumber}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                name={showRevenue ? 'Revenue' : 'Sales'}
              />
            </LineChart>
          )}
        </ResponsiveContainer>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-lg font-semibold">
              {showRevenue
                ? formatCurrency(data.reduce((sum, d) => sum + d.value, 0))
                : formatNumber(data.reduce((sum, d) => sum + d.value, 0))}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Average</p>
            <p className="text-lg font-semibold">
              {showRevenue
                ? formatCurrency(data.reduce((sum, d) => sum + d.value, 0) / data.length)
                : formatNumber(data.reduce((sum, d) => sum + d.value, 0) / data.length)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Peak</p>
            <p className="text-lg font-semibold">
              {showRevenue
                ? formatCurrency(Math.max(...data.map(d => d.value)))
                : formatNumber(Math.max(...data.map(d => d.value)))}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
