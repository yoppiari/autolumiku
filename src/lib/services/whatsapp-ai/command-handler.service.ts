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
import PDFDocument from 'pdfkit';
import { ROLE_LEVELS } from '@/lib/rbac';
import { generateVCardBuffer, generateVCardFilename } from './vcard-generator';
import { StorageService } from '../storage.service';
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
import { MessageIntent } from './intent-classifier.service';

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
 * Create PDFDocument with font configuration that works in standalone builds
 */
function createPDFDocument() {
  return new PDFDocument({
    size: 'A4',
    margin: 50,
    // Don't specify font to avoid loading .afm files
    // PDFKit will use built-in fonts
    bufferPages: true,
  });
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

  // Unknown command
  console.log(`[CommandHandler] ❌ Unknown command - returning help message`);
  return {
    success: false,
    message: 'Maaf, saya tidak mengerti command tersebut. Ketik "help" untuk daftar command yang tersedia.',
    followUp: true,
  };
}

/**
 * Check if command is universal (all roles)
 */
function isUniversalCommand(cmd: string): boolean {
  const universalCommands = [
    // Help commands are universal
    'help', 'bantuan', 'panduan', 'cara', 'guide', 'menu', 'fitur', 'tool', 'perintah', 'penggunaan', 'command',
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
    'pdf report',
    'kirim report',
    'kirim pdf',
    'kirim pdf nya',
    'kirim reportnya',
    'kirim pdfnya',
    'laporan penjualan',
    'laporan penjualan lengkap',
    'laporan lengkap',
    'sales report lengkap',
    'penjualan showroom'
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

  // Use the new CLEAN AND CONCISE format
  const helpMsg = `
📋 *PANDUAN STAFF* (Format baru, lebih ringkas):
Jika staff bingung, arahkan ke format berikut:

📸 *UPLOAD*:
   • Ketik: *upload* (ikut flow)
   • _Atau:_ "upload [nama] [tahun] [harga]"

📋 *CEK STOK*:
   • Ketik: *stok* [filter]
   • _Contoh:_ "stok ready", "stok brio"

🔄 *UPDATE STATUS*:
   • Ketik: *status [ID] [SOLD/BOOKED]*
   • _Contoh:_ "status PM-PST-001 SOLD"

🚙 *EDIT DATA*:
   • Ketik: *edit [ID] [data]*
   • _Contoh:_ "edit PM-PST-001 harga 150jt"

👮‍♂️ *ADMIN*:
   • _Ketik:_ "sales report", "staff performance"
`;

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

    // Revenue
    'total penjualan showroom': generateSalesMetricsText,
    'total penjualan': generateSalesMetricsText,
    'total sales': generateSalesMetricsText,
    'sales total': generateSalesMetricsText,
    'total revenue': generateSalesMetricsText,
    'sales summary': generateSalesReportText,
    'penjualan': generateSalesReportText,
    'laporan penjualan': generateSalesReportText,
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

  // Generic 'report' or 'pdf' without specific type
  if (cmd.includes('report') || cmd.includes('pdf')) {
    return {
      success: true,
      message: `📊 *Admin Dashboard & Reports*

Silakan pilih info ringkasan yang diinginkan:

📈 *Sales & Revenue:*
• Sales Report
• Metrik Penjualan
• Tren Penjualan

📦 *Inventory:*
• Total Inventory
• Low Stock Alert
• Rata-rata Harga

🤖 *System & Staff:*
• WhatsApp AI Analytics
• Staff Performance

Ketik nama report (contoh: "sales report" atau "whatsapp ai") untuk mendapatkan ringkasan data real-time + link dashboard.`,
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
  const totalValue = formatCurrency(data.totalRevenue || 0); // Using gather's revenue context for inventory if needed, or recalculate

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
async function generateSalesMetricsText(ctx: CommandContext): Promise<CommandResult> {
  return generateSalesReportText(ctx); // Reuse summary
}

async function generateCustomerMetricsText(ctx: CommandContext): Promise<CommandResult> {
  const now = new Date();
  const startDate = new Date();
  startDate.setDate(now.getDate() - 30);

  const data = await ReportDataService.gather('customer-metrics', ctx.tenantId, startDate, now);

  const message = `👥 *METRIK PELANGGAN & LEAD*
_Data Real-time: ${formatDate(now)}_

🔥 *Leads Baru (30 hari)*: ${data.totalLeads || 0} prospek
✅ *Total Pelanggan*: ${data.totalCustomers || 0} terdaftar

🔗 *Manajemen Lead:*
https://primamobil.id/dashboard/leads

🔗 *Manajemen Pelanggan:*
https://primamobil.id/dashboard/admin/users

_Sistem memantau asal sumber leads secara otomatis._`;

  return { success: true, message, followUp: true };
}

async function generateOperationalMetricsText(ctx: CommandContext): Promise<CommandResult> {
  const message = `⚙️ *METRIK OPERASIONAL*

Analisis operasional tersedia lengkap di dashboard.

🔗 *Lihat di Dashboard:*
https://primamobil.id/dashboard/analytics`;
  return { success: true, message, followUp: true };
}

async function generateSalesTrendsText(ctx: CommandContext): Promise<CommandResult> {
  // Trends are best viewed on charts
  const message = `📈 *TREN PENJUALAN*

Grafik tren dan analisis pertumbuhan tersedia di dashboard.

🔗 *Lihat Grafik:*
https://primamobil.id/dashboard/whatsapp-ai/analytics?tab=sales`;
  return { success: true, message, followUp: true };
}



async function generateLowStockText(ctx: CommandContext): Promise<CommandResult> {
  // Minimal logic for low stock
  const message = `⚠️ *LOW STOCK ALERT*

Cek daftar unit yang menipis atau perlu restock di dashboard inventory.

🔗 *Lihat Inventory:*
https://primamobil.id/dashboard/vehicles?status=AVAILABLE`;
  return { success: true, message, followUp: true };
}

async function generateAveragePriceText(ctx: CommandContext): Promise<CommandResult> {
  const data = await fetchInventoryData(ctx);
  const totalValue = data.totalValue;
  const count = data.totalStock;
  const avg = count > 0 ? totalValue / count : 0;

  const message = `🏷️ *RATA-RATA HARGA STOK*

Rata-rata: ${formatCurrency(avg)}
Total Stok: ${count} unit

🔗 *Lihat Inventory:*
https://primamobil.id/dashboard/vehicles`;
  return { success: true, message, followUp: true };
}

// ============================================================================
// DATA FETCHING HELPERS
// ============================================================================

async function fetchSalesData(context: CommandContext, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const soldVehicles = await prisma.vehicle.findMany({
    where: {
      tenantId: context.tenantId,
      status: 'SOLD',
      updatedAt: { gte: startDate },
    },
    select: {
      make: true,
      model: true,
      year: true,
      price: true,
      updatedAt: true,
      createdBy: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  const totalSalesValue = soldVehicles.reduce((sum, v) => sum + Number(v.price), 0);
  const totalSalesCount = soldVehicles.length;

  // Vehicles by make
  const byMake: Record<string, { count: number; value: number }> = {};
  soldVehicles.forEach((v) => {
    const make = v.make || 'Other';
    if (!byMake[make]) byMake[make] = { count: 0, value: 0 };
    byMake[make].count++;
    byMake[make].value += Number(v.price);
  });

  // Sales trend by day
  const salesByDay: Record<string, { count: number; value: number }> = {};
  soldVehicles.forEach((v) => {
    const day = new Date(v.updatedAt).toLocaleDateString('id-ID');
    if (!salesByDay[day]) salesByDay[day] = { count: 0, value: 0 };
    salesByDay[day].count++;
    salesByDay[day].value += Number(v.price);
  });

  return {
    summary: { totalSalesCount, totalSalesValue },
    vehicles: soldVehicles.map((v) => ({ ...v, price: Number(v.price) })),
    byMake: Object.entries(byMake).map(([make, data]) => ({ make, ...data })),
    salesByDay: Object.entries(salesByDay).map(([day, data]) => ({ day, ...data })),
    avgPrice: totalSalesCount > 0 ? totalSalesValue / totalSalesCount : 0,
  };
}

async function fetchStaffPerformance(context: CommandContext, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const soldVehicles = await prisma.vehicle.findMany({
    where: {
      tenantId: context.tenantId,
      status: 'SOLD',
      updatedAt: { gte: startDate },
    },
    select: {
      make: true,
      model: true,
      price: true,
      updatedAt: true,
      createdBy: true,
    },
  });

  const salesStaff = await prisma.user.findMany({
    where: {
      tenantId: context.tenantId,
      role: { in: ['SALES', 'sales', 'STAFF', 'staff'] },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  });

  const staffSales: Record<string, { name: string; count: number; value: number; vehicles: any[] }> = {};
  salesStaff.forEach((user) => {
    staffSales[user.id] = {
      name: `${user.firstName} ${user.lastName}`,
      count: 0,
      value: 0,
      vehicles: [],
    };
  });

  soldVehicles.forEach((v) => {
    if (v.createdBy && staffSales[v.createdBy]) {
      staffSales[v.createdBy].count++;
      staffSales[v.createdBy].value += Number(v.price);
      staffSales[v.createdBy].vehicles.push(v);
    }
  });

  const topPerformers = Object.entries(staffSales)
    .map(([id, data]) => ({ id, ...data }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);

  return { topPerformers, totalStaff: salesStaff.length };
}

async function fetchInventoryData(context: CommandContext) {
  const available = await prisma.vehicle.findMany({
    where: {
      tenantId: context.tenantId,
      status: 'AVAILABLE',
    },
    select: {
      displayId: true,
      make: true,
      model: true,
      year: true,
      price: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log('[fetchInventoryData] Available vehicles:', available.length);
  console.log('[fetchInventoryData] Vehicle prices:', available.map(v => ({
    displayId: v.displayId,
    price: v.price,
    priceNumber: Number(v.price)
  })));

  const totalValue = available.reduce((sum, v) => sum + Number(v.price), 0);
  console.log('[fetchInventoryData] Total value calculated:', totalValue);
  console.log('[fetchInventoryData] Total value formatted:', formatCurrency(totalValue));

  const avgDaysInStock = available.length > 0
    ? available.reduce((sum, v) => {
      const days = Math.floor((new Date().getTime() - new Date(v.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      return sum + days;
    }, 0) / available.length
    : 0;

  return {
    totalStock: available.length,
    totalValue,
    avgDaysInStock: Math.round(avgDaysInStock),
    vehicles: available.map((v) => ({ ...v, price: Number(v.price) })),
  };
}

async function fetchWhatsAppAIData(context: CommandContext, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  try {
    const conversations = await prisma.whatsAppConversation.findMany({
      where: {
        tenantId: context.tenantId,
        startedAt: { gte: startDate },
        status: { not: 'deleted' },
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 50,
        },
      },
      take: 500,
      orderBy: { startedAt: 'desc' },
    });

    const totalConversations = conversations.length;
    const activeConversations = conversations.filter((c) => c.status === 'active').length;

    const customerMessages = conversations.reduce((sum, c) => {
      return sum + c.messages.filter((m) => m.direction === 'inbound').length;
    }, 0);

    const aiResponses = conversations.reduce((sum, c) => {
      return sum + c.messages.filter((m) => m.direction === 'outbound' && m.aiResponse).length;
    }, 0);

    const staffResponses = conversations.reduce((sum, c) => {
      return sum + c.messages.filter((m) => m.direction === 'outbound' && !m.aiResponse).length;
    }, 0);

    const aiResponseRate = customerMessages > 0
      ? Math.round((aiResponses / customerMessages) * 100)
      : 0;

    const escalatedConversations = conversations.filter((c) =>
      c.messages.some((m) => m.direction === 'outbound' && !m.aiResponse)
    ).length;

    const aiAccuracy = totalConversations > 0
      ? Math.round(((totalConversations - escalatedConversations) / totalConversations) * 100)
      : 0;

    const intents = { vehicle: 0, price: 0, greeting: 0, general: 0 };
    conversations.slice(0, 100).forEach((c) => {
      const firstMessage = c.messages.find((m) => m.direction === 'inbound');
      if (firstMessage) {
        const content = firstMessage.content.toLowerCase();
        if (content.includes('harga') || content.includes('price') || content.includes('berapa')) {
          intents.price++;
        } else if (content.includes('mobil') || content.includes('unit') || content.includes('stok')) {
          intents.vehicle++;
        } else if (content.includes('halo') || content.includes('hi') || content.includes('hello') || content.includes('selamat')) {
          intents.greeting++;
        } else {
          intents.general++;
        }
      }
    });

    const totalIntents = Object.values(intents).reduce((a, b) => a + b, 0);
    const intentBreakdown = Object.entries(intents).map(([intent, count]) => ({
      intent,
      count,
      percentage: totalIntents > 0 ? Math.round((count / totalIntents) * 100) : 0,
    }));

    return {
      overview: {
        totalConversations,
        activeConversations,
        customerMessages,
        aiResponses,
        staffResponses,
        aiResponseRate,
        escalatedConversations,
        aiAccuracy,
      },
      intentBreakdown,
    };
  } catch (error) {
    console.error('Error fetching WhatsApp AI data:', error);
    return null;
  }
}

// ============================================================================
// PDF GENERATORS WITH REAL DATA
// ============================================================================

// ============================================================================
// UNIFIED PDF GENERATOR
// ============================================================================

async function generateReportByType(
  type: ComprehensiveReportType,
  context: CommandContext
): Promise<CommandResult> {
  try {
    console.log(`[Report Generator] 📊 Generating ${type} for tenant ${context.tenantId}`);

    const tenant = await prisma.tenant.findUnique({
      where: { id: context.tenantId },
      select: { name: true, logoUrl: true },
    });

    // Calculate dates (last 30 days default)
    const now = new Date();
    const startDate = new Date();
    startDate.setDate(now.getDate() - 30);
    const periodLabel = '30 Hari Terakhir';

    // Gather data using shared service
    const reportData = await ReportDataService.gather(type, context.tenantId, startDate, now);

    // Map ReportData to professional WhatsAppCommandPDF config
    const generator = new WhatsAppCommandPDF();
    const metrics: any[] = [];
    let analysis: string[] = [];
    let chartData: any[] = [];

    // Basic Metrics (Common)
    if (reportData.totalSales !== undefined || type === 'sales-metrics' || type === 'sales-summary') {
      metrics.push({ label: 'Total Sales', value: `${reportData.totalSales || 0}`, unit: 'Unit', color: '#1d4ed8', formula: 'COUNT(SOLD)' });
    }
    if (reportData.totalRevenue !== undefined || type === 'sales-metrics') {
      metrics.push({ label: 'Total Revenue', value: formatNumber(reportData.totalRevenue || 0), unit: 'IDR', color: '#16a34a', formula: 'SUM(price)' });
    }
    if (reportData.avgPrice !== undefined || type === 'average-price') {
      metrics.push({ label: 'Avg Price', value: formatNumber(reportData.avgPrice || 0), unit: 'IDR', color: '#9333ea', formula: 'Revenue / Sales' });
    }
    if (reportData.totalInventory !== undefined || type === 'total-inventory') {
      metrics.push({ label: 'Stock', value: `${reportData.totalInventory || 0}`, unit: 'Available', color: '#ea580c', formula: 'COUNT(AVAILABLE)' });
    }

    // Staff Performance specific
    if (type === 'staff-performance') {
      const topStaff = reportData.staffPerformance?.[0];
      metrics.push({ label: 'Top Sales Staff', value: topStaff ? topStaff.name : 'N/A', color: '#10b981', formula: 'MAX(sales)' });
      metrics.push({ label: 'Total Sales Count', value: `${reportData.totalSales || 0}`, color: '#3b82f6', formula: 'SUM(staff.sales)' });
    }

    // WhatsApp Specific Metrics
    if (reportData.whatsapp || type === 'whatsapp-analytics') {
      const wa = reportData.whatsapp || { totalConversations: 0, aiResponseRate: 0, avgResponseTime: 0, escalationRate: 0, intentBreakdown: [] };
      metrics.push({ label: 'Conversations', value: `${wa.totalConversations}`, color: '#10b981', formula: 'COUNT(chats)' });
      metrics.push({ label: 'Response Rate', value: `${wa.aiResponseRate}%`, color: '#3b82f6', formula: 'AI_REPLY / TOTAL' });
      metrics.push({ label: 'Avg Resp Time', value: `${wa.avgResponseTime}s`, color: '#f59e0b', formula: 'AVG(time)' });
      metrics.push({ label: 'Escalation', value: `${wa.escalationRate}%`, color: '#ef4444', formula: 'HUMAN_REPLY / TOTAL' });

      chartData = wa.intentBreakdown.map((i: any, idx: number) => ({
        label: i.intent,
        value: `${i.count}`,
        color: ['#1d4ed8', '#16a34a', '#9333ea', '#ea580c'][idx % 4]
      }));
    }

    // Chart data for Sales (Top 4 Brands)
    if (reportData.salesByBrand && chartData.length === 0) {
      chartData = reportData.salesByBrand.slice(0, 4).map((b: any, idx: number) => ({
        label: b.brand,
        value: `${b.count}`,
        color: ['#1d4ed8', '#16a34a', '#9333ea', '#ea580c'][idx % 4]
      }));
    }

    // KPIs & Insights
    if (reportData.managementInsights && reportData.managementInsights.length > 0) {
      analysis = reportData.managementInsights.slice(0, 5).map(i => i.text);
    } else if (reportData.kpis) {
      analysis = [
        `Showroom Efficiency: ${reportData.kpis.efficiency}%`,
        `Inventory Turnover: ${reportData.kpis.inventoryTurnover}%`,
        `Staff Performance: ${reportData.kpis.salesPerEmployee}%`,
        `Customer Engagement Proxy: ${reportData.kpis.customerRetention}%`
      ];
    } else {
      const tenant = await prisma.tenant.findUnique({
        where: { id: context.tenantId },
        select: { name: true, logoUrl: true },
      });
      const tenantName = tenant?.name || 'Showroom';

      analysis = [
        `Analisa performa ${tenantName} menunjukkan pertumbuhan positif pada lead engagement.`,
        `Inventory turnover saat ini dalam batas normal.`,
        `Rekomendasi: Optimalisasi respon WhatsApp AI untuk konversi lebih tinggi.`
      ];
    }

    const generator = new WhatsAppCommandPDF();
    const pdfBuffer = await generator.generate({
      title: type.toUpperCase().replace(/-/g, ' '),
      subtitle: periodLabel,
      tenantName: tenant?.name || 'Showroom',
      logoUrl: tenant?.logoUrl || undefined,
      date: now,
      metrics,
      showChart: chartData.length > 0,
      chartData,
      analysis,
    });

    const filename = `${type}-${now.toISOString().split('T')[0]}.pdf`;

    return {
      success: true,
      message: `✅ Professional Report *${type.toUpperCase().replace(/-/g, ' ')}* (1-page) berhasil dibuat. Mengirim PDF...`,
      pdfBuffer,
      filename,
      followUp: true,
    };
  } catch (error) {
    console.error(`[Report Generator] ❌ Error generating ${type}:`, error);
    return {
      success: false,
      message: `Maaf, terjadi kesalahan saat membuat report: ${error instanceof Error ? error.message : 'Unknown error'}`,
      followUp: true,
    };
  }
}

// Map each specific report command to the unified generator
const generateSalesReportPDF = async (ctx: CommandContext): Promise<CommandResult> => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { name: true },
  });

  const generator = new OnePageSalesPDF();
  const pdfBuffer = await generator.generate({
    tenantName: tenant?.name || 'Showroom',
    period: '30 Hari Terakhir',
  });

  return {
    success: true,
    message: '✅ Professional Sales Report (1-page) berhasil dibuat. Mengirim PDF...',
    pdfBuffer,
    filename: `sales-report-${new Date().toISOString().split('T')[0]}.pdf`,
    followUp: true,
  };
};

const generateWhatsAppAIPDF = (ctx: CommandContext) => generateReportByType('whatsapp-analytics', ctx);
const generateSalesMetricsPDF = (ctx: CommandContext) => generateReportByType('sales-metrics', ctx);
const generateCustomerMetricsPDF = (ctx: CommandContext) => generateReportByType('customer-metrics', ctx);
const generateOperationalMetricsPDF = (ctx: CommandContext) => generateReportByType('operational-metrics', ctx);
const generateSalesTrendsPDF = (ctx: CommandContext) => generateReportByType('sales-trends', ctx);
const generateStaffPerformancePDF = (ctx: CommandContext) => generateReportByType('staff-performance', ctx);
const generateRecentSalesPDF = (ctx: CommandContext) => generateReportByType('recent-sales', ctx);
const generateLowStockPDF = (ctx: CommandContext) => generateReportByType('low-stock-alert', ctx);
const generateTotalSalesPDF = (ctx: CommandContext) => generateReportByType('total-sales', ctx);
const generateTotalRevenuePDF = (ctx: CommandContext) => generateReportByType('total-revenue', ctx);
const generateTotalInventoryPDF = (ctx: CommandContext) => generateReportByType('total-inventory', ctx);
const generateAveragePricePDF = (ctx: CommandContext) => generateReportByType('average-price', ctx);
const generateSalesSummaryPDF = (ctx: CommandContext) => generateReportByType('sales-summary', ctx);

// ============================================================================
// VEHICLE INVENTORY LISTING PDF (New Format with Images Table)
// ============================================================================

async function generateVehicleInventoryListingPDF(context: CommandContext): Promise<CommandResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: context.tenantId },
    select: { name: true, logoUrl: true },
  });

  // Fetch vehicles for the inventory listing
  const vehicles = await prisma.vehicle.findMany({
    where: {
      tenantId: context.tenantId,
      status: { not: 'DELETED' }, // Exclude deleted vehicles
    },
    select: {
      id: true,
      displayId: true,
      make: true,
      model: true,
      year: true,
      price: true,
      status: true,
      mileage: true,
      transmissionType: true,
      fuelType: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 50, // Limit to 50 vehicles
  });

  // Fetch main photos for each vehicle
  const vehiclesWithImages = await Promise.all(
    vehicles.map(async (v) => {
      const mainPhoto = await prisma.vehiclePhoto.findFirst({
        where: {
          vehicleId: v.id,
          isMainPhoto: true,
        },
        select: {
          thumbnailUrl: true,
        },
      });

      return {
        ...v,
        imageUrl: mainPhoto?.thumbnailUrl || undefined,
        transmission: v.transmissionType,
      };
    })
  );

  // Calculate metrics
  const activeVehicles = vehiclesWithImages.filter(v => v.status === 'AVAILABLE' || v.status === 'BOOKED').length;

  // Real leads count
  const totalLeads = await prisma.lead.count({
    where: {
      tenantId: context.tenantId,
      createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    }
  });

  const followUpRequired = vehiclesWithImages.filter(v => v.status === 'BOOKED').length;

  // Set period (last 30 days)
  const periodEnd = new Date();
  const periodStart = new Date();
  periodStart.setDate(periodEnd.getDate() - 30);

  // Use NEW Vehicle Inventory PDF
  const generator = new VehicleInventoryPDF();

  const reportConfig = {
    tenantName: tenant?.name || 'Showroom',
    logoUrl: tenant?.logoUrl || undefined,
    periodStart,
    periodEnd,
    vehicles: vehiclesWithImages.map(v => ({
      id: v.id,
      displayId: v.displayId || 'N/A',
      make: v.make,
      model: v.model,
      year: v.year,
      price: Number(v.price),
      status: v.status as any,
      imageUrl: v.imageUrl,
      mileage: v.mileage,
      transmission: v.transmission,
      fuelType: v.fuelType,
    })),
    metrics: {
      totalLeads,
      activeVehicles,
      followUpRequired,
    },
  };

  const pdfBuffer = await generator.generate(reportConfig);

  return {
    success: true,
    message: '✅ Vehicle Inventory Listing (format baru dengan tabel dan foto) berhasil dibuat. Mengirim PDF...',
    pdfBuffer,
    filename: `vehicle-inventory-${new Date().toISOString().split('T')[0]}.pdf`,
    followUp: true,
  };
}
