/**
 * Description Editor Component
 * Edit AI-generated vehicle descriptions with tone and emphasis options
 *
 * Epic 2: AI-Powered Vehicle Upload
 * Story 2.4: Comprehensive AI Description Generation
 */

'use client';

import { useState } from 'react';
import { FileText, Loader2, Sparkles, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface VehicleDescription {
  descriptionId: string;
  descriptionEn: string;
  featuresId: string[];
  featuresEn: string[];
  highlights: string[];
  specifications: Record<string, any>;
  tone: 'professional' | 'casual' | 'promotional';
  wordCount: number;
}

interface DescriptionEditorProps {
  vehicleId: string;
  tenantId: string;
  onDescriptionGenerated?: (description: VehicleDescription) => void;
}

export function DescriptionEditor({
  vehicleId,
  tenantId,
  onDescriptionGenerated
}: DescriptionEditorProps) {
  const [description, setDescription] = useState<VehicleDescription | null>(null);
  const [editedDescriptionId, setEditedDescriptionId] = useState('');
  const [editedDescriptionEn, setEditedDescriptionEn] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedTone, setSelectedTone] = useState<'professional' | 'casual' | 'promotional'>('professional');
  const [selectedEmphasis, setSelectedEmphasis] = useState<'features' | 'performance' | 'family' | 'luxury' | 'value'>('features');
  const [error, setError] = useState<string | null>(null);

  const generateDescription = async (regenerate = false) => {
    try {
      setIsGenerating(true);
      setError(null);

      const response = await fetch('/api/v1/vehicles/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId,
          tenantId,
          tone: selectedTone,
          emphasis: selectedEmphasis
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Generate deskripsi gagal');
      }

      const { data } = await response.json();
      setDescription(data);
      setEditedDescriptionId(data.descriptionId);
      setEditedDescriptionEn(data.descriptionEn);

      if (onDescriptionGenerated) {
        onDescriptionGenerated(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generate deskripsi gagal');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    if (description && onDescriptionGenerated) {
      onDescriptionGenerated({
        ...description,
        descriptionId: editedDescriptionId,
        descriptionEn: editedDescriptionEn
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-500" />
            <span>Deskripsi Kendaraan</span>
          </div>
          {description && (
            <Button
              onClick={() => generateDescription(true)}
              disabled={isGenerating}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
              Regenerate
            </Button>
          )}
        </CardTitle>
        <CardDescription>
          AI menghasilkan deskripsi menarik dalam Bahasa Indonesia dan English
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Generation Controls */}
        {!description && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="tone">Tone</Label>
                <Select value={selectedTone} onValueChange={(value: any) => setSelectedTone(value)}>
                  <SelectTrigger id="tone" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional - Formal dan informatif</SelectItem>
                    <SelectItem value="casual">Casual - Ramah dan conversational</SelectItem>
                    <SelectItem value="promotional">Promotional - Persuasif dan menarik</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="emphasis">Emphasis</Label>
                <Select value={selectedEmphasis} onValueChange={(value: any) => setSelectedEmphasis(value)}>
                  <SelectTrigger id="emphasis" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="features">Features - Fitur dan teknologi</SelectItem>
                    <SelectItem value="performance">Performance - Performa dan handling</SelectItem>
                    <SelectItem value="family">Family - Kenyamanan keluarga</SelectItem>
                    <SelectItem value="luxury">Luxury - Kemewahan dan prestise</SelectItem>
                    <SelectItem value="value">Value - Value for money</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={() => generateDescription(false)}
              disabled={isGenerating}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Menghasilkan deskripsi...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Deskripsi AI
                </>
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
        {isGenerating && (
          <div className="text-center py-12">
            <Loader2 className="h-16 w-16 animate-spin mx-auto text-blue-500 mb-4" />
            <p className="text-lg font-medium text-gray-900 mb-2">
              AI sedang menulis deskripsi...
            </p>
            <p className="text-sm text-gray-500">
              Menganalisis kendaraan dan membuat deskripsi menarik
            </p>
          </div>
        )}

        {/* Generated Description */}
        {!isGenerating && description && (
          <div className="space-y-4">
            {/* Metadata */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Badge>{description.wordCount} kata</Badge>
                <Badge variant="outline" className="capitalize">{description.tone}</Badge>
              </div>
              <Button onClick={handleSave} size="sm">
                Simpan Perubahan
              </Button>
            </div>

            {/* Bilingual Tabs */}
            <Tabs defaultValue="indonesian" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="indonesian">Bahasa Indonesia</TabsTrigger>
                <TabsTrigger value="english">English</TabsTrigger>
              </TabsList>

              <TabsContent value="indonesian" className="space-y-4">
                <div>
                  <Label htmlFor="descriptionId">Deskripsi (Indonesia)</Label>
                  <Textarea
                    id="descriptionId"
                    value={editedDescriptionId}
                    onChange={(e) => setEditedDescriptionId(e.target.value)}
                    rows={8}
                    className="mt-1 font-sans"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {editedDescriptionId.split(/\s+/).length} kata
                  </p>
                </div>

                {description.featuresId.length > 0 && (
                  <div>
                    <Label>Fitur-fitur</Label>
                    <div className="mt-2 space-y-2">
                      {description.featuresId.map((feature, index) => (
                        <div key={index} className="flex items-start gap-2 text-sm">
                          <span className="text-blue-500 mt-0.5">✓</span>
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {description.highlights.length > 0 && (
                  <div>
                    <Label>Highlights</Label>
                    <div className="mt-2 space-y-2">
                      {description.highlights.map((highlight, index) => (
                        <Badge key={index} variant="secondary" className="mr-2 mb-2">
                          {highlight}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="english" className="space-y-4">
                <div>
                  <Label htmlFor="descriptionEn">Description (English)</Label>
                  <Textarea
                    id="descriptionEn"
                    value={editedDescriptionEn}
                    onChange={(e) => setEditedDescriptionEn(e.target.value)}
                    rows={8}
                    className="mt-1 font-sans"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {editedDescriptionEn.split(/\s+/).length} words
                  </p>
                </div>

                {description.featuresEn.length > 0 && (
                  <div>
                    <Label>Features</Label>
                    <div className="mt-2 space-y-2">
                      {description.featuresEn.map((feature, index) => (
                        <div key={index} className="flex items-start gap-2 text-sm">
                          <span className="text-blue-500 mt-0.5">✓</span>
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {/* Regenerate Options */}
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-blue-900 font-medium mb-2">
                Tidak puas dengan hasilnya?
              </p>
              <p className="text-xs text-blue-700 mb-3">
                Anda bisa mengubah tone dan emphasis lalu generate ulang
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <Select value={selectedTone} onValueChange={(value: any) => setSelectedTone(value)}>
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="promotional">Promotional</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={selectedEmphasis} onValueChange={(value: any) => setSelectedEmphasis(value)}>
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="features">Features</SelectItem>
                    <SelectItem value="performance">Performance</SelectItem>
                    <SelectItem value="family">Family</SelectItem>
                    <SelectItem value="luxury">Luxury</SelectItem>
                    <SelectItem value="value">Value</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
