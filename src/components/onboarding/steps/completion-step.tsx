/**
 * Completion Step
 * Final step showing setup summary and next steps
 */

'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  Sparkles,
  ArrowRight,
  BookOpen,
  Users,
  BarChart3,
  Settings,
  Rocket
} from 'lucide-react';

interface CompletionStepProps {
  onFinish: () => void;
  summary: {
    showroomName: string;
    businessType: string;
    hasBranding?: boolean;
    teamMembersCount?: number;
    featuresEnabled?: string[];
  };
}

export function CompletionStep({ onFinish, summary }: CompletionStepProps) {
  const [celebrating, setCelebrating] = useState(false);

  useEffect(() => {
    // Trigger celebration animation
    setCelebrating(true);
    const timer = setTimeout(() => setCelebrating(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  const nextSteps = [
    {
      icon: <Users className="h-5 w-5" />,
      title: 'Tambah Data Kendaraan',
      description: 'Mulai dengan menambahkan inventori kendaraan Anda',
      action: 'Go to Inventory',
      href: '/inventory/add'
    },
    {
      icon: <BarChart3 className="h-5 w-5" />,
      title: 'Lihat Dashboard',
      description: 'Monitor performa showroom Anda secara real-time',
      action: 'View Dashboard',
      href: '/dashboard'
    },
    {
      icon: <BookOpen className="h-5 w-5" />,
      title: 'Pelajari Fitur',
      description: 'Ikuti tutorial singkat untuk memaksimalkan platform',
      action: 'Start Tutorial',
      href: '/help/tutorial'
    },
    {
      icon: <Settings className="h-5 w-5" />,
      title: 'Lengkapi Pengaturan',
      description: 'Sesuaikan pengaturan lanjutan sesuai kebutuhan',
      action: 'Go to Settings',
      href: '/settings'
    }
  ];

  const setupSummary = [
    {
      label: 'Nama Showroom',
      value: summary.showroomName,
      icon: <CheckCircle2 className="h-4 w-4 text-green-600" />
    },
    {
      label: 'Jenis Bisnis',
      value: summary.businessType,
      icon: <CheckCircle2 className="h-4 w-4 text-green-600" />
    },
    ...(summary.hasBranding ? [{
      label: 'Branding',
      value: 'Dikonfigurasi',
      icon: <CheckCircle2 className="h-4 w-4 text-green-600" />
    }] : []),
    ...(summary.teamMembersCount ? [{
      label: 'Anggota Tim',
      value: `${summary.teamMembersCount} anggota diundang`,
      icon: <CheckCircle2 className="h-4 w-4 text-green-600" />
    }] : []),
  ];

  return (
    <div className="space-y-6">
      {/* Celebration Header */}
      <div className="text-center space-y-4">
        <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 ${celebrating ? 'animate-bounce' : ''}`}>
          <Rocket className={`h-10 w-10 text-green-600 ${celebrating ? 'animate-pulse' : ''}`} />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-gray-900 flex items-center justify-center gap-2">
            Selamat! Setup Selesai
            <Sparkles className="h-6 w-6 text-yellow-500" />
          </h2>
          <p className="text-gray-600 mt-2 text-lg">
            {summary.showroomName} siap digunakan!
          </p>
        </div>
      </div>

      {/* Setup Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Ringkasan Setup Anda</CardTitle>
          <CardDescription>
            Berikut adalah konfigurasi yang telah Anda selesaikan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {setupSummary.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  {item.icon}
                  <span className="font-medium text-gray-700">{item.label}</span>
                </div>
                <span className="text-gray-900">{item.value}</span>
              </div>
            ))}
          </div>

          {summary.featuresEnabled && summary.featuresEnabled.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm font-medium text-gray-700 mb-2">Fitur yang Diaktifkan:</p>
              <div className="flex flex-wrap gap-2">
                {summary.featuresEnabled.map((feature, index) => (
                  <Badge key={index} variant="secondary">
                    {feature}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Next Steps */}
      <Card>
        <CardHeader>
          <CardTitle>Langkah Selanjutnya</CardTitle>
          <CardDescription>
            Mulai gunakan AutoLumiku dengan langkah-langkah berikut
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {nextSteps.map((step, index) => (
              <div
                key={index}
                className="p-4 border rounded-lg hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer group"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                    {step.icon}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-1">{step.title}</h4>
                    <p className="text-sm text-gray-600 mb-2">{step.description}</p>
                    <div className="flex items-center text-sm text-primary font-medium group-hover:underline">
                      {step.action}
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Resources */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Sumber Belajar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <a
              href="/help/documentation"
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div>
                <p className="font-medium text-gray-900">Dokumentasi Lengkap</p>
                <p className="text-sm text-gray-600">Panduan detail untuk setiap fitur</p>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400" />
            </a>
            <a
              href="/help/video-tutorials"
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div>
                <p className="font-medium text-gray-900">Video Tutorial</p>
                <p className="text-sm text-gray-600">Pelajari dengan video step-by-step</p>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400" />
            </a>
            <a
              href="/help/support"
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div>
                <p className="font-medium text-gray-900">Hubungi Support</p>
                <p className="text-sm text-gray-600">Tim kami siap membantu Anda</p>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400" />
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Success Tips */}
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Sparkles className="h-6 w-6 text-blue-600 flex-shrink-0 mt-1" />
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Tips untuk Kesuksesan</h4>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Upload minimal 10 kendaraan untuk mulai menarik pembeli</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Gunakan foto berkualitas tinggi untuk meningkatkan konversi</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Aktifkan notifikasi agar tidak melewatkan lead potensial</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Ajak tim Anda untuk berkolaborasi menggunakan platform</span>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Finish Button */}
      <div className="flex justify-center pt-4">
        <Button
          size="lg"
          onClick={onFinish}
          className="px-8 py-6 text-lg"
        >
          <Rocket className="h-5 w-5 mr-2" />
          Mulai Gunakan AutoLumiku
        </Button>
      </div>
    </div>
  );
}
