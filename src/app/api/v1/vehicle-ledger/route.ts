/**
 * Vehicle Ledger API
 * Returns vehicles with their transaction flow status
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth/middleware';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = authResult.user;
    if (!user.tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 403 });
    }

    const tenantId = user.tenantId;

    // Get query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    // Build where clause
    const where: any = {
      tenantId,
      status: { not: 'DELETED' },
    };

    if (status && status !== 'all') {
      where.status = status;
    }

    // Fetch vehicles with related invoices
    const vehicles = await prisma.vehicle.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Fetch all invoices for this tenant to match with vehicles
    const invoices = await prisma.salesInvoice.findMany({
      where: { tenantId },
      include: {
        payments: true,
      },
    });

    // Create a map of vehicleId to invoice
    const vehicleInvoiceMap = new Map<string, any>();
    invoices.forEach(inv => {
      if (inv.vehicleId) {
        vehicleInvoiceMap.set(inv.vehicleId, inv);
      }
    });

    // Transform vehicles to ledger items
    const ledgerItems = vehicles.map(vehicle => {
      const invoice = vehicleInvoiceMap.get(vehicle.id);
      const isSold = vehicle.status === 'SOLD';
      const isAvailable = vehicle.status === 'AVAILABLE';
      const hasInvoice = !!invoice;
      const isPaid = invoice?.status === 'paid';
      const paidAmount = invoice?.paidAmount || 0;
      const grandTotal = invoice?.grandTotal || 0;

      // Calculate flow stages
      const flow = {
        purchased: {
          done: true, // Always done since vehicle exists
          date: vehicle.createdAt.toISOString(),
        },
        received: {
          done: isAvailable || isSold, // Done if available or sold
          date: vehicle.publishedAt?.toISOString() || (isAvailable ? vehicle.updatedAt.toISOString() : null),
        },
        costs: {
          done: false, // TODO: Implement costs tracking
          amount: 0,
        },
        sold: {
          done: hasInvoice,
          date: invoice?.invoiceDate?.toISOString() || null,
        },
        paid: {
          done: isPaid,
          amount: paidAmount,
          percentage: grandTotal > 0 ? Math.round((paidAmount / grandTotal) * 100) : 0,
        },
      };

      return {
        id: vehicle.id,
        displayId: vehicle.displayId,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        color: vehicle.color,
        licensePlate: vehicle.licensePlate,
        status: vehicle.status,
        price: Number(vehicle.price) / 100, // Convert from cents
        createdAt: vehicle.createdAt.toISOString(),
        publishedAt: vehicle.publishedAt?.toISOString() || null,
        invoice: invoice ? {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          invoiceDate: invoice.invoiceDate.toISOString(),
          grandTotal: Number(invoice.grandTotal),
          paidAmount: Number(invoice.paidAmount),
          status: invoice.status,
        } : null,
        flow,
      };
    });

    // Calculate stats
    const stats = {
      totalVehicles: vehicles.length,
      inStock: vehicles.filter(v => v.status === 'AVAILABLE' || v.status === 'BOOKED').length,
      sold: vehicles.filter(v => v.status === 'SOLD').length,
      totalValue: vehicles
        .filter(v => v.status === 'AVAILABLE' || v.status === 'BOOKED')
        .reduce((sum, v) => sum + Number(v.price) / 100, 0),
      totalProfit: 0, // TODO: Calculate actual profit when purchase price is tracked
    };

    return NextResponse.json({
      success: true,
      data: {
        vehicles: ledgerItems,
        stats,
      },
    });
  } catch (error) {
    console.error('[Vehicle Ledger] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
