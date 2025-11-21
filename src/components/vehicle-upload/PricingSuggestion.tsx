/**
 * Pricing Suggestion Component
 * Displays AI-powered pricing intelligence and market analysis
 *
 * Epic 2: AI-Powered Vehicle Upload
 * Story 2.5: Intelligent Pricing Suggestions
 */

'use client';

import { useState } from 'react';
import { DollarSign, Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PricingAnalysis {
  priceRange: {
    min: number;
    max: number;
    recommended: number;
  };
  confidence: number;
  marketAverage: number;
  factors: {
    yearDepreciation: number;
    conditionAdjustment: number;
    demandLevel: 'low' | 'medium' | 'high';
    marketTrend: 'declining' | 'stable' | 'rising';
  };
  recommendations: string[];
  reasoning: string;
  positioning: 'budget' | 'competitive' | 'premium';
}

interface PricingSuggestionProps {
  vehicleId: string;
  tenantId: string;
  onPriceSelected?: (price: number) => void;
}

export function PricingSuggestion({
  vehicleId,
  tenantId,
  onPriceSelected
}: PricingSuggestionProps) {
  const [analysis, setAnalysis] = useState<PricingAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedPrice, setSelectedPrice] = useState<number>(0);
  const [mileage, setMileage] = useState<string>('');
  const [condition, setCondition] = useState<'excellent' | 'good' | 'fair' | 'poor'>('good');
  const [positioning, setPositioning] = useState<'budget' | 'competitive' | 'premium'>('competitive');
  const [error, setError] = useState<string | null>(null);

  const analyzePricing = async () => {
    try {
      setIsAnalyzing(true);
      setError(null);

      const response = await fetch('/api/v1/vehicles/suggest-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId,
          tenantId,
          mileage: mileage ? parseInt(mileage) : undefined,
          condition,
          desiredPositioning: positioning
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Analisis pricing gagal');
      }

      const { data } = await response.json();
      setAnalysis(data);
      setSelectedPrice(data.priceRange.recommended);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analisis pricing gagal');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatIDR = (cents: number) => {
    const rupiah = Math.round(cents / 100);
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(rupiah);
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'rising':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'declining':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getDemandBadge = (demand: string) => {
    switch (demand) {
      case 'high':
        return <Badge className="bg-green-500">Demand Tinggi</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-500">Demand Sedang</Badge>;
      default:
        return <Badge className="bg-gray-500">Demand Rendah</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-green-500" />
          <span>Saran Harga Cerdas</span>
        </CardTitle>
        <CardDescription>
          AI menganalisis pasar dan memberikan rekomendasi harga kompetitif
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Input Form */}
        {!analysis && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="mileage">Kilometer (opsional)</Label>
                <Input
                  id="mileage"
                  type="number"
                  placeholder="150000"
                  value={mileage}
                  onChange={(e) => setMileage(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="condition">Kondisi Kendaraan</Label>
                <Select value={condition} onValueChange={(value: any) => setCondition(value)}>
                  <SelectTrigger id="condition" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excellent">Excellent - Seperti baru</SelectItem>
                    <SelectItem value="good">Good - Terawat baik</SelectItem>
                    <SelectItem value="fair">Fair - Kondisi normal</SelectItem>
                    <SelectItem value="poor">Poor - Perlu perbaikan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="positioning">Strategi Harga</Label>
              <Select value={positioning} onValueChange={(value: any) => setPositioning(value)}>
                <SelectTrigger id="positioning" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="budget">Budget - Harga lebih rendah (cepat terjual)</SelectItem>
                  <SelectItem value="competitive">Competitive - Harga pasar</SelectItem>
                  <SelectItem value="premium">Premium - Harga lebih tinggi</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={analyzePricing}
              disabled={isAnalyzing}
              className="w-full"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Menganalisis harga pasar...
                </>
              ) : (
                'Analisis Harga'
              )}
            </Button>
          </div>
        )}

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Loading */}
        {isAnalyzing && (
          <div className="text-center py-12">
            <Loader2 className="h-16 w-16 animate-spin mx-auto text-green-500 mb-4" />
            <p className="text-lg font-medium text-gray-900 mb-2">
              Menganalisis pasar...
            </p>
            <p className="text-sm text-gray-500">
              Membandingkan dengan kendaraan serupa dan kondisi pasar
            </p>
          </div>
        )}

        {/* Pricing Analysis */}
        {!isAnalyzing && analysis && (
          <div className="space-y-4">
            {/* Recommended Price */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6 text-center">
              <p className="text-sm text-gray-600 mb-2">Harga Rekomendasi AI</p>
              <p className="text-4xl font-bold text-green-600 mb-2">
                {formatIDR(analysis.priceRange.recommended)}
              </p>
              <p className="text-xs text-gray-500">
                Range: {formatIDR(analysis.priceRange.min)} - {formatIDR(analysis.priceRange.max)}
              </p>
              <Badge className="mt-3">
                Confidence: {analysis.confidence}%
              </Badge>
            </div>

            {/* Market Factors */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Market Trend</span>
                  {getTrendIcon(analysis.factors.marketTrend)}
                </div>
                <p className="text-base font-medium capitalize">{analysis.factors.marketTrend}</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-2">Demand Level</p>
                {getDemandBadge(analysis.factors.demandLevel)}
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-2">Depresiasi</p>
                <p className="text-base font-medium">{analysis.factors.yearDepreciation}%</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-2">Rata-rata Pasar</p>
                <p className="text-base font-medium">{formatIDR(analysis.marketAverage)}</p>
              </div>
            </div>

            {/* Price Selection */}
            <div>
              <Label htmlFor="finalPrice">Harga Final</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="finalPrice"
                  type="number"
                  value={selectedPrice / 100}
                  onChange={(e) => setSelectedPrice(parseInt(e.target.value) * 100)}
                  className="flex-1"
                />
                <Button
                  onClick={() => onPriceSelected && onPriceSelected(selectedPrice)}
                >
                  Gunakan Harga Ini
                </Button>
              </div>
            </div>

            {/* Recommendations */}
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="font-medium text-blue-900 mb-3">Rekomendasi:</p>
              <ul className="space-y-2 text-sm text-blue-800">
                {analysis.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* AI Reasoning */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Analisis AI:</p>
              <p className="text-sm text-gray-600">{analysis.reasoning}</p>
            </div>

            {/* Reanalyze Button */}
            <Button
              onClick={analyzePricing}
              variant="outline"
              className="w-full"
            >
              Analisis Ulang
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
