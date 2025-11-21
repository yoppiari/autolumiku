/**
 * Command Center Page
 * Epic 3: Natural Language Control Center
 *
 * Main page for the command center where users can interact with
 * the system using natural language (text or voice).
 */

'use client';

import React from 'react';
import { CommandCenter } from '@/components/command-center/CommandCenter';

export default function CommandCenterPage() {
  // TODO: Get tenantId and userId from session/auth context
  // For now, using placeholder values
  const tenantId = 'demo-tenant-id';
  const userId = 'demo-user-id';

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Command Center</h1>
          <p className="text-muted-foreground">
            Kontrol sistem Anda menggunakan perintah dalam Bahasa Indonesia.
            Ketik atau ucapkan perintah untuk melakukan berbagai operasi.
          </p>
        </div>

        {/* Command Center Component */}
        <CommandCenter tenantId={tenantId} userId={userId} />

        {/* Help Section */}
        <div className="mt-8 p-6 bg-muted/50 rounded-lg">
          <h2 className="text-lg font-semibold mb-3">Contoh Perintah</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-medium text-sm mb-2 text-primary">
                Vehicle Management
              </h3>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• "Tampilkan semua mobil"</li>
                <li>• "Cari mobil Toyota Avanza"</li>
                <li>• "Mobil harga di bawah 200 juta"</li>
                <li>• "Update harga mobil Avanza menjadi 180 juta"</li>
                <li>• "Tandai mobil BG1234AB sebagai terjual"</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-sm mb-2 text-primary">
                Analytics & Reports
              </h3>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• "Tampilkan analytics bulan ini"</li>
                <li>• "Lihat customer leads"</li>
                <li>• "Mobil terlaris minggu ini"</li>
                <li>• "Export data penjualan"</li>
                <li>• "Lihat riwayat penjualan"</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Tips Section */}
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg">
          <h3 className="font-medium text-sm mb-2 flex items-center gap-2">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Tips Menggunakan Command Center
          </h3>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>
              • <strong>Gunakan bahasa natural:</strong> Tidak perlu perintah formal,
              cukup ucapkan seperti berbicara biasa
            </li>
            <li>
              • <strong>Spesifik lebih baik:</strong> Semakin jelas perintah Anda,
              semakin akurat hasilnya
            </li>
            <li>
              • <strong>Voice input tersedia:</strong> Klik tab "Voice" untuk
              menggunakan perintah suara
            </li>
            <li>
              • <strong>Sistem belajar:</strong> Semakin sering digunakan, sistem
              akan mengenal pola dan preferensi Anda
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
