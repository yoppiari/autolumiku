/**
 * KPI Card Component
 * Epic 7: Display key performance indicator with trend
 */

'use client';

import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { TrendDirection } from '@/services/analytics-service/types';

interface KPICardProps {
  title: string;
  value: number;
  previousValue?: number;
  trend?: TrendDirection;
  trendPercentage?: number;
  icon?: React.ReactNode;
  format?: 'number' | 'currency' | 'percentage' | 'duration';
  loading?: boolean;
}

export function KPICard({
  title,
  value,
  previousValue,
  trend = 'neutral',
  trendPercentage,
  icon,
  format = 'number',
  loading = false,
}: KPICardProps) {
  const formatValue = (val: number): string => {
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('id-ID', {
          style: 'currency',
          currency: 'IDR',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(val);

      case 'percentage':
        return `${val.toFixed(1)}%`;

      case 'duration':
        if (val < 60) return `${Math.round(val)}s`;
        const mins = Math.floor(val / 60);
        return `${mins}m`;

      case 'number':
      default:
        return new Intl.NumberFormat('id-ID').format(val);
    }
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4" />;
      case 'down':
        return <TrendingDown className="w-4 h-4" />;
      default:
        return <Minus className="w-4 h-4" />;
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return 'text-green-600 dark:text-green-400';
      case 'down':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-8 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <h3 className="text-2xl font-bold mt-2">{formatValue(value)}</h3>

            {trendPercentage !== undefined && (
              <div className={`flex items-center gap-1 mt-2 text-sm ${getTrendColor()}`}>
                {getTrendIcon()}
                <span className="font-medium">
                  {Math.abs(trendPercentage)}%
                </span>
                <span className="text-muted-foreground text-xs">
                  vs previous period
                </span>
              </div>
            )}
          </div>

          {icon && (
            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
