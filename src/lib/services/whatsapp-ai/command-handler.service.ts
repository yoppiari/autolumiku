/**
 * WhatsApp AI Command Handler Service
 *
 * Handles WhatsApp AI commands for:
 * - Universal commands (ALL roles): rubah, upload, inventory, status, statistik, kontak
 * - PDF report commands (ADMIN+ only): 14 report types
 *
 * Role-based access control:
 * - ALL roles: Universal commands
 * - ADMIN+ only (roleLevel >= 90): PDF report commands
 */

import { prisma } from '@/lib/prisma';
import PDFDocument from 'pdfkit';
import { ROLE_LEVELS } from '@/lib/rbac';
import { generateVCardBuffer, generateVCardFilename } from './vcard-generator';
import { StorageService } from '../storage.service';
import { AnalyticsPDFGenerator } from '@/lib/reports/analytics-pdf-generator';
import { CompactExecutivePDF } from '@/lib/reports/compact-executive-pdf';
import { WhatsAppCommandPDF, formatCurrency, formatNumber } from '@/lib/reports/whatsapp-command-pdf';
import * as fs from 'fs';
import * as path from 'path';

interface CommandContext {
  tenantId: string;
  userRole: string;
  userRoleLevel: number;
  phoneNumber: string;
  userId: string;
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
}

// Helper functions
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

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

  // Universal Commands (ALL roles)
  if (isUniversalCommand(cmd)) {
    return await handleUniversalCommand(cmd, context);
  }

  // PDF Report Commands (ADMIN+ only)
  if (isPDFCommand(cmd)) {
    // RBAC Check
    if (userRoleLevel < ROLE_LEVELS.ADMIN) {
      return {
        success: false,
        message: 'Maaf, fitur PDF Report hanya untuk Owner, Admin, dan Super Admin.',
        followUp: true,
      };
    }
    return await handlePDFCommand(cmd, context);
  }

  // Unknown command
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
    'rubah', 'ubah', 'edit',
    'upload',
    'inventory', 'stok',
    'status',
    'statistik', 'stats', 'laporan', // Tambah "laporan" untuk command statistik
    'kontak', 'contact',
  ];
  return universalCommands.some(c => cmd.includes(c));
}

/**
 * Check if command is PDF report command
 */
function isPDFCommand(cmd: string): boolean {
  // Single word triggers
  if (cmd === 'report' || cmd === 'pdf') {
    return true;
  }

  // Multi-word triggers
  const pdfCommands = [
    'sales report',
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
    'recent sales',
    'low stock alert',
    'total revenue',
    'total inventory',
    'average price',
    'sales summary',
    'report pdf',
    'pdf report',
    'kirim report',
    'kirim pdf',
    'kirim pdf nya',
    'kirim reportnya',
    'kirim pdfnya',
  ];

  // Check for direct matches
  if (pdfCommands.some(c => cmd.includes(c))) {
    return true;
  }

  // Regex patterns for more specific matching
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
  const { tenantId, phoneNumber } = context;

  // Edit vehicle
  if (cmd.includes('rubah') || cmd.includes('ubah') || cmd.includes('edit')) {
    // TODO: Implement edit flow
    return {
      success: true,
      message: 'Untuk mengedit data kendaraan, silakan gunakan menu Edit di dashboard: https://primamobil.id/dashboard/vehicles\n\nContoh:\n- Edit: https://primamobil.id/dashboard/vehicles/[id-kendaraan]/edit',
      followUp: true,
    };
  }

  // Upload vehicle
  if (cmd.includes('upload')) {
    return {
      success: true,
      message: 'Untuk upload kendaraan baru, silakan gunakan menu Upload di dashboard: https://primamobil.id/dashboard/vehicles/upload\n\nAnda akan diminta untuk:\n1. Input data kendaraan (merek, model, tahun, harga, dll)\n2. Upload foto kendaraan (max 10 foto)\n3. Submit untuk memproses',
      followUp: true,
    };
  }

  // Inventory/Stock check
  if (cmd.includes('inventory') || cmd.includes('stok')) {
    console.log(`[CommandHandler] 📦 Processing STOK command: ${cmd}`);

    try {
      const vehicles = await prisma.vehicle.findMany({
        where: {
          tenantId,
          status: { in: ['AVAILABLE', 'BOOKED'] },
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          displayId: true,
          make: true,
          model: true,
          year: true,
          price: true,
          status: true,
        },
      });

      console.log(`[CommandHandler] 📦 Found ${vehicles.length} vehicles in stock`);

      if (vehicles.length === 0) {
        const message = '📦 INVENTORY SHOWROOM\n\nTidak ada kendaraan tersedia saat ini.\n\nTotal stok: 0 unit';
        console.log(`[CommandHandler] 📦 Returning empty stock message`);
        return {
          success: true,
          message,
          followUp: true,
        };
      }

      const totalStock = await prisma.vehicle.count({
        where: {
          tenantId,
          status: { in: ['AVAILABLE', 'BOOKED'] },
        },
      });

      let message = `📦 INVENTORY SHOWROOM\n\nTotal stok: ${totalStock} unit\n\n10 Kendaraan terbaru:\n`;
      vehicles.forEach((v, idx) => {
        message += `${idx + 1}. ${v.make} ${v.model} (${v.year})\n`;
        message += `   ${formatCurrency(Number(v.price))} - ${v.status}\n`;
        message += `   ID: ${v.displayId}\n\n`;
      });

      message += totalStock > 10
        ? `\n...dan ${totalStock - 10} unit lainnya.\n\nLihat full inventory di: https://primamobil.id/dashboard/vehicles`
        : `\n\nLihat full inventory di: https://primamobil.id/dashboard/vehicles`;

      console.log(`[CommandHandler] 📦 Returning stock list with ${totalStock} total units`);
      return {
        success: true,
        message,
        followUp: true,
      };
    } catch (error) {
      console.error(`[CommandHandler] ❌ Error in STOK command:`, error);
      return {
        success: false,
        message: 'Maaf, terjadi kesalahan saat mengambil data stok. Silakan coba lagi.',
        followUp: true,
      };
    }
  }

  // Status check
  if (cmd.includes('status')) {
    const totalVehicles = await prisma.vehicle.count({
      where: { tenantId },
    });

    const available = await prisma.vehicle.count({
      where: { tenantId, status: 'AVAILABLE' },
    });

    const sold = await prisma.vehicle.count({
      where: { tenantId, status: 'SOLD' },
    });

    const booked = await prisma.vehicle.count({
      where: { tenantId, status: 'BOOKED' },
    });

    return {
      success: true,
      message: `📊 STATUS SHOWROOM\n\nTotal Kendaraan: ${totalVehicles} unit\n✅ Tersedia: ${available} unit\n🔒 Terbook: ${booked} unit\n✅ Terjual: ${sold} unit\n\nLihat detail di: https://primamobil.id/dashboard`,
      followUp: true,
    };
  }

  // Statistics check
  if (cmd.includes('statistik') || cmd.includes('stats') || cmd.includes('laporan')) {
    // For sales: show their own performance
    // For admin+: show overall stats
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const soldVehicles = await prisma.vehicle.findMany({
      where: {
        tenantId,
        status: 'SOLD',
        updatedAt: { gte: monthStart },
      },
      select: {
        price: true,
        createdBy: true,
      },
    });

    const totalSales = soldVehicles.length;
    const totalRevenue = soldVehicles.reduce((sum, v) => sum + Number(v.price), 0);

    // User's own performance (if they're sales staff)
    let ownStats = '';
    if (context.userRoleLevel < ROLE_LEVELS.ADMIN) {
      const ownSales = soldVehicles.filter(v => v.createdBy === context.userId).length;
      ownStats = `\n📊 Performa Anda:\n   Unit terjual: ${ownSales}\n   Kontribusi: ${totalSales > 0 ? ((ownSales / totalSales) * 100).toFixed(1) : 0}%`;
    }

    return {
      success: true,
      message: `📈 STATISTIK BULAN INI (${formatDate(monthStart)} - ${formatDate(now)})\n\n✅ Total Penjualan: ${totalSales} unit\n💰 Total Revenue: ${formatCurrency(totalRevenue)}${ownStats}\n\nLihat detail analytics di: https://primamobil.id/dashboard/whatsapp-ai/analytics`,
      followUp: true,
    };
  }

  // Send contact command
  if (cmd.includes('kontak') || cmd.includes('contact')) {
    return await handleContactCommand(cmd, context);
  }

  return {
    success: false,
    message: 'Command tidak dikenali.',
    followUp: true,
  };
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
      select: { name: true },
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

  // Generate vCard
  const vCardBuffer = generateVCardBuffer({
    firstName: user.firstName,
    lastName: user.lastName || '',
    phone: user.phone,
    role: user.role,
    organization: 'Prima Mobil',
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
 * Handle PDF report commands (ADMIN+ only)
 */
async function handlePDFCommand(
  cmd: string,
  context: CommandContext
): Promise<CommandResult> {
  // Map command to PDF generator function with multiple keyword aliases
  const pdfGenerators: Record<string, (ctx: CommandContext) => Promise<CommandResult>> = {
    // Sales & Revenue
    'sales report': generateSalesReportPDF,
    'whatsapp ai': generateWhatsAppAIPDF,
    'metrix penjualan': generateSalesMetricsPDF,
    'metrics penjualan': generateSalesMetricsPDF,
    'metrix pelanggan': generateCustomerMetricsPDF,
    'metrics pelanggan': generateCustomerMetricsPDF,
    'customer metrics': generateCustomerMetricsPDF, // Added alias
    'customer metric': generateCustomerMetricsPDF,
    'metrix operational': generateOperationalMetricsPDF,
    'metrics operational': generateOperationalMetricsPDF,
    'operational metrics': generateOperationalMetricsPDF,
    'operational metric': generateOperationalMetricsPDF,
    'tren penjualan': generateSalesTrendsPDF,
    'trends penjualan': generateSalesTrendsPDF,
    'sales trends': generateSalesTrendsPDF, // Added alias
    'sales trend': generateSalesTrendsPDF,
    'penjualan trends': generateSalesTrendsPDF,

    // Staff
    'staff performance': generateStaffPerformancePDF,
    'recent sales': generateRecentSalesPDF,

    // Inventory
    'low stock alert': generateLowStockPDF,
    'low stock': generateLowStockPDF,
    'total inventory': generateTotalInventoryPDF, // Added alias
    'total stok': generateTotalInventoryPDF,
    'stok total': generateTotalInventoryPDF,
    'average price': generateAveragePricePDF,
    'avg price': generateAveragePricePDF,
    'rata-rata harga': generateAveragePricePDF,

    // Sales & Revenue
    'total penjualan showroom': generateTotalSalesPDF,
    'total penjualan': generateTotalSalesPDF, // Added alias
    'total sales': generateTotalSalesPDF, // Added alias
    'sales total': generateTotalSalesPDF,
    'total revenue': generateTotalRevenuePDF,
    'revenue total': generateTotalRevenuePDF,
    'sales summary': generateSalesSummaryPDF,
    'penjualan': generateSalesSummaryPDF,
    'sales': generateSalesSummaryPDF,
  };

  // Find matching generator
  for (const [keyword, generator] of Object.entries(pdfGenerators)) {
    if (cmd.includes(keyword)) {
      return await generator(context);
    }
  }

  // Generic 'report' or 'pdf' without specific type - send list of available reports
  if (cmd.includes('report') || cmd.includes('pdf')) {
    return {
      success: true,
      message: `📊 *PDF Report Tersedia*

Silakan pilih report yang diinginkan:

📈 *Sales & Revenue:*
• Sales Report
• Total Penjualan
• Total Revenue
• Sales Summary
• Metrik Penjualan
• Tren Penjualan

📦 *Inventory:*
• Low Stock Alert
• Total Inventory
• Average Price

👥 *Staff & Customers:*
• Staff Performance
• Recent Sales
• Metrik Pelanggan

🤖 *WhatsApp AI:*
• WhatsApp AI Analytics
• Metrik Operational

Ketik nama report untuk mendapatkan PDF. Contoh: "sales report", "low stock alert", "sales summary"`,
      followUp: true,
    };
  }

  return {
    success: false,
    message: 'Report tidak ditemukan. Ketik "report" atau "pdf" untuk melihat daftar report yang tersedia.',
    followUp: true,
  };
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

  const totalValue = available.reduce((sum, v) => sum + Number(v.price), 0);
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

async function generateSalesReportPDF(context: CommandContext): Promise<CommandResult> {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    // Use built-in fonts to avoid font file loading issues in standalone build
    font: 'Helvetica',
    bufferPages: true,
  });
  const chunks: Uint8Array[] = [];

  doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));

  const tenant = await prisma.tenant.findUnique({
    where: { id: context.tenantId },
    select: { name: true },
  });

  const salesData = await fetchSalesData(context, 30);
  const staffData = await fetchStaffPerformance(context, 30);

  // Cover
  doc.fontSize(24).font('Helvetica-Bold').text('Sales Report', { align: 'center' });
  doc.moveDown();
  doc.fontSize(16).font('Helvetica').text(tenant?.name || 'Prima Mobil', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Periode: 30 Hari Terakhir`, { align: 'center' });
  doc.moveDown();
  doc.fontSize(10).fillColor('#666666').text(`Dibuat pada: ${formatDate(new Date())}`, { align: 'center' });

  // Page 1: Summary
  doc.addPage();
  doc.fontSize(18).font('Helvetica-Bold').fillColor('#000000').text('Ringkasan Penjualan', { underline: true });
  doc.moveDown();

  doc.fontSize(12).font('Helvetica');
  doc.text(`Total Penjualan: ${salesData.summary.totalSalesCount} unit`);
  doc.text(`Total Nilai: ${formatCurrency(salesData.summary.totalSalesValue)}`);
  doc.text(`Rata-rata per Unit: ${formatCurrency(salesData.avgPrice)}`);

  doc.moveDown();
  doc.fontSize(14).font('Helvetica-Bold').text('Penjualan per Merek:');
  doc.moveDown(0.5);

  salesData.byMake.forEach((item) => {
    doc.fontSize(11).font('Helvetica');
    doc.text(`${item.make}: ${item.count} unit (${formatCurrency(item.value)})`);
  });

  // Page 2: Staff Performance
  doc.addPage();
  doc.fontSize(18).font('Helvetica-Bold').text('Performa Sales Staff', { underline: true });
  doc.moveDown();

  if (staffData.topPerformers.length > 0) {
    staffData.topPerformers.slice(0, 15).forEach((staff, idx) => {
      doc.fontSize(11).font('Helvetica-Bold').text(`${idx + 1}. ${staff.name}`);
      doc.fontSize(10).font('Helvetica').text(`   ${staff.count} unit terjual - ${formatCurrency(staff.value)}`);
      doc.moveDown(0.3);
    });
  } else {
    doc.text('Tidak ada data penjualan staff.');
  }

  doc.end();

  await new Promise<void>((resolve) => {
    doc.on('end', resolve);
  });

  const pdfBuffer = Buffer.concat(chunks);
  return {
    success: true,
    message: '✅ Sales Report berhasil dibuat. Mengirim PDF...',
    pdfBuffer,
    filename: `sales-report-${new Date().toISOString().split('T')[0]}.pdf`,
    followUp: true,
  };
}

async function generateWhatsAppAIPDF(context: CommandContext): Promise<CommandResult> {
  const doc = createPDFDocument();
  const chunks: Uint8Array[] = [];

  doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));

  const tenant = await prisma.tenant.findUnique({
    where: { id: context.tenantId },
    select: { name: true },
  });

  const whatsappData = await fetchWhatsAppAIData(context, 30);

  // Cover
  doc.fontSize(24).font('Helvetica-Bold').text('WhatsApp AI Analytics', { align: 'center' });
  doc.moveDown();
  doc.fontSize(16).font('Helvetica').text(tenant?.name || 'Prima Mobil', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Periode: 30 Hari Terakhir`, { align: 'center' });
  doc.moveDown();
  doc.fontSize(10).fillColor('#666666').text(`Dibuat pada: ${formatDate(new Date())}`, { align: 'center' });

  if (whatsappData) {
    // Overview
    doc.addPage();
    doc.fontSize(18).font('Helvetica-Bold').fillColor('#000000').text('Overview', { underline: true });
    doc.moveDown();

    doc.fontSize(12).font('Helvetica');
    doc.text(`Total Percakapan: ${whatsappData.overview.totalConversations}`);
    doc.text(`Percakapan Aktif: ${whatsappData.overview.activeConversations}`);
    doc.text(`Pesan Pelanggan: ${whatsappData.overview.customerMessages}`);
    doc.text(`Respon AI: ${whatsappData.overview.aiResponses}`);
    doc.text(`Respon Staff: ${whatsappData.overview.staffResponses}`);
    doc.moveDown();

    doc.fontSize(14).font('Helvetica-Bold').text('Metrik Performa');
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica');
    doc.text(`AI Response Rate: ${whatsappData.overview.aiResponseRate}%`);
    doc.text(`AI Accuracy: ${whatsappData.overview.aiAccuracy}%`);
    doc.text(`Escalated Conversations: ${whatsappData.overview.escalatedConversations}`);

    // Intent Breakdown
    doc.addPage();
    doc.fontSize(18).font('Helvetica-Bold').text('Breakdown Intent Pelanggan', { underline: true });
    doc.moveDown();

    whatsappData.intentBreakdown.forEach((item) => {
      doc.fontSize(12).font('Helvetica');
      doc.text(`${item.intent.charAt(0).toUpperCase() + item.intent.slice(1)}: ${item.count} (${item.percentage}%)`);
    });
  } else {
    doc.addPage();
    doc.fontSize(12).font('Helvetica').text('Data WhatsApp AI tidak tersedia.');
  }

  doc.end();

  await new Promise<void>((resolve) => {
    doc.on('end', resolve);
  });

  const pdfBuffer = Buffer.concat(chunks);
  return {
    success: true,
    message: '✅ WhatsApp AI Analytics berhasil dibuat. Mengirim PDF...',
    pdfBuffer,
    filename: `whatsapp-ai-analytics-${new Date().toISOString().split('T')[0]}.pdf`,
    followUp: true,
  };
}

async function generateSalesMetricsPDF(context: CommandContext): Promise<CommandResult> {
  const doc = createPDFDocument();
  const chunks: Uint8Array[] = [];

  doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));

  const tenant = await prisma.tenant.findUnique({
    where: { id: context.tenantId },
    select: { name: true },
  });

  const salesData = await fetchSalesData(context, 30);
  const inventoryData = await fetchInventoryData(context);

  // Cover
  doc.fontSize(24).font('Helvetica-Bold').text('Metrik Penjualan', { align: 'center' });
  doc.moveDown();
  doc.fontSize(16).font('Helvetica').text(tenant?.name || 'Prima Mobil', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Periode: 30 Hari Terakhir`, { align: 'center' });
  doc.moveDown();
  doc.fontSize(10).fillColor('#666666').text(`Dibuat pada: ${formatDate(new Date())}`, { align: 'center' });

  // Metrics
  doc.addPage();
  doc.fontSize(18).font('Helvetica-Bold').fillColor('#000000').text('KPI Penjualan', { underline: true });
  doc.moveDown();

  doc.fontSize(12).font('Helvetica');
  doc.text(`Total Penjualan: ${salesData.summary.totalSalesCount} unit`);
  doc.text(`Total Revenue: ${formatCurrency(salesData.summary.totalSalesValue)}`);
  doc.text(`Average Price: ${formatCurrency(salesData.avgPrice)}`);
  doc.moveDown();

  doc.fontSize(14).font('Helvetica-Bold').text('Inventory Metrics');
  doc.moveDown(0.5);
  doc.fontSize(12).font('Helvetica');
  doc.text(`Total Stok: ${inventoryData.totalStock} unit`);
  doc.text(`Total Value Stok: ${formatCurrency(inventoryData.totalValue)}`);
  doc.text(`Rata-rata Hari di Stok: ${inventoryData.avgDaysInStock} hari`);

  doc.end();

  await new Promise<void>((resolve) => {
    doc.on('end', resolve);
  });

  const pdfBuffer = Buffer.concat(chunks);
  return {
    success: true,
    message: '✅ Metrik Penjualan berhasil dibuat. Mengirim PDF...',
    pdfBuffer,
    filename: `metrik-penjualan-${new Date().toISOString().split('T')[0]}.pdf`,
    followUp: true,
  };
}

async function generateCustomerMetricsPDF(context: CommandContext): Promise<CommandResult> {
  const doc = createPDFDocument();
  const chunks: Uint8Array[] = [];

  doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));

  const tenant = await prisma.tenant.findUnique({
    where: { id: context.tenantId },
    select: { name: true },
  });

  const whatsappData = await fetchWhatsAppAIData(context, 30);

  // Cover
  doc.fontSize(24).font('Helvetica-Bold').text('Metrik Pelanggan', { align: 'center' });
  doc.moveDown();
  doc.fontSize(16).font('Helvetica').text(tenant?.name || 'Prima Mobil', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Periode: 30 Hari Terakhir`, { align: 'center' });
  doc.moveDown();
  doc.fontSize(10).fillColor('#666666').text(`Dibuat pada: ${formatDate(new Date())}`, { align: 'center' });

  if (whatsappData) {
    doc.addPage();
    doc.fontSize(18).font('Helvetica-Bold').fillColor('#000000').text('Customer Engagement', { underline: true });
    doc.moveDown();

    doc.fontSize(12).font('Helvetica');
    doc.text(`Total Percakapan: ${whatsappData.overview.totalConversations}`);
    doc.text(`Percakapan Aktif: ${whatsappData.overview.activeConversations}`);
    doc.text(`Total Pesan Pelanggan: ${whatsappData.overview.customerMessages}`);
    doc.moveDown();

    doc.fontSize(14).font('Helvetica-Bold').text('Customer Intent Breakdown');
    doc.moveDown(0.5);

    whatsappData.intentBreakdown.forEach((item) => {
      doc.fontSize(12).font('Helvetica');
      doc.text(`${item.intent.charAt(0).toUpperCase() + item.intent.slice(1)}: ${item.count} (${item.percentage}%)`);
    });
  } else {
    doc.addPage();
    doc.fontSize(12).font('Helvetica').text('Data pelanggan tidak tersedia.');
  }

  doc.end();

  await new Promise<void>((resolve) => {
    doc.on('end', resolve);
  });

  const pdfBuffer = Buffer.concat(chunks);
  return {
    success: true,
    message: '✅ Metrik Pelanggan berhasil dibuat. Mengirim PDF...',
    pdfBuffer,
    filename: `metrik-pelanggan-${new Date().toISOString().split('T')[0]}.pdf`,
    followUp: true,
  };
}

async function generateOperationalMetricsPDF(context: CommandContext): Promise<CommandResult> {
  const doc = createPDFDocument();
  const chunks: Uint8Array[] = [];

  doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));

  const tenant = await prisma.tenant.findUnique({
    where: { id: context.tenantId },
    select: { name: true },
  });

  const salesData = await fetchSalesData(context, 30);
  const inventoryData = await fetchInventoryData(context);
  const staffData = await fetchStaffPerformance(context, 30);

  // Cover
  doc.fontSize(24).font('Helvetica-Bold').text('Metrik Operational', { align: 'center' });
  doc.moveDown();
  doc.fontSize(16).font('Helvetica').text(tenant?.name || 'Prima Mobil', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Periode: 30 Hari Terakhir`, { align: 'center' });
  doc.moveDown();
  doc.fontSize(10).fillColor('#666666').text(`Dibuat pada: ${formatDate(new Date())}`, { align: 'center' });

  // Metrics
  doc.addPage();
  doc.fontSize(18).font('Helvetica-Bold').fillColor('#000000').text('KPI Operational', { underline: true });
  doc.moveDown();

  doc.fontSize(12).font('Helvetica');
  doc.text(`Total Stok: ${inventoryData.totalStock} unit`);
  doc.text(`Stok Value: ${formatCurrency(inventoryData.totalValue)}`);
  doc.text(`Avg Hari di Stok: ${inventoryData.avgDaysInStock} hari`);
  doc.moveDown();

  doc.text(`Total Staff: ${staffData.totalStaff}`);
  doc.text(`Staff Aktif (Ada Penjualan): ${staffData.topPerformers.length}`);
  doc.moveDown();

  doc.text(`Unit Terjual: ${salesData.summary.totalSalesCount}`);
  doc.text(`Revenue: ${formatCurrency(salesData.summary.totalSalesValue)}`);

  doc.end();

  await new Promise<void>((resolve) => {
    doc.on('end', resolve);
  });

  const pdfBuffer = Buffer.concat(chunks);
  return {
    success: true,
    message: '✅ Metrik Operational berhasil dibuat. Mengirim PDF...',
    pdfBuffer,
    filename: `metrik-operational-${new Date().toISOString().split('T')[0]}.pdf`,
    followUp: true,
  };
}

async function generateSalesTrendsPDF(context: CommandContext): Promise<CommandResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: context.tenantId },
    select: { name: true },
  });

  const salesData = await fetchSalesData(context, 30);

  // Calculate trends
  const totalSales = salesData.summary.totalSalesCount;
  const totalRevenue = salesData.summary.totalSalesValue;
  const avgDailySales = salesData.salesByDay.length > 0
    ? totalSales / salesData.salesByDay.length
    : 0;

  // Use NEW professional WhatsApp Command PDF
  const generator = new WhatsAppCommandPDF();

  const metrics = [
    {
      label: 'Total Penjualan (30 Hari)',
      value: `${totalSales}`,
      unit: 'Unit',
      color: '#3b82f6',
      formula: 'SUM(sales) WHERE date >= NOW() - 30 DAYS',
      calculation: `${totalSales} unit terjual dalam 30 hari`,
    },
    {
      label: 'Rata-rata Harian',
      value: `${avgDailySales.toFixed(1)}`,
      unit: 'Unit/Hari',
      color: '#10b981',
      formula: 'AVG(daily sales)',
      calculation: `${totalSales} unit / ${salesData.salesByDay.length} hari = ${avgDailySales.toFixed(1)} unit/hari`,
    },
    {
      label: 'Total Revenue',
      value: formatCurrency(totalRevenue),
      color: '#f59e0b',
      formula: 'SUM(price) WHERE date >= NOW() - 30 DAYS',
      calculation: formatCurrency(totalRevenue),
    },
  ];

  const reportData = {
    title: 'Tren Penjualan Showroom',
    subtitle: 'Analisis Tren 30 Hari Terakhir',
    tenantName: tenant?.name || 'Prima Mobil',
    date: new Date(),
    metrics,
    showChart: true,
    chartData: salesData.byMake.slice(0, 5).map((item, idx) => ({
      label: item.make,
      value: item.count,
      color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][idx % 5],
    })),
  };

  const pdfBuffer = await generator.generate(reportData);

  return {
    success: true,
    message: '✅ Tren Penjualan (2 halaman profesional) berhasil dibuat. Mengirim PDF...',
    pdfBuffer,
    filename: `tren-penjualan-${new Date().toISOString().split('T')[0]}.pdf`,
    followUp: true,
  };
}

async function generateStaffPerformancePDF(context: CommandContext): Promise<CommandResult> {
  const doc = createPDFDocument();
  const chunks: Uint8Array[] = [];

  doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));

  const tenant = await prisma.tenant.findUnique({
    where: { id: context.tenantId },
    select: { name: true },
  });

  const staffData = await fetchStaffPerformance(context, 30);

  // Cover
  doc.fontSize(24).font('Helvetica-Bold').text('Staff Performance', { align: 'center' });
  doc.moveDown();
  doc.fontSize(16).font('Helvetica').text(tenant?.name || 'Prima Mobil', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Periode: 30 Hari Terakhir`, { align: 'center' });
  doc.moveDown();
  doc.fontSize(10).fillColor('#666666').text(`Dibuat pada: ${formatDate(new Date())}`, { align: 'center' });

  // Staff List
  doc.addPage();
  doc.fontSize(18).font('Helvetica-Bold').fillColor('#000000').text('Performa Sales Staff', { underline: true });
  doc.moveDown();

  if (staffData.topPerformers.length > 0) {
    staffData.topPerformers.forEach((staff, idx) => {
      doc.fontSize(12).font('Helvetica-Bold').text(`${idx + 1}. ${staff.name}`);
      doc.fontSize(11).font('Helvetica').text(`   Unit Terjual: ${staff.count}`);
      doc.text(`   Total Nilai: ${formatCurrency(staff.value)}`);
      if (staff.count > 0) {
        doc.text(`   Rata-rata: ${formatCurrency(staff.value / staff.count)}`);
      }
      doc.moveDown(0.5);
    });
  } else {
    doc.fontSize(12).font('Helvetica').text('Tidak ada data penjualan staff dalam periode ini.');
  }

  doc.end();

  await new Promise<void>((resolve) => {
    doc.on('end', resolve);
  });

  const pdfBuffer = Buffer.concat(chunks);
  return {
    success: true,
    message: '✅ Staff Performance berhasil dibuat. Mengirim PDF...',
    pdfBuffer,
    filename: `staff-performance-${new Date().toISOString().split('T')[0]}.pdf`,
    followUp: true,
  };
}

async function generateRecentSalesPDF(context: CommandContext): Promise<CommandResult> {
  const doc = createPDFDocument();
  const chunks: Uint8Array[] = [];

  doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));

  const tenant = await prisma.tenant.findUnique({
    where: { id: context.tenantId },
    select: { name: true },
  });

  const salesData = await fetchSalesData(context, 7);

  // Cover
  doc.fontSize(24).font('Helvetica-Bold').text('Recent Sales', { align: 'center' });
  doc.moveDown();
  doc.fontSize(16).font('Helvetica').text(tenant?.name || 'Prima Mobil', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Periode: 7 Hari Terakhir`, { align: 'center' });
  doc.moveDown();
  doc.fontSize(10).fillColor('#666666').text(`Dibuat pada: ${formatDate(new Date())}`, { align: 'center' });

  // Recent Sales List
  doc.addPage();
  doc.fontSize(18).font('Helvetica-Bold').fillColor('#000000').text('Penjualan Terbaru', { underline: true });
  doc.moveDown();

  if (salesData.vehicles.length > 0) {
    salesData.vehicles.forEach((v, idx) => {
      doc.fontSize(11).font('Helvetica');
      doc.text(`${idx + 1}. ${v.make} ${v.model} (${v.year})`);
      doc.text(`   Harga: ${formatCurrency(v.price)}`);
      doc.text(`   Tanggal: ${formatDate(new Date(v.updatedAt))}`);
      doc.moveDown(0.3);
    });
  } else {
    doc.fontSize(12).font('Helvetica').text('Tidak ada penjualan dalam 7 hari terakhir.');
  }

  doc.end();

  await new Promise<void>((resolve) => {
    doc.on('end', resolve);
  });

  const pdfBuffer = Buffer.concat(chunks);
  return {
    success: true,
    message: '✅ Recent Sales berhasil dibuat. Mengirim PDF...',
    pdfBuffer,
    filename: `recent-sales-${new Date().toISOString().split('T')[0]}.pdf`,
    followUp: true,
  };
}

async function generateLowStockPDF(context: CommandContext): Promise<CommandResult> {
  const doc = createPDFDocument();
  const chunks: Uint8Array[] = [];

  doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));

  const tenant = await prisma.tenant.findUnique({
    where: { id: context.tenantId },
    select: { name: true },
  });

  const inventoryData = await fetchInventoryData(context);

  // Cover
  doc.fontSize(24).font('Helvetica-Bold').text('Low Stock Alert', { align: 'center' });
  doc.moveDown();
  doc.fontSize(16).font('Helvetica').text(tenant?.name || 'Prima Mobil', { align: 'center' });
  doc.moveDown();
  doc.fontSize(10).fillColor('#666666').text(`Dibuat pada: ${formatDate(new Date())}`, { align: 'center' });

  // Alert
  doc.addPage();
  doc.fontSize(18).font('Helvetica-Bold').fillColor('#000000').text('Status Inventory', { underline: true });
  doc.moveDown();

  doc.fontSize(12).font('Helvetica');
  doc.text(`Total Stok Saat Ini: ${inventoryData.totalStock} unit`);
  doc.text(`Total Value: ${formatCurrency(inventoryData.totalValue)}`);
  doc.moveDown();

  const isLowStock = inventoryData.totalStock < 10;
  if (isLowStock) {
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#FF0000').text('⚠️ LOW STOCK ALERT');
    doc.fontSize(12).font('Helvetica').fillColor('#000000');
    doc.moveDown();
    doc.text('Stok kendaraan di bawah 10 unit. Pertimbangkan untuk menambah stok.');
  } else if (inventoryData.totalStock < 20) {
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#FFA500').text('⚠️ Stok Menipis');
    doc.fontSize(12).font('Helvetica').fillColor('#000000');
    doc.moveDown();
    doc.text('Stok kendaraan mendekati batas minimum. Monitor dan rencanakan restock.');
  } else {
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#008000').text('✅ Stok Aman');
    doc.fontSize(12).font('Helvetica').fillColor('#000000');
    doc.moveDown();
    doc.text('Stok kendaraan dalam kondisi aman.');
  }

  doc.end();

  await new Promise<void>((resolve) => {
    doc.on('end', resolve);
  });

  const pdfBuffer = Buffer.concat(chunks);
  return {
    success: true,
    message: '✅ Low Stock Alert berhasil dibuat. Mengirim PDF...',
    pdfBuffer,
    filename: `low-stock-alert-${new Date().toISOString().split('T')[0]}.pdf`,
    followUp: true,
  };
}

async function generateTotalSalesPDF(context: CommandContext): Promise<CommandResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: context.tenantId },
    select: { name: true },
  });

  const salesData = await fetchSalesData(context, 30);
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 30);

  // Use NEW professional WhatsApp Command PDF
  const generator = new WhatsAppCommandPDF();

  const metrics = [
    {
      label: 'Total Penjualan',
      value: `${salesData.summary.totalSalesCount}`,
      unit: 'Unit',
      color: '#3b82f6',
      formula: 'COUNT(vehicle WHERE status = SOLD)',
      calculation: `${salesData.summary.totalSalesCount} unit terjual`,
    },
    {
      label: 'Total Revenue',
      value: formatCurrency(salesData.summary.totalSalesValue),
      color: '#10b981',
      formula: 'SUM(price) WHERE status = SOLD',
      calculation: formatCurrency(salesData.summary.totalSalesValue),
    },
    {
      label: 'Rata-rata Harga',
      value: formatCurrency(salesData.avgPrice),
      color: '#f59e0b',
      formula: 'AVG(price) WHERE status = SOLD',
      calculation: `${formatCurrency(salesData.summary.totalSalesValue)} / ${salesData.summary.totalSalesCount} = ${formatCurrency(salesData.avgPrice)}`,
    },
  ];

  const reportData = {
    title: 'Total Penjualan Showroom',
    subtitle: `Periode: 30 Hari Terakhir`,
    tenantName: tenant?.name || 'Prima Mobil',
    date: new Date(),
    metrics,
    showChart: true,
    chartData: salesData.byMake.slice(0, 5).map((item, idx) => ({
      label: item.make,
      value: item.count,
      color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][idx % 5],
    })),
  };

  const pdfBuffer = await generator.generate(reportData);

  return {
    success: true,
    message: '✅ Total Penjualan (2 halaman profesional) berhasil dibuat. Mengirim PDF...',
    pdfBuffer,
    filename: `total-penjualan-${new Date().toISOString().split('T')[0]}.pdf`,
    followUp: true,
  };
}

async function generateTotalRevenuePDF(context: CommandContext): Promise<CommandResult> {
  const doc = createPDFDocument();
  const chunks: Uint8Array[] = [];

  doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));

  const tenant = await prisma.tenant.findUnique({
    where: { id: context.tenantId },
    select: { name: true },
  });

  const salesData = await fetchSalesData(context, 30);

  // Cover
  doc.fontSize(24).font('Helvetica-Bold').text('Total Revenue', { align: 'center' });
  doc.moveDown();
  doc.fontSize(16).font('Helvetica').text(tenant?.name || 'Prima Mobil', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Periode: 30 Hari Terakhir`, { align: 'center' });
  doc.moveDown();
  doc.fontSize(10).fillColor('#666666').text(`Dibuat pada: ${formatDate(new Date())}`, { align: 'center' });

  // Revenue
  doc.addPage();
  doc.fontSize(18).font('Helvetica-Bold').fillColor('#000000').text('Revenue Report', { underline: true });
  doc.moveDown();

  doc.fontSize(32).font('Helvetica-Bold').text(formatCurrency(salesData.summary.totalSalesValue), { align: 'center' });
  doc.moveDown();

  doc.fontSize(14).font('Helvetica').text(`Dari ${salesData.summary.totalSalesCount} unit terjual`, { align: 'center' });
  doc.moveDown();

  doc.fontSize(12).font('Helvetica').text(`Rata-rata: ${formatCurrency(salesData.avgPrice)} per unit`, { align: 'center' });

  doc.end();

  await new Promise<void>((resolve) => {
    doc.on('end', resolve);
  });

  const pdfBuffer = Buffer.concat(chunks);
  return {
    success: true,
    message: '✅ Total Revenue berhasil dibuat. Mengirim PDF...',
    pdfBuffer,
    filename: `total-revenue-${new Date().toISOString().split('T')[0]}.pdf`,
    followUp: true,
  };
}

async function generateTotalInventoryPDF(context: CommandContext): Promise<CommandResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: context.tenantId },
    select: { name: true },
  });

  const inventoryData = await fetchInventoryData(context);

  // Use NEW professional WhatsApp Command PDF
  const generator = new WhatsAppCommandPDF();

  const metrics = [
    {
      label: 'Total Stok',
      value: `${inventoryData.totalStock}`,
      unit: 'Unit',
      color: '#3b82f6',
      formula: 'COUNT(vehicle) WHERE status IN (AVAILABLE, BOOKED)',
      calculation: `${inventoryData.totalStock} unit tersedia`,
    },
    {
      label: 'Total Nilai Stok',
      value: formatCurrency(inventoryData.totalValue),
      color: '#10b981',
      formula: 'SUM(price) WHERE status IN (AVAILABLE, BOOKED)',
      calculation: formatCurrency(inventoryData.totalValue),
    },
    {
      label: 'Rata-rata Hari di Stok',
      value: `${inventoryData.avgDaysInStock}`,
      unit: 'Hari',
      color: '#f59e0b',
      formula: 'AVG(days since added) WHERE status IN (AVAILABLE, BOOKED)',
      calculation: `Rata-rata ${inventoryData.avgDaysInStock} hari`,
    },
  ];

  const reportData = {
    title: 'Total Inventory Showroom',
    subtitle: 'Stok Kendaraan Tersedia',
    tenantName: tenant?.name || 'Prima Mobil',
    date: new Date(),
    metrics,
  };

  const pdfBuffer = await generator.generate(reportData);

  return {
    success: true,
    message: '✅ Total Inventory (2 halaman profesional) berhasil dibuat. Mengirim PDF...',
    pdfBuffer,
    filename: `total-inventory-${new Date().toISOString().split('T')[0]}.pdf`,
    followUp: true,
  };
}

async function generateAveragePricePDF(context: CommandContext): Promise<CommandResult> {
  const doc = createPDFDocument();
  const chunks: Uint8Array[] = [];

  doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));

  const tenant = await prisma.tenant.findUnique({
    where: { id: context.tenantId },
    select: { name: true },
  });

  const salesData = await fetchSalesData(context, 30);
  const inventoryData = await fetchInventoryData(context);

  // Cover
  doc.fontSize(24).font('Helvetica-Bold').text('Average Price', { align: 'center' });
  doc.moveDown();
  doc.fontSize(16).font('Helvetica').text(tenant?.name || 'Prima Mobil', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Periode: 30 Hari Terakhir`, { align: 'center' });
  doc.moveDown();
  doc.fontSize(10).fillColor('#666666').text(`Dibuat pada: ${formatDate(new Date())}`, { align: 'center' });

  // Average Price
  doc.addPage();
  doc.fontSize(18).font('Helvetica-Bold').fillColor('#000000').text('Average Price Report', { underline: true });
  doc.moveDown();

  doc.fontSize(14).font('Helvetica-Bold').text('Rata-rata Harga Penjualan');
  doc.fontSize(28).font('Helvetica-Bold').fillColor('#008000').text(formatCurrency(salesData.avgPrice), { align: 'center' });
  doc.fillColor('#000000');
  doc.moveDown();

  doc.fontSize(14).font('Helvetica-Bold').text('Rata-rata Harga Stok');
  const avgStockPrice = inventoryData.totalStock > 0 ? inventoryData.totalValue / inventoryData.totalStock : 0;
  doc.fontSize(28).font('Helvetica-Bold').fillColor('#0066CC').text(formatCurrency(avgStockPrice), { align: 'center' });
  doc.fillColor('#000000');
  doc.moveDown();

  doc.fontSize(12).font('Helvetica').text(`Berdasarkan ${salesData.summary.totalSalesCount} unit terjual`, { align: 'center' });
  doc.text(`Dari ${inventoryData.totalStock} unit stok tersedia`, { align: 'center' });

  doc.end();

  await new Promise<void>((resolve) => {
    doc.on('end', resolve);
  });

  const pdfBuffer = Buffer.concat(chunks);
  return {
    success: true,
    message: '✅ Average Price berhasil dibuat. Mengirim PDF...',
    pdfBuffer,
    filename: `average-price-${new Date().toISOString().split('T')[0]}.pdf`,
    followUp: true,
  };
}

async function generateSalesSummaryPDF(context: CommandContext): Promise<CommandResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: context.tenantId },
    select: { name: true },
  });

  const salesDataRaw = await fetchSalesData(context, 30);
  const inventoryData = await fetchInventoryData(context);
  const staffData = await fetchStaffPerformance(context, 30);

  // Calculate KPIs
  const totalSalesCount = salesDataRaw.summary.totalSalesCount;
  const totalSalesValue = salesDataRaw.summary.totalSalesValue;
  const totalVehicles = inventoryData.totalStock;
  const employees = staffData.totalStaff;

  const inventoryTurnover = totalSalesCount / (totalSalesCount + totalVehicles) * 100;
  const avgPrice = totalSalesCount > 0 ? totalSalesValue / totalSalesCount : 0;
  const industryAvgPrice = 150000000;
  const atv = Math.min((avgPrice / industryAvgPrice) * 100, 100);
  const salesPerEmployee = employees > 0
    ? Math.min((totalSalesCount / (employees * 2)) * 100, 100)
    : 0;

  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 30);

  // Use COMPACT 2-page Executive PDF Generator
  const generator = new CompactExecutivePDF();

  const reportData = {
    tenantName: tenant?.name || 'Prima Mobil',
    salesData: {
      summary: {
        totalSalesCount,
        totalSalesValue,
        totalVehicles,
        employees,
      },
      byMake: salesDataRaw.byMake,
      topPerformers: staffData.topPerformers,
      kpis: {
        inventoryTurnover: Math.round(inventoryTurnover),
        atv: Math.round(atv),
        salesPerEmployee: Math.round(salesPerEmployee),
        avgPrice,
      },
    },
    startDate,
    endDate,
  };

  console.log('[Sales Summary PDF] 📊 Using COMPACT 2-page generator:', {
    tenant: reportData.tenantName,
    hasSalesData: !!reportData.salesData,
    salesCount: reportData.salesData?.summary?.totalSalesCount || 0,
    generator: 'CompactExecutivePDF (2 pages)',
  });

  const pdfBuffer = await generator.generate(reportData);
  const filename = `executive-summary-${new Date().toISOString().split('T')[0]}.pdf`;

  console.log('[Sales Summary PDF] ✅ Compact 2-page PDF generated, size:', pdfBuffer.length, 'bytes');

  return {
    success: true,
    message: '✅ Executive Summary (2 halaman) berhasil dibuat. Mengirim PDF...',
    pdfBuffer,
    filename,
    followUp: true,
  };
}

