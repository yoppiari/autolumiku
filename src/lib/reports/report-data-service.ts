import { prisma } from '@/lib/prisma';
import { ReportType, ReportData } from './comprehensive-report-pdf';

export class ReportDataService {
    /**
     * Gather data from database based on report type
     */
    static async gather(
        reportType: ReportType,
        tenantId: string,
        startDate: Date,
        endDate: Date
    ): Promise<ReportData> {
        const data: ReportData = {};

        const needsAllData = reportType === 'management-insights';

        // Common data needed by most reports
        const needsSalesData = [
            'sales-report',
            'sales-metrics',
            'sales-trends',
            'total-sales',
            'total-revenue',
            'average-price',
            'sales-summary',
            'one-page-sales',
            'inventory-listing',
        ].includes(reportType) || needsAllData;

        const needsInventoryData = [
            'sales-report',
            'sales-metrics',
            'operational-metrics',
            'low-stock-alert',
            'total-inventory',
            'average-price',
            'sales-summary',
            'inventory-listing',
            'one-page-sales',
        ].includes(reportType) || needsAllData;

        const needsStaffData = [
            'sales-report',
            'staff-performance',
            'operational-metrics',
            'sales-summary',
        ].includes(reportType) || needsAllData;

        const needsWhatsAppData = [
            'whatsapp-analytics',
            'customer-metrics',
            'whatsapp-ai',
            'operational-metrics',
        ].includes(reportType) || needsAllData;

        // Variables for KPI calculation
        let inventoryTurnover = 0;
        let salesPerEmployee = 0;

        // Fetch sales data
        if (needsSalesData) {
            const soldVehicles = await prisma.vehicle.findMany({
                where: {
                    tenantId,
                    status: 'SOLD',
                    updatedAt: { gte: startDate, lte: endDate },
                },
                select: {
                    displayId: true,
                    make: true,
                    model: true,
                    year: true,
                    price: true,
                    updatedAt: true,
                    createdBy: true,
                },
                orderBy: { updatedAt: 'desc' },
            });

            data.totalSales = soldVehicles.length;
            data.totalRevenue = soldVehicles.reduce((sum, v) => sum + Number(v.price || 0), 0);
            data.avgPrice = data.totalSales > 0 ? data.totalRevenue / data.totalSales : 0;

            // Sales by brand
            const byBrand: Map<string, { count: number; revenue: number }> = new Map();
            soldVehicles.forEach((v) => {
                const brand = v.make || 'Other';
                const current = byBrand.get(brand) || { count: 0, revenue: 0 };
                byBrand.set(brand, {
                    count: current.count + 1,
                    revenue: current.revenue + Number(v.price || 0),
                });
            });
            data.salesByBrand = Array.from(byBrand.entries())
                .map(([brand, stats]) => ({ brand, ...stats }))
                .sort((a, b) => b.count - a.count);

            // Recent sales detail
            if (reportType === 'sales-report') {
                data.recentSalesDetail = soldVehicles.map((v) => ({
                    displayId: v.displayId || 'N/A',
                    make: v.make,
                    model: v.model,
                    year: v.year,
                    price: Number(v.price || 0),
                    soldDate: v.updatedAt,
                }));
            }

            // Daily sales trends
            if (reportType === 'sales-trends' || reportType === 'sales-report') {
                const dailyMap: Map<string, { count: number; revenue: number }> = new Map();
                soldVehicles.forEach((v) => {
                    const dateKey = v.updatedAt.toISOString().split('T')[0];
                    const current = dailyMap.get(dateKey) || { count: 0, revenue: 0 };
                    dailyMap.set(dateKey, {
                        count: current.count + 1,
                        revenue: current.revenue + Number(v.price),
                    });
                });
                data.dailySales = Array.from(dailyMap.entries())
                    .map(([dateStr, stats]) => ({
                        date: new Date(dateStr),
                        ...stats,
                    }))
                    .sort((a, b) => a.date.getTime() - b.date.getTime());
            }
        }

        // Fetch inventory data
        if (needsInventoryData) {
            const inventory = await prisma.vehicle.findMany({
                where: {
                    tenantId,
                    status: { in: ['AVAILABLE', 'BOOKED'] },
                },
                select: {
                    displayId: true,
                    make: true,
                    model: true,
                    year: true,
                    price: true,
                    createdAt: true,
                },
            });

            data.totalInventory = inventory.length;
            data.avgStockPrice = inventory.length > 0
                ? inventory.reduce((sum, v) => sum + Number(v.price), 0) / inventory.length
                : 0;

            // Detailed inventory list for excel
            data.inventoryDetail = inventory.map(v => ({
                displayId: v.displayId || 'Inventory',
                make: v.make,
                model: v.model,
                year: v.year,
                price: Number(v.price || 0),
                daysInStock: Math.floor((Date.now() - v.createdAt.getTime()) / (24 * 60 * 60 * 1000))
            }));

            // Low stock alerts (vehicles older than 90 days)
            if (reportType === 'low-stock-alert') {
                const now = Date.now();
                const dayMs = 24 * 60 * 60 * 1000;
                data.lowStockVehicles = inventory
                    .map((v) => {
                        const daysInStock = Math.floor((now - v.createdAt.getTime()) / dayMs);
                        return {
                            displayId: v.displayId || 'STOCK',
                            make: v.make,
                            model: v.model,
                            year: v.year,
                            daysInStock,
                            status: (daysInStock > 180 ? 'critical' : daysInStock > 90 ? 'warning' : 'ok') as any,
                        };
                    })
                    .filter((v) => v.status !== 'ok')
                    .sort((a, b) => b.daysInStock - a.daysInStock);
            }

            // Calculation for KPI
            const totalSalesCount = data.totalSales || 0;
            const totalInventory = data.totalInventory || 0;
            inventoryTurnover = (totalSalesCount + totalInventory) > 0
                ? (totalSalesCount / (totalSalesCount + totalInventory)) * 100
                : 0;
        }

        // Fetch staff performance
        if (needsStaffData) {
            const staff = await prisma.user.findMany({
                where: {
                    tenantId,
                    role: { in: ['SALES', 'sales', 'STAFF', 'staff'] },
                },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                },
            });

            // Fetch sold vehicles with detailed info for staff performance
            const soldVehiclesWithInfo = await prisma.vehicle.findMany({
                where: {
                    tenantId,
                    status: 'SOLD',
                    updatedAt: { gte: startDate, lte: endDate },
                },
                select: {
                    displayId: true,
                    make: true,
                    model: true,
                    year: true,
                    price: true,
                    updatedAt: true,
                    createdBy: true,
                },
            });

            const enhancedStaffMap = new Map<string, { count: number; revenue: number; details: any[] }>();
            soldVehiclesWithInfo.forEach((v) => {
                if (v.createdBy) {
                    const current = enhancedStaffMap.get(v.createdBy) || { count: 0, revenue: 0, details: [] };
                    current.count++;
                    current.revenue += Number(v.price || 0);
                    current.details.push({
                        displayId: v.displayId || 'SOLD',
                        vehicle: `${v.make} ${v.model} (${v.year})`,
                        price: Number(v.price || 0),
                        date: v.updatedAt,
                    });
                    enhancedStaffMap.set(v.createdBy, current);
                }
            });

            data.staffPerformance = staff
                .map((s) => {
                    const stats = enhancedStaffMap.get(s.id) || { count: 0, revenue: 0, details: [] };
                    return {
                        name: `${s.firstName} ${s.lastName}`,
                        sales: stats.count,
                        revenue: stats.revenue,
                        performance: (stats.count >= 5 ? 'Excellent' : stats.count >= 3 ? 'Good' : 'Needs Improvement') as any,
                        details: stats.details,
                    };
                })
                .sort((a, b) => b.sales - a.sales);

            // Calculation for KPI
            const totalSalesCount = data.totalSales || 0;
            const employeeCount = staff.length || 1;
            const targetPerMonth = 5;
            salesPerEmployee = Math.min((totalSalesCount / (employeeCount * targetPerMonth)) * 100, 100);
        }

        // Fetch WhatsApp analytics
        if (needsWhatsAppData) {
            try {
                const conversations = await prisma.whatsAppConversation.findMany({
                    where: {
                        tenantId,
                        startedAt: { gte: startDate, lte: endDate },
                        status: { not: 'deleted' },
                    },
                    include: {
                        messages: {
                            select: {
                                direction: true,
                                aiResponse: true,
                                content: true,
                                createdAt: true,
                            },
                            orderBy: { createdAt: 'asc' },
                        },
                    },
                });

                const totalConversations = conversations.length;
                const activeConversations = conversations.filter((c) => c.status === 'active').length;

                const customerMessages = conversations.reduce((sum, c) =>
                    sum + c.messages.filter((m) => m.direction === 'inbound').length, 0
                );

                const aiResponses = conversations.reduce((sum, c) =>
                    sum + c.messages.filter((m) => m.direction === 'outbound' && m.aiResponse).length, 0
                );

                const aiResponseRate = customerMessages > 0
                    ? Math.round((aiResponses / customerMessages) * 100)
                    : 0;

                const escalatedCount = conversations.filter((c) =>
                    c.messages.some((m) => m.direction === 'outbound' && !m.aiResponse)
                ).length;

                const escalationRate = totalConversations > 0
                    ? Math.round((escalatedCount / totalConversations) * 100)
                    : 0;

                // Calculate avg response time
                const responseTimes: number[] = [];
                conversations.forEach((c) => {
                    for (let i = 0; i < c.messages.length - 1; i++) {
                        const current = c.messages[i];
                        const next = c.messages[i + 1];
                        if (current.direction === 'inbound' && next.direction === 'outbound' && next.aiResponse) {
                            const rt = (new Date(next.createdAt).getTime() - new Date(current.createdAt).getTime()) / 1000;
                            if (rt > 0 && rt < 300) responseTimes.push(rt);
                        }
                    }
                });
                const avgResponseTime = responseTimes.length > 0
                    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
                    : 5;

                // Intent breakdown
                const intents = { vehicle: 0, price: 0, greeting: 0, general: 0 };
                conversations.forEach((c) => {
                    const firstMessage = c.messages.find((m) => m.direction === 'inbound');
                    if (firstMessage) {
                        const content = firstMessage.content.toLowerCase();
                        if (content.includes('harga') || content.includes('price') || content.includes('berapa')) {
                            intents.price++;
                        } else if (content.includes('mobil') || content.includes('unit') || content.includes('stok')) {
                            intents.vehicle++;
                        } else if (content.includes('halo') || content.includes('hi') || content.includes('selamat')) {
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

                data.whatsapp = {
                    totalConversations,
                    activeConversations,
                    totalMessages: customerMessages + aiResponses,
                    aiResponseRate,
                    avgResponseTime,
                    escalationRate,
                    intentBreakdown,
                };
            } catch (error) {
                console.warn('[Reports] WhatsApp data not available');
                data.whatsapp = {
                    totalConversations: 0,
                    activeConversations: 0,
                    totalMessages: 0,
                    aiResponseRate: 0,
                    avgResponseTime: 0,
                    escalationRate: 0,
                    intentBreakdown: [],
                };
            }
        }

        // Fetch Lead & Customer Data for specialized reports
        if (reportType === 'customer-metrics' || needsAllData) {
            try {
                const [leads, salesCustomers] = await Promise.all([
                    prisma.lead.count({ where: { tenantId, createdAt: { gte: startDate, lte: endDate } } }),
                    prisma.salesCustomer.count({ where: { tenantId, createdAt: { gte: startDate, lte: endDate } } }),
                ]);
                data.totalLeads = leads;
                data.totalCustomers = salesCustomers;
            } catch (e) {
                console.warn('[Reports] Lead/Customer data fetch failed:', e);
            }
        }

        // Calculate KPIs
        const needsKPIs = [
            'sales-metrics',
            'customer-metrics',
            'operational-metrics',
            'operational-metrics',
            'sales-report',
            'one-page-sales',
            'sales-summary',
        ].includes(reportType) || needsAllData;

        if (needsKPIs) {
            const efficiency = (inventoryTurnover + salesPerEmployee) / 2;

            data.kpis = {
                penjualanShowroom: Math.round(inventoryTurnover),
                atv: (data.totalSales || 0) > 0 ? 100 : 0,
                inventoryTurnover: Math.round(inventoryTurnover),
                customerRetention: 0,
                nps: 0,
                salesPerEmployee: Math.round(salesPerEmployee),
                efficiency: Math.round(efficiency),
            };
        }

        // Generate Management Insights if needed
        if (reportType === 'management-insights' || needsAllData) {
            const { InsightEngine } = await import('@/lib/reports/insight-engine');
            data.managementInsights = InsightEngine.generate(data);
        }

        return data;
    }
}
