/**
 * Conversion Funnel Component
 * Epic 7: Visualize lead-to-sale conversion funnel
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConversionFunnel as ConversionFunnelType } from '@/services/analytics-service/types';
import { ChevronDown } from 'lucide-react';

interface ConversionFunnelProps {
  data: ConversionFunnelType | null;
  loading?: boolean;
}

export function ConversionFunnel({ data, loading = false }: ConversionFunnelProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Conversion Funnel</CardTitle>
          <CardDescription>Lead to sale conversion stages</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-20 animate-pulse bg-muted rounded-md"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.stages.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Conversion Funnel</CardTitle>
          <CardDescription>Lead to sale conversion stages</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <p>No conversion data available</p>
              <p className="text-sm mt-1">Data will appear once leads are tracked</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxCount = Math.max(...data.stages.map(s => s.count));

  const getStageColor = (index: number) => {
    const colors = [
      'bg-blue-500',
      'bg-indigo-500',
      'bg-purple-500',
      'bg-pink-500',
    ];
    return colors[index] || 'bg-gray-500';
  };

  const getStageWidth = (count: number) => {
    if (maxCount === 0) return '100%';
    return `${Math.max((count / maxCount) * 100, 20)}%`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conversion Funnel</CardTitle>
        <CardDescription>
          Lead to sale conversion stages with {data.totalInquiries} total inquiries
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Overall Conversion Rate */}
        <div className="mb-6 p-4 bg-muted rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Overall Conversion Rate</p>
              <p className="text-2xl font-bold text-primary">
                {data.overallConversionRate.toFixed(1)}%
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total Sales</p>
              <p className="text-2xl font-bold">
                {data.totalSales}
              </p>
            </div>
          </div>
        </div>

        {/* Funnel Stages */}
        <div className="space-y-2">
          {data.stages.map((stage, index) => (
            <div key={stage.stage}>
              {/* Stage Card */}
              <div
                className={`${getStageColor(index)} text-white rounded-lg p-4 transition-all hover:scale-[1.02]`}
                style={{ width: getStageWidth(stage.count) }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold">{stage.stageLabel}</h4>
                    <p className="text-sm opacity-90 mt-1">
                      {stage.count.toLocaleString('id-ID')} leads
                    </p>
                  </div>
                  {index < data.stages.length - 1 && (
                    <div className="text-right">
                      <p className="text-sm opacity-90">
                        Conversion: {stage.conversionRate.toFixed(1)}%
                      </p>
                      <p className="text-xs opacity-75 mt-1">
                        Drop-off: {stage.dropoffRate.toFixed(1)}%
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Arrow between stages */}
              {index < data.stages.length - 1 && (
                <div className="flex justify-center py-2">
                  <ChevronDown className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Funnel Insights */}
        <div className="mt-6 pt-4 border-t grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Best Conversion Stage</p>
            <p className="text-sm font-medium mt-1">
              {data.stages.reduce((best, stage) =>
                stage.conversionRate > best.conversionRate ? stage : best
              ).stageLabel}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Highest Drop-off</p>
            <p className="text-sm font-medium mt-1">
              {data.stages.reduce((worst, stage) =>
                stage.dropoffRate > worst.dropoffRate ? stage : worst
              ).stageLabel}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
