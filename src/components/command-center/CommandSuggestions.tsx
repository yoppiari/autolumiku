/**
 * Command Suggestions Component
 * Epic 3: Story 3.1 & 3.5 - Show command suggestions and quick actions
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, TrendingUp, Star } from 'lucide-react';

interface CommandSuggestionsProps {
  onSelectCommand: (command: string) => void;
  tenantId: string;
  userId: string;
}

interface Suggestion {
  command: string;
  category: string;
  description: string;
  isFrequent?: boolean;
}

export function CommandSuggestions({ onSelectCommand, tenantId, userId }: CommandSuggestionsProps) {
  const [popularCommands, setPopularCommands] = useState<Suggestion[]>([]);
  const [frequentCommands, setFrequentCommands] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSuggestions();
  }, []);

  const loadSuggestions = async () => {
    try {
      const response = await fetch('/api/v1/commands/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          userId,
          limit: 10,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setPopularCommands(data.suggestions.filter((s: Suggestion) => !s.isFrequent));
        setFrequentCommands(data.suggestions.filter((s: Suggestion) => s.isFrequent));
      }
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  // Default popular commands (fallback)
  const defaultCommands: Suggestion[] = [
    {
      command: 'Tampilkan semua mobil',
      category: 'Vehicle Management',
      description: 'Lihat semua kendaraan di inventory',
    },
    {
      command: 'Cari mobil Toyota',
      category: 'Vehicle Management',
      description: 'Cari kendaraan berdasarkan merek',
    },
    {
      command: 'Mobil harga di bawah 200 juta',
      category: 'Vehicle Management',
      description: 'Filter berdasarkan range harga',
    },
    {
      command: 'Update harga mobil',
      category: 'Pricing',
      description: 'Ubah harga kendaraan',
    },
    {
      command: 'Tampilkan analytics',
      category: 'Analytics',
      description: 'Lihat statistik performa',
    },
    {
      command: 'Lihat customer leads',
      category: 'Customer Management',
      description: 'Cek inquiry customer terbaru',
    },
  ];

  const displayCommands = popularCommands.length > 0 ? popularCommands : defaultCommands;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          <CardTitle>Saran Perintah</CardTitle>
        </div>
        <CardDescription>
          Pilih perintah di bawah atau ketik perintah Anda sendiri
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="popular" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="popular" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              <span>Populer</span>
            </TabsTrigger>
            <TabsTrigger value="frequent" className="flex items-center gap-2">
              <Star className="w-4 h-4" />
              <span>Sering Digunakan</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="popular" className="mt-4">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-20 bg-muted animate-pulse rounded-md" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {displayCommands.map((suggestion, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="h-auto p-3 flex flex-col items-start justify-start text-left"
                    onClick={() => onSelectCommand(suggestion.command)}
                  >
                    <span className="font-medium text-sm">{suggestion.command}</span>
                    <span className="text-xs text-muted-foreground mt-1">
                      {suggestion.description}
                    </span>
                  </Button>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="frequent" className="mt-4">
            {frequentCommands.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Star className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Belum ada perintah yang sering digunakan</p>
                <p className="text-xs mt-1">
                  Sistem akan belajar dari pola penggunaan Anda
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {frequentCommands.map((suggestion, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="h-auto p-3 flex flex-col items-start justify-start text-left"
                    onClick={() => onSelectCommand(suggestion.command)}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <Star className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                      <span className="font-medium text-sm flex-1">{suggestion.command}</span>
                    </div>
                    <span className="text-xs text-muted-foreground mt-1">
                      {suggestion.description}
                    </span>
                  </Button>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
