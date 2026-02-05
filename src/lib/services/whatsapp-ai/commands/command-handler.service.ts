/**
 * WhatsApp AI Command Handler Service
 *
 * Handles WhatsApp AI commands for:
 * - Basic Tools (STAFF/SALES+): upload, inventory, stats, status, edit
 * - Full Access (ADMIN, OWNER, SUPER_ADMIN): All basic tools + PDF reports
 *
 * Access Categories:
 * - STAFF/SALES (Level 30): upload, inventory, stats, status, edit
 * - ADMIN+ (Level 90+): All tools + PDF reports
 */

import { prisma } from '@/lib/prisma';
import { ROLE_LEVELS } from '@/lib/rbac';
import { generateVCardBuffer, generateVCardFilename } from '../utils/vcard-generator';
import { StorageService } from '../../infrastructure/storage.service';
import { OnePageSalesPDF } from '@/lib/reports/one-page-sales-pdf';
import { WhatsAppCommandPDF, formatCurrency, formatNumber } from '@/lib/reports/whatsapp-command-pdf';
import {
  ComprehensiveReportPDF,
  ReportType as ComprehensiveReportType,
} from '@/lib/reports/comprehensive-report-pdf';
import { ReportDataService } from '@/lib/reports/report-data-service';
import { VehicleInventoryPDF } from '@/lib/reports/vehicle-inventory-pdf';
import { InsightEngine } from '@/lib/reports/insight-engine';
import * as fs from 'fs';
import * as path from 'path';
import { StaffCommandService } from './staff-command.service';
import { MessageIntent } from '../core/intent-classifier.service';

interface CommandContext {
  tenantId: string;
  userRole: string;
  userRoleLevel: number;
  phoneNumber: string;
  userId: string;
  conversationId?: string; // Optional but recommended for staff commands
}

interface CommandResult {
  success: boolean;
  message?: string;
  pdfBuffer?: Buffer;
  filename?: string;
  vCardUrl?: string;
  vCardFilename?: string;
  contactInfo?: {
    name: string;
    phone: string;
  };
  followUp?: boolean;
  broadcastToRoles?: string[]; // Roles to broadcast the result to (e.g. ['ADMIN', 'OWNER'])
}

// Helper functions
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/**
 * Get unified Admin Menu text
 */
function getAdminMenuText(): string {
  return `📊 *EXECUTIVE REPORT CENTER* 📈\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `💰 *PENJUALAN & REVENUE*\n` +
    `   • "Total Sales" (Ringkasan penjualan)\n` +
    `   • "Sales Summary" (Update hari ini)\n` +
    `   • "Sales Trends" (Analisis grafik)\n` +
    `   • "Metrik Penjualan" (KPI & Konversi)\n\n` +
    `📦 *STOK & INVENTORY*\n` +
    `   • "Total Inventory" (Aset & Gudang)\n` +
    `   • "Vehicle Listing" (Daftar semua mobil)\n` +
    `   • "Low Stock Alert" (Peringatan stok)\n` +
    `   • "Average Price" (Analisis harga)\n\n` +
    `👥 *TEAM & AI PERFORMANCE*\n` +
    `   • "Staff Performance" (Leaderboard sales)\n` +
    `   • "WhatsApp AI Analytics" (Data Bot)\n` +
    `   • "Customer Metrics" (Profil Pelanggan)\n` +
    `   • "Simulasi KKB" (Kredit Kendaraan)\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `_Ketik nama laporan di atas untuk melihat detailnya._`;
}


/**
 * Process WhatsApp AI command
 */
export async function processCommand(
  command: string,
  context: CommandContext
): Promise<CommandResult> {
  const { tenantId, userRoleLevel } = context;

  // Normalize command
  const cmd = command.toLowerCase().trim();

  console.log(`[CommandHandler] 📥 Processing command: "${command}" -> normalized: "${cmd}"`);
  console.log(`[CommandHandler] 👤 User role level: ${userRoleLevel}, Tenant: ${tenantId}`);

  // Report Commands (ADMIN+ only) - CHECK FIRST to take precedence over universal
  const isReport = isReportCommand(cmd);
  console.log(`[CommandHandler] 📄 isReportCommand: ${isReport}`);

  if (isReport) {
    // RBAC Check
    if (userRoleLevel < ROLE_LEVELS.ADMIN) {
      console.log(`[CommandHandler] ❌ Access denied - user level ${userRoleLevel} < ADMIN ${ROLE_LEVELS.ADMIN}`);
      return {
        success: false,
        message: 'Maaf, fitur Laporan & Analitik hanya untuk Owner, Admin, dan Super Admin.',
        followUp: true,
      };
    }
    console.log(`[CommandHandler] ✅ Routing to Report handler`);
    return await handleReportCommand(cmd, context);
  }

  // Universal Commands (ALL roles) - CHECK SECOND
  const isUniversal = isUniversalCommand(cmd);
  console.log(`[CommandHandler] 🔧 isUniversalCommand: ${isUniversal}`);

  if (isUniversal) {
    console.log(`[CommandHandler] ✅ Routing to Universal handler`);
    return await handleUniversalCommand(cmd, context);
  }

  // Staff Operational Commands (STAFF+ only) - CHECK THIRD
  const staffOperation = await handleStaffOperationCommand(cmd, context);
  if (staffOperation) {
    console.log(`[CommandHandler] ✅ Routing to Staff Operation handler`);
    return staffOperation;
  }

  // Finance/KKB Commands (STAFF+ only) - NEW CHECK
  // Exclude "syarat" or "cara" questions so they go to AI Chat Service
  const isKkbCommand = (cmd.includes('kkb') || cmd.includes('simulasi') ||
    cmd.includes('kredit') || cmd.includes('angsuran') || cmd.includes('credit'));

  const isKkbQuestion = cmd.includes('syarat') || cmd.includes('cara') || cmd.includes('dokumen');

  if (isKkbCommand && !isKkbQuestion) {
    if (userRoleLevel >= 30) {
      return await generateKKBSimulationText(cmd, context);
    }
  }

  // Unknown command - Return NULL to allow Fallback to Chat Service (LLM)
  // Previously this returned an error message, which blocked natural conversation
  console.log(`[CommandHandler] ⏩ Not a command - passing to Chat Service`);
  return {
    success: false,
    message: '', // Empty message signals orchestrator to use Chat Service
    followUp: false
  };
}

/**
 * Check if command is universal (all roles)
 */
function isUniversalCommand(cmd: string): boolean {
  const universalCommands = [
    // Help commands are universal
    'help', 'bantuan', 'panduan', 'cara', 'guide', 'menu', 'fitur', 'tool', 'perintah', 'penggunaan', 'command',
    'report', 'info', // Allow "report admin", "info report", etc.
    // 'halo', 'halo admin', 'halo owner', 'halo staff', 'hi', 'hello', // Let AI handle greetings
  ];
  return universalCommands.some(c => cmd.includes(c));
}

/**
 * Check if command is Report command
 * Uses exact phrase matching to prevent false positives
 */
function isReportCommand(cmd: string): boolean {
  const normalizedCmd = cmd.toLowerCase().trim();

  // Single word triggers (exact match)
  if (normalizedCmd === 'report' || normalizedCmd === 'pdf') {
    return true;
  }

  // Multi-word triggers - use exact phrase matching with word boundaries
  // This prevents "inventory" from matching "total inventory"
  const reportPhrases = [
    'sales report',
    'test-image',
    'test image',
    'debug image',
    'whatsapp ai analytics',
    'whatsapp ai',
    'metrix penjualan',
    'metrix pelanggan',
    'metrix operational',
    'operational metrics',
    'operational metric',
    'tren penjualan',
    'customer metrics',
    'customer metric',
    'sales trends',
    'sales trend',
    'total penjualan showroom',
    'total penjualan',
    'total sales',
    'sales total',
    'staff performance',
    'low stock alert',
    'total revenue',
    'total inventory',
    'stock report',
    'average price',
    'sales summary',
    'report pdf',
    'report admin',
    'report owner',
    'admin menu',
    'menu report',
    'menu admin',
    'admin report',
    'kkb report',
    'simulasi kkb',
    'simulasi kredit',
  ];

  // Check for exact phrase matches (with word boundaries)
  for (const phrase of reportPhrases) {
    // Use simple includes check - phrase must appear as-is in command
    // This prevents "inventory" from matching "total inventory"
    if (normalizedCmd.includes(phrase)) {
      return true;
    }
  }

  // Additional regex patterns for variations
  return /\b(sales|penjualan)\s+(summary|report|metrics|data|analytics)\b/i.test(cmd) ||
    /\b(metrics|metrix)\s+(sales|penjualan|operational|pelanggan|customer)\b/i.test(cmd) ||
    /\b(customer|pelanggan)\s+metrics\b/i.test(cmd) ||
    /\b(total)\s+(penjualan|revenue|inventory)\b/i.test(cmd);
}

/**
 * Handle universal commands (all roles)
 */
async function handleUniversalCommand(
  cmd: string,
  context: CommandContext
): Promise<CommandResult> {
  const { tenantId, userRoleLevel } = context;

  // SPECIAL CASE: If Admin/Owner asks for any admin-related help, show the Report Menu directly
  const isAdminRequest = cmd.includes("admin") || cmd.includes("owner") || cmd.includes("report");
  if (isAdminRequest && userRoleLevel >= ROLE_LEVELS.ADMIN) {
    return {
      success: true,
      message: getAdminMenuText(),
      followUp: true
    };
  }

  // RICH FORMAT (Consistent with StaffCommandService)
  let helpMsg =
    `✨ *SYSTEM ACTIVE - AUTOLUMIKU AI 5.2* ✨\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🛠️ *STAFF COMMAND CENTER*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📸 *UPLOAD* (Cepat & Berkelas)\n` +
    `Ketik: *upload* (ikut flow)\n` +
    `_Atau:_ "upload Brio 2020 120jt"\n\n` +

    `📋 *CEK STOK* (Real-time Inventory)\n` +
    `Ketik: *stok* [filter]\n\n` +

    `📊 *STATISTIK* (Performance Insight)\n` +
    `Ketik: *stats* atau *laporan*\n\n` +

    `🔄 *UPDATE STATUS* (Quick Sync)\n` +
    `Ketik: *status [ID] [SOLD/BOOKED/AVAILABLE]*\n\n` +

    `🚙 *EDIT DATA* (Smart Update)\n` +
    `Ketik: *edit [ID] [data]*\n\n` +

    `🔍 *CARI MOBIL* (Discovery)\n` +
    `_Contoh:_ "cari fortuner bensin"\n\n` +

    `💰 *SIMULASI KKB* (High Conversion)\n` +
    `Ketik: *kkb [ID/Harga] [DP] [Tenor]*\n\n` +
    `━━━━━━━━━━━━━━━━━━━━`;

  // Show Admin/Owner menu only for privileged users
  if (userRoleLevel >= ROLE_LEVELS.ADMIN) {
    helpMsg += `\n\n` +
      `👮‍♂️ *EXECUTIVE ANALYTICS*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `_Akses Laporan Strategis (Ketik):_\n` +
      `• *Laporan Penjualan* / *Total Pendapatan*\n` +
      `• *Tren Penjualan* / *Metrik Penjualan*\n` +
      `• *Total Inventori* / *Daftar Kendaraan*\n` +
      `• *Peringatan Stok* / *Rata-rata Harga*\n` +
      `• *Performa Staff* / *WhatsApp AI Analytics*\n\n` +
      `_Atau ketik: "menu report" untuk daftar lengkap._`;
  }

  return {
    success: true,
    message: helpMsg,
    followUp: true,
  };
}

/**
 * Handle staff operational commands (upload, status, inventory, etc.)
 */
async function handleStaffOperationCommand(
  cmd: string,
  context: CommandContext
): Promise<CommandResult | null> {
  const { tenantId, phoneNumber, conversationId, userRoleLevel } = context;

  // RBAC Check: Staff level 30+ only for operational tools
  if (userRoleLevel < 30) return null;

  // Identify intent from command keywords
  // STRICT START-OF-STRING MATCHING to avoid natural language false positives
  let intent: MessageIntent | null = null;
  const msg = cmd.toLowerCase().trim();

  // Match command at START of string (optional / prefix)
  const startsWith = (keyword: string) => new RegExp(`^(\\/)?${keyword}\\b`, 'i').test(msg);

  // Mapping based on IntentClassifier patterns
  if (startsWith('status') || msg.includes('update status') || msg.includes('ubah status')) {
    intent = 'staff_update_status';
  } else if (startsWith('inventory') || startsWith('stok') || startsWith('stock')) {
    intent = 'staff_check_inventory';
  } else if (startsWith('stats') || startsWith('statistik') || startsWith('laporan')) {
    intent = 'staff_get_stats';
  } else if (startsWith('edit') || startsWith('ubah') || startsWith('rubah') || startsWith('ganti')) {
    intent = 'staff_edit_vehicle';
  } else if (startsWith('upload') || startsWith('tambah') || startsWith('input')) {
    intent = 'staff_upload_vehicle';
  }

  if (!intent) return null;

  console.log(`[CommandHandler] 🛠️ Identified staff intent: ${intent} for command: "${cmd}"`);

  // Parse and execute command via StaffCommandService
  try {
    const parseResult = await StaffCommandService.parseCommand(cmd, intent);
    if (!parseResult.isValid) {
      return {
        success: false,
        message: parseResult.error || `Command ${intent} tidak valid.`,
        followUp: true,
      };
    }

    const executionResult = await StaffCommandService.executeCommand(
      intent,
      parseResult.params,
      tenantId,
      phoneNumber,
      conversationId || "",
      undefined,
      true // Skip auth check because we already checked userRoleLevel
    );

    return {
      success: executionResult.success,
      message: executionResult.message,
      followUp: true,
    };
  } catch (error: any) {
    console.error(`[CommandHandler] ❌ Error executing staff command:`, error);
    return {
      success: false,
      message: `Terjadi kesalahan saat memproses perintah: ${error.message}`,
      followUp: true,
    };
  }
}


/**
 * Handle contact commands (send staff contact to customer)
 */
async function handleContactCommand(
  cmd: string,
  context: CommandContext
): Promise<CommandResult> {
  const { tenantId } = context;

  // Parse command: "kirim kontak sales" or "kirim kontak admin" or "kirim kontak owner"
  let targetRole: string | null = null;

  if (cmd.includes('owner')) {
    targetRole = 'OWNER';
  } else if (cmd.includes('admin')) {
    targetRole = 'ADMIN';
  } else if (cmd.includes('sales') || cmd.includes('staff')) {
    targetRole = 'SALES';
  }

  if (!targetRole) {
    // List available contacts
    const tenants = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, logoUrl: true },
    });

    return {
      success: true,
      message: `📇 *Kontak ${tenants?.name || 'Showroom'}*\n\nPilih kontak yang ingin dikirim:\n\n1. 📋 *Kirim Kontak Owner*\n   Ketik: "kirim kontak owner"\n\n2. 📋 *Kirim Kontak Admin*\n   Ketik: "kirim kontak admin"\n\n3. 📋 *Kirim Kontak Sales*\n   Ketik: "kirim kontak sales"\n\nKontak akan dikirim dalam format vCard yang bisa langsung disimpan ke HP.`,
      followUp: true,
    };
  }

  // Fetch user by role
  const user = await prisma.user.findFirst({
    where: {
      tenantId,
      role: targetRole,
      phone: { not: null },
    },
    select: {
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
    },
  });

  if (!user || !user.phone) {
    return {
      success: false,
      message: `❌ Maaf, tidak ditemukan kontak untuk role ${targetRole}.\n\nSilakan hubungi admin untuk informasi lebih lanjut.`,
      followUp: true,
    };
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true },
  });

  // Generate vCard
  const vCardBuffer = generateVCardBuffer({
    firstName: user.firstName,
    lastName: user.lastName || '',
    phone: user.phone,
    role: user.role,
    organization: tenant?.name || 'Showroom',
  });

  const vCardFilename = generateVCardFilename({
    firstName: user.firstName,
    lastName: user.lastName || '',
    phone: user.phone,
    role: user.role,
  });

  // Upload vCard to storage
  const timestamp = Date.now();
  const storageKey = `contacts/${tenantId}/${timestamp}-${vCardFilename}`;
  const vCardUrl = await StorageService.uploadPhoto(
    vCardBuffer,
    storageKey,
    'text/vcard'
  );

  // Return contact info for sending
  return {
    success: true,
    message: `📇 *Kontak ${user.role}*\n\nNama: ${user.firstName} ${user.lastName || ''}\nRole: ${user.role}\n\n✅ vCard berhasil dibuat! Mengirim kontak...`,
    vCardUrl,
    vCardFilename,
    contactInfo: {
      name: `${user.firstName} ${user.lastName || ''}`.trim(),
      phone: user.phone,
    },
    followUp: true,
  };
}

/**
 * Handle report commands (ADMIN+ only)
 * Returns text summary + dashboard link instead of PDF header/file
 */
export async function handleReportCommand(
  cmd: string,
  context: CommandContext
): Promise<CommandResult> {
  // Map command to text generator function
  const reportGenerators: Record<string, (ctx: CommandContext) => Promise<CommandResult>> = {
    // Sales & Revenue
    'sales report': generateSalesReportText,
    'whatsapp ai': generateWhatsAppAIReportText,
    'metrix penjualan': generateSalesMetricsText,
    'metrics penjualan': generateSalesMetricsText,
    'metrix pelanggan': generateCustomerMetricsText,
    'metrics pelanggan': generateCustomerMetricsText,
    'customer metrics': generateCustomerMetricsText,
    'customer metric': generateCustomerMetricsText,
    'metrix operational': generateOperationalMetricsText,
    'metrics operational': generateOperationalMetricsText,
    'operational metrics': generateOperationalMetricsText,
    'operational metric': generateOperationalMetricsText,
    'tren penjualan': generateSalesTrendsText,
    'trends penjualan': generateSalesTrendsText,
    'sales trends': generateSalesTrendsText,
    'sales trend': generateSalesTrendsText,

    // Staff
    'staff performance': generateStaffPerformanceText,

    // Inventory
    'low stock alert': generateLowStockText,
    'low stock': generateLowStockText,
    'total inventory': generateInventoryReportText,
    'stock report': generateInventoryReportText,
    'total stok': generateInventoryReportText,
    'stok total': generateInventoryReportText,
    'average price': generateAveragePriceText,
    'avg price': generateAveragePriceText,
    'rata-rata harga': generateAveragePriceText,

    // Revenue - keeping only unique reports
    'sales summary': generateSalesReportText,
    'total penjualan': generateSalesReportText,
    'total sales': generateSalesReportText,
    'sales total': generateSalesReportText,
    'test-image': handleTestImageCommand,
    'test image': handleTestImageCommand,
    'debug image': handleTestImageCommand,
    'kkb': (ctx) => generateKKBSimulationText(cmd, ctx),
    'simulasi': (ctx) => generateKKBSimulationText(cmd, ctx),
  };

  // Find matching generator
  console.log(`[Command Handler] 🔍 Looking for report generator for command: "${cmd}"`);
  for (const [keyword, generator] of Object.entries(reportGenerators)) {
    if (cmd.includes(keyword)) {
      console.log(`[Command Handler] ✅ Found match: "${keyword}" → calling generator`);
      return await generator(context);
    }
  }
  console.log(`[Command Handler] ❌ No report generator match found for: "${cmd}"`);

  // Generic 'report' or 'pdf' or 'admin' without specific type
  if (cmd.includes('report') || cmd.includes('pdf') || cmd.includes('admin') || cmd.includes('owner')) {
    return {
      success: true,
      message: getAdminMenuText(),
      followUp: true,
    };
  }

  return {
    success: false,
    message: 'Report tidak ditemukan. Ketik "report" untuk melihat daftar report yang tersedia.',
    followUp: true,
  };
}

// ============================================================================
// TEXT REPORT GENERATORS (Replaces PDF Generators)
// ============================================================================

async function generateSalesReportText(ctx: CommandContext): Promise<CommandResult> {
  const now = new Date();
  const startDate = new Date();
  startDate.setDate(now.getDate() - 30);

  const data = await ReportDataService.gather('sales-report', ctx.tenantId, startDate, now);
  const insights = InsightEngine.generate(data);

  const formattedValue = formatCurrency(data.totalRevenue || 0);
  const avgPrice = formatCurrency(data.avgPrice || 0);

  const message = `📊 *LAPORAN PENJUALAN (30 Hari)*
_Data Real-time: ${formatDate(now)}_

💰 *Total Terjual*: ${data.totalSales} unit
💵 *Total Revenue*: ${formattedValue}
🏷️ *Rata-rata Harga*: ${avgPrice}

*Top Brand:*
${(data.salesByBrand || []).slice(0, 3).map((m: any, i: number) => `${i + 1}. ${m.brand}: ${m.count} unit`).join('\n')}

💡 *DEEP ANALYSIS & STRATEGIC:*
${insights.slice(0, 3).map(ins => `• ${ins}`).join('\n')}

🔗 *Dashboard Lengkap:*
https://primamobil.id/dashboard/whatsapp-ai/analytics?tab=sales

_Powered by AutoLumiku Real-time Analytics_`;

  return { success: true, message, followUp: true };
}

async function generateInventoryReportText(ctx: CommandContext): Promise<CommandResult> {
  const now = new Date();
  const startDate = new Date();
  startDate.setDate(now.getDate() - 30);

  const data = await ReportDataService.gather('total-inventory', ctx.tenantId, startDate, now);
  const insights = InsightEngine.generate(data);

  const message = `📦 *LAPORAN INVENTORY SHOWROOM*
_Data Real-time: ${formatDate(now)}_

Total Stok: *${data.totalInventory} unit*
Estimasi Aset: *${formatCurrency(data.avgStockPrice! * data.totalInventory!)}*
Rata-rata Harga: *${formatCurrency(data.avgStockPrice || 0)}*

💡 *STRATEGIC INSIGHTS:*
${insights.filter(i => i.includes('Stok') || i.includes('Aset')).slice(0, 2).map(ins => `• ${ins}`).join('\n')}

🔗 *Inventory Detail:*
https://primamobil.id/dashboard/vehicles

_Data akurat & sinkron dengan database terbaru._`;

  return { success: true, message, followUp: true };
}

async function generateWhatsAppAIReportText(ctx: CommandContext): Promise<CommandResult> {
  const now = new Date();
  const startDate = new Date();
  startDate.setDate(now.getDate() - 30);

  const data = await ReportDataService.gather('whatsapp-analytics', ctx.tenantId, startDate, now);
  if (!data || !data.whatsapp) return { success: false, message: "Gagal mengambil data AI real-time." };

  const insights = InsightEngine.generate(data);

  const message = `🤖 *WHATSAPP AI ANALYTICS (30 Hari)*
_Metodologi: Real-time Message Parsing_

💬 *Total Percakapan*: ${data.whatsapp.totalConversations}
⚡ *Response Rate AI*: ${data.whatsapp.aiResponseRate}%
👥 *Eskalasi Staff*: ${data.whatsapp.escalationRate}%
⏱️ *Avg Response Time*: ${data.whatsapp.avgResponseTime} detik

*Top Inquiry:*
${(data.whatsapp.intentBreakdown || []).slice(0, 3).map((i: any) => `• ${i.intent}: ${i.count} (${i.percentage}%)`).join('\n')}

💡 *AI STRATEGIC INSIGHTS:*
${insights.filter(i => i.includes('AI') || i.includes('Beban') || i.includes('Minat')).slice(0, 3).map(ins => `• ${ins}`).join('\n')}

🔗 *Analisis Detail Interaksi:*
https://primamobil.id/dashboard/whatsapp-ai/analytics

_Sistem memantau percakapan secara 24/7._`;

  return { success: true, message, followUp: true };
}

async function generateStaffPerformanceText(ctx: CommandContext): Promise<CommandResult> {
  const now = new Date();
  const startDate = new Date();
  startDate.setDate(now.getDate() - 30);

  const data = await ReportDataService.gather('staff-performance', ctx.tenantId, startDate, now);
  const insights = InsightEngine.generate(data);

  const message = `👥 *STAFF PERFORMANCE (30 Hari)*
_Metrik: Total Unit Terjual_

Total Staff Sales: ${(data.staffPerformance || []).length} orang
Total Unit Terjual: ${data.totalSales || 0} unit

*Top Performers:*
${(data.staffPerformance || []).slice(0, 3).map((s: any, i: number) =>
    `${i + 1}. *${s.name}*: ${s.sales} unit (${formatCurrency(s.revenue)})`
  ).join('\n')}

💡 *STRATEGIC HR INSIGHTS:*
${insights.filter(i => i.includes('SDM')).slice(0, 2).map(ins => `• ${ins}`).join('\n')}

🔗 *Manajemen Staff:*
https://primamobil.id/dashboard/admin/users

_Data berdasarkan unit dengan status SOLD._`;

  return { success: true, message, followUp: true };
}

// Reuse existing data fetchers or logic for smaller metrics
// NEW: Distinct generator for "Total Penjualan" to avoid duplication
async function generateSalesMetricsText(ctx: CommandContext): Promise<CommandResult> {
  const now = new Date();
  const startDate = new Date();
  startDate.setDate(now.getDate() - 30);

  // Reuse gathered data but format differently
  const data = await ReportDataService.gather('sales-metrics', ctx.tenantId, startDate, now);

  const formattedRevenue = formatCurrency(data.totalRevenue || 0);

  // Simplified Metrics Response (No Deep Insights)
  const message = `📈 *TOTAL PENJUALAN SHOWROOM*
_Data Real-time: ${formatDate(now)}_

💰 *Total Revenue*: ${formattedRevenue}
📦 *Unit Terjual*: ${data.totalSales || 0} unit
🎯 *Total Leads*: ${data.totalLeads || 0} prospek

*Konversi:*
${data.totalLeads ? Math.round(((data.totalSales || 0) / data.totalLeads) * 100) : 0}% dari total leads berhasil closing.

🔗 *Lihat Detail:*
https://primamobil.id/dashboard/whatsapp-ai/analytics?tab=sales`;

  return { success: true, message, followUp: true };
}

async function generateCustomerMetricsText(ctx: CommandContext): Promise<CommandResult> {
  const now = new Date();
  const startDate = new Date();
  startDate.setDate(now.getDate() - 30);

  const data = await ReportDataService.gather('customer-metrics', ctx.tenantId, startDate, now);

  const conversion = data.totalLeads ? Math.round(((data.totalSales || 0) / data.totalLeads) * 100) : 0;

  const sourcesText = (data.leadSources || [])
    .sort((a, b) => b.count - a.count)
    .map(s => `• ${s.source}: ${s.count}`)
    .join('\n');

  const message = `👥 *METRIK PELANGGAN & LEAD*\n` +
    `_Data Real-time: ${formatDate(now)}_\n\n` +
    `🔥 *Leads Baru (30 hari)*: ${data.totalLeads || 0} prospek\n` +
    (sourcesText ? `*Asal Leads:*\n${sourcesText}\n\n` : '') +
    `✅ *Total Pelanggan Baru*: ${data.totalCustomers || 0} terdaftar\n` +
    `📊 *Total Database Pelanggan*: ${data.totalAllTimeCustomers || 0} orang\n\n` +
    `🎯 *Lead Conversion Rate*: ${conversion}%\n` +
    (conversion > 15 ? "🚀 Performa konversi sangat baik!" : conversion > 5 ? "📈 Konversi stabil, terus tingkatkan follow-up." : "⚠️ Konversi rendah, perlu evaluasi alur sales.") + "\n\n" +
    `🔗 *Manajemen Lead:* \n` +
    `https://primamobil.id/dashboard/leads\n\n` +
    `🔗 *Manajemen Pelanggan:* \n` +
    `https://primamobil.id/dashboard/admin/users\n\n` +
    `_Sistem memantau asal sumber leads secara otomatis._`;

  return { success: true, message, followUp: true };
}

async function generateOperationalMetricsText(ctx: CommandContext): Promise<CommandResult> {
  const now = new Date();
  const startDate = new Date();
  startDate.setDate(now.getDate() - 30);

  const data = await ReportDataService.gather('operational-metrics', ctx.tenantId, startDate, now);

  let aiStats = "";
  if (data.whatsapp) {
    aiStats = `🤖 *Performa AI & Chat:*\n` +
      `• Total Chat: ${data.whatsapp.totalConversations}\n` +
      `• AI Response Rate: ${data.whatsapp.aiResponseRate}%\n` +
      `• Escalation Rate: ${data.whatsapp.escalationRate}%\n` +
      `• Avg Response Time: ${data.whatsapp.avgResponseTime}s\n\n`;
  }

  const message = `⚙️ *METRIK OPERASIONAL*\n` +
    `_Data Analitik 30 Hari Terakhir_\n\n` +
    aiStats +
    `Analisis operasional dan efisiensi tim tersedia lengkap di dashboard.\n\n` +
    `🔗 *Lihat di Dashboard:* \n` +
    `https://primamobil.id/dashboard/analytics`;

  return { success: true, message, followUp: true };
}

async function generateSalesTrendsText(ctx: CommandContext): Promise<CommandResult> {
  const now = new Date();
  const startDate = new Date();
  startDate.setDate(now.getDate() - 30);

  const data = await ReportDataService.gather('sales-trends', ctx.tenantId, startDate, now);

  let trendDetail = "";
  if (data.dailySales && data.dailySales.length > 0) {
    const last7Days = data.dailySales.slice(-7);
    const totalLast7 = last7Days.reduce((sum, d) => sum + d.count, 0);
    const totalPrev7 = data.dailySales.slice(-14, -7).reduce((sum, d) => sum + d.count, 0);

    trendDetail = `📊 *Ringkasan 30 Hari Terakhir*\n` +
      `• Total Terjual: ${data.totalSales || 0} unit\n` +
      `• Penjualan 7 hari terakhir: ${totalLast7} unit\n` +
      `• Penjualan 7-14 hari lalu: ${totalPrev7} unit\n\n` +
      (totalLast7 > totalPrev7 ? "📈 Tren sedang meningkat!" : totalLast7 < totalPrev7 ? "📉 Tren sedikit menurun." : "↔️ Tren stabil.") + "\n\n";
  }

  const message = `📈 *TREN PENJUALAN*\n` +
    `_Analisis Performa 30 Hari Terakhir_\n\n` +
    trendDetail +
    `Grafik lengkap dan analisis pertumbuhan tersedia di dashboard.\n\n` +
    `🔗 *Lihat Grafik:* \n` +
    `https://primamobil.id/dashboard/whatsapp-ai/analytics?tab=sales`;

  return { success: true, message, followUp: true };
}



async function generateLowStockText(ctx: CommandContext): Promise<CommandResult> {
  const now = new Date();
  const startDate = new Date();
  startDate.setDate(now.getDate() - 30);

  const data = await ReportDataService.gather('low-stock-alert', ctx.tenantId, startDate, now);

  let stockList = "";
  if (data.lowStockVehicles && data.lowStockVehicles.length > 0) {
    stockList = `Daftar unit yang sudah lama di stok:\n` +
      data.lowStockVehicles.slice(0, 5).map(v =>
        `• ${v.status === 'critical' ? '🔴' : '🟡'} [${v.displayId}] ${v.make} ${v.model} (${v.daysInStock} hari)`
      ).join('\n') + (data.lowStockVehicles.length > 5 ? `\n...dan ${data.lowStockVehicles.length - 5} unit lainnya.` : "") + "\n\n";
  } else {
    stockList = "✅ Semua stok masih dalam kondisi fresh (di bawah 90 hari).\n\n";
  }

  const message = `⚠️ *LOW STOCK ALERT*\n\n` +
    stockList +
    `Cek detail unit yang perlu restock atau promo khusus di dashboard inventory.\n\n` +
    `🔗 *Lihat Inventory:* \n` +
    `https://primamobil.id/dashboard/vehicles?status=AVAILABLE`;

  return { success: true, message, followUp: true };
}

async function generateAveragePriceText(ctx: CommandContext): Promise<CommandResult> {
  const now = new Date();
  const startDate = new Date();
  startDate.setDate(now.getDate() - 30);

  const data = await ReportDataService.gather('average-price', ctx.tenantId, startDate, now);

  const count = data.totalInventory || 0;
  const avgStock = data.avgStockPrice || 0;
  const avgSold = data.avgPrice || 0;

  const message = `🏷️ *ANALISIS HARGA RATA-RATA*\n` +
    `_Data Real-time ${formatDate(now)}_\n\n` +
    `💰 *Rata-rata Harga Terjual*: ${formatCurrency(avgSold)}\n` +
    `📦 *Rata-rata Harga Stok*: ${formatCurrency(avgStock)}\n` +
    `📊 *Total Unit di Showroom*: ${count} unit\n\n` +
    (avgSold > avgStock ? "💡 Unit yang terjual rata-rata lebih mahal dari stok saat ini." : "💡 Harga stok saat ini rata-rata lebih tinggi dari unit yang baru saja terjual.") + "\n\n" +
    `🔗 *Lihat Inventory:* \n` +
    `https://primamobil.id/dashboard/vehicles`;

  return { success: true, message, followUp: true };
}

async function generateKKBSimulationText(cmd: string, ctx: CommandContext): Promise<CommandResult> {
  try {
    const { WhatsAppReportService } = await import('../operations/report.service');

    // Extract vehicle ID if present (e.g. PM-PST-001, PM=PST=001)
    const vehicleCodeMatch = cmd.match(/pm[-=\s]+[a-z0-9]+[-=\s]+\d+/i);
    // Normalize to PM-CODE-NUMBER (replace = or space with -)
    const vehicleCode = vehicleCodeMatch ? vehicleCodeMatch[0].toUpperCase().replace(/[=\s]+/g, '-') : undefined;

    const message = await WhatsAppReportService.getReport('kkb', ctx.tenantId, vehicleCode, cmd);
    return { success: true, message, followUp: true };
  } catch (error: any) {
    return { success: false, message: `Gagal mengambil simulasi KKB: ${error.message}` };
  }
}

// ============================================================================
// DIAGNOSTIC TOOLS
// ============================================================================

async function handleTestImageCommand(ctx: CommandContext): Promise<CommandResult> {
  const { tenantId, phoneNumber } = ctx;
  console.log(`[Diagnostic] 🧪 Starting Image Variant Test for ${phoneNumber}`);

  // 1. Find a vehicle with photo
  const vehicle = await prisma.vehicle.findFirst({
    where: { tenantId, status: { not: 'DELETED' }, photos: { some: {} } },
    include: { photos: { take: 1 } }
  });

  if (!vehicle || !vehicle.photos[0]) {
    return { success: false, message: "❌ Gagal: Tidak ada kendaraan dengan foto untuk testing." };
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { aimeowAccount: true }
  });

  // Access client ID safely
  const account = tenant?.aimeowAccount as any;
  const clientId = account?.id || account?.clientId || (tenant as any)?.aimeowApiClientId;

  if (!clientId) return { success: false, message: "❌ Gagal: Client ID tidak ditemukan." };

  // 2. Read file
  // Try to find file path
  const storageKey = vehicle.photos[0].originalUrl.split('/uploads/')[1];
  const possibleDirs = [process.env.UPLOAD_DIR, '/app/uploads', path.join(process.cwd(), 'uploads')].filter(Boolean) as string[];

  let buffer: Buffer | undefined;
  for (const dir of possibleDirs) {
    try {
      const fullPath = path.join(dir, storageKey);
      if (fs.existsSync(fullPath)) {
        buffer = fs.readFileSync(fullPath);
        break;
      }
    } catch (e) { }
  }

  if (!buffer) {
    return { success: false, message: "❌ Gagal: File foto tidak ditemukan di lokal server." };
  }

  let sharp: any;
  try {
    sharp = require('sharp');
  } catch (e) {
    return { success: false, message: "❌ Gagal: Library 'sharp' tidak terinstall." };
  }

  const endpoint = `${process.env.AIMEOW_BASE_URL || 'https://meow.lumiku.com'}/api/v1/clients/${clientId}/send-images`;

  const send = async (name: string, payload: any) => {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return res.ok ? `✅ ${name}: Terkirim (200 OK)` : `❌ ${name}: Gagal (${res.status})`;
    } catch (e: any) {
      return `❌ ${name}: Error (${e.message})`;
    }
  };

  const results: string[] = [];

  // VARIANT A: CURRENT LOGIC (1024px, JPEG 80%, Data URI, MimeType)
  const jpegBuffer = await sharp(buffer)
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
  const base64A = jpegBuffer.toString('base64');

  results.push(await send('Variant A (Standard)', {
    phone: phoneNumber,
    images: [{ imageUrl: `data:image/jpeg;base64,${base64A}`, caption: "Test A: Standard (1024px, MimeType)" }],
    viewOnce: false, isViewOnce: false, mimetype: 'image/jpeg', mimeType: 'image/jpeg', type: 'image', mediaType: 'image'
  }));

  // VARIANT B: NO TOP MIME
  results.push(await send('Variant B (No Top Mime)', {
    phone: phoneNumber,
    images: [{ imageUrl: `data:image/jpeg;base64,${base64A}`, caption: "Test B: No Top-Level Mime" }],
    viewOnce: false, isViewOnce: false
  }));

  // VARIANT C: RAW BASE64
  results.push(await send('Variant C (Raw Base64)', {
    phone: phoneNumber,
    images: [{ imageUrl: base64A, caption: "Test C: Raw Base64 (No Prefix)" }],
    viewOnce: false, isViewOnce: false, mimetype: 'image/jpeg', mimeType: 'image/jpeg'
  }));

  // VARIANT D: SMALL (512px)
  const smallBuffer = await sharp(buffer).resize(512, 512, { fit: 'inside' }).jpeg({ quality: 70 }).toBuffer();
  const base64D = smallBuffer.toString('base64');

  results.push(await send('Variant D (Small 512px)', {
    phone: phoneNumber,
    images: [{ imageUrl: `data:image/jpeg;base64,${base64D}`, caption: "Test D: Small 512px" }],
    viewOnce: false, isViewOnce: false, mimetype: 'image/jpeg', mimeType: 'image/jpeg'
  }));

  return {
    success: true,
    message: `🧪 *HASIL DIAGNOSTIC IMAGE*\n\n${results.join('\n')}\n\nSilakan cek HP Anda, variant mana yang gambarnya MUNCUL?\n(Reply dengan A, B, C, atau D)`,
    followUp: true
  };
}




