/**
 * Inventory Chart Component
 * Epic 7: Inventory analytics visualization
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { InventoryAgingData, TurnoverByCategory } from '@/services/analytics-service/types';

interface InventoryChartProps {
  agingData?: InventoryAgingData[];
  turnoverData?: TurnoverByCategory[];
  type?: 'aging' | 'turnover';
  loading?: boolean;
}

export function InventoryChart({
  agingData = [],
  turnoverData = [],
  type = 'aging',
  loading = false,
}: InventoryChartProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            {type === 'aging' ? 'Inventory Aging' : 'Turnover by Category'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] animate-pulse bg-muted rounded-md"></div>
        </CardContent>
      </Card>
    );
  }

  const data = type === 'aging' ? agingData : turnoverData;

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            {type === 'aging' ? 'Inventory Aging' : 'Turnover by Category'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <p>No inventory data available</p>
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

  // Colors for aging chart
  const AGING_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

  // Colors for turnover chart
  const TURNOVER_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          {type === 'aging' ? (
            <>
              <p className="font-medium mb-2">{data.ageBracket} days</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Vehicles:</span>
                  <span className="font-medium">{data.vehicleCount}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Value:</span>
                  <span className="font-medium">{formatCurrency(data.totalValue)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Percentage:</span>
                  <span className="font-medium">{data.percentOfInventory.toFixed(1)}%</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="font-medium mb-2">{data.make} {data.model}</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Sold:</span>
                  <span className="font-medium">{data.totalSold}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Avg Days:</span>
                  <span className="font-medium">{Math.round(data.averageDaysOnLot)} days</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Avg Price:</span>
                  <span className="font-medium">{formatCurrency(data.averagePrice)}</span>
                </div>
              </div>
            </>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {type === 'aging' ? 'Inventory Aging Analysis' : 'Turnover by Category'}
        </CardTitle>
        <CardDescription>
          {type === 'aging'
            ? 'Distribution of vehicles by time on lot'
            : 'Sales performance by make and model'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          {type === 'aging' ? (
            <PieChart>
              <Pie
                data={agingData}
                dataKey="vehicleCount"
                nameKey="ageBracket"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ ageBracket, percentOfInventory }) =>
                  `${ageBracket}: ${percentOfInventory.toFixed(0)}%`
                }
              >
                {agingData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={AGING_COLORS[index % AGING_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          ) : (
            <BarChart data={turnoverData.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="make"
                className="text-xs"
                tick={{ fill: 'currentColor' }}
              />
              <YAxis
                className="text-xs"
                tick={{ fill: 'currentColor' }}
                label={{ value: 'Units Sold', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="totalSold" name="Units Sold">
                {turnoverData.slice(0, 10).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={TURNOVER_COLORS[index % TURNOVER_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>

        {/* Legend for Aging */}
        {type === 'aging' && agingData.length > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-3">
            {agingData.map((item, index) => (
              <div key={item.ageBracket} className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: AGING_COLORS[index % AGING_COLORS.length] }}
                ></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.ageBracket} days</p>
                  <p className="text-xs text-muted-foreground">
                    {item.vehicleCount} vehicles ({item.percentOfInventory.toFixed(1)}%)
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Top Performers for Turnover */}
        {type === 'turnover' && turnoverData.length > 0 && (
          <div className="mt-6 pt-4 border-t">
            <h4 className="text-sm font-semibold mb-3">Top Performers</h4>
            <div className="space-y-2">
              {turnoverData.slice(0, 3).map((item, index) => (
                <div key={`${item.make}-${item.model}`} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{item.make} {item.model}</p>
                      <p className="text-xs text-muted-foreground">
                        Avg {Math.round(item.averageDaysOnLot)} days on lot
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{item.totalSold} sold</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(item.averagePrice)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
