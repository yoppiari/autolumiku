import * as XLSX from 'xlsx';
import { ComprehensiveReportConfig, ReportData } from './comprehensive-report-pdf';

export class ExcelGenerator {
    generate(config: ComprehensiveReportConfig): Buffer {
        const workbook = XLSX.utils.book_new();
        const sheetName = config.type.substring(0, 31); // Max 31 chars

        const data = this.prepareData(config);
        const worksheet = XLSX.utils.json_to_sheet(data);

        // Auto-width columns
        const colWidths = data.reduce((acc: any, row: any) => {
            Object.keys(row).forEach((key, i) => {
                const val = row[key] ? String(row[key]).length : 0;
                acc[i] = Math.max(acc[i] || 0, val, key.length);
            });
            return acc;
        }, []).map((w: number) => ({ wch: w + 2 }));

        worksheet['!cols'] = colWidths;

        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

        // Generate buffer
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        return buffer as Buffer;
    }

    private prepareData(config: ComprehensiveReportConfig): any[] {
        const { type, data, period } = config;
        const reportData = data as ReportData; // Use ReportData interface we defined

        switch (type) {
            case 'sales-report':
                return [
                    { Section: 'Summary', Metric: 'Total Sales', Value: reportData.totalSales, Unit: 'Units' },
                    { Section: 'Summary', Metric: 'Total Revenue', Value: reportData.totalRevenue, Unit: 'IDR' },
                    { Section: 'Summary', Metric: 'Avg Price', Value: reportData.avgPrice, Unit: 'IDR' },
                    {},
                    ...(reportData.recentSalesDetail || []).map((sale: any) => ({
                        Section: 'Transactions',
                        Date: sale.soldDate,
                        ID: sale.displayId,
                        Make: sale.make,
                        Model: sale.model,
                        Year: sale.year,
                        Price: sale.price
                    }))
                ];

            case 'sales-summary':
            case 'total-sales':
            case 'total-revenue':
            case 'average-price':
                return (reportData.recentSalesDetail || []).map((sale: any) => ({
                    Date: sale.soldDate,
                    ID: sale.displayId,
                    Make: sale.make,
                    Model: sale.model,
                    Year: sale.year,
                    Price: sale.price
                }));

            case 'sales-trends':
                return (reportData.dailySales || []).map((day: any) => ({
                    Date: day.date,
                    Units: day.count,
                    Revenue: day.revenue
                }));

            case 'whatsapp-analytics':
                const waData: any = reportData.whatsapp || {};
                return [
                    { Metric: 'Total Conversations', Value: waData.totalConversations },
                    { Metric: 'Active Conversations', Value: waData.activeConversations },
                    { Metric: 'Total Messages', Value: waData.totalMessages },
                    { Metric: 'AI Response Rate', Value: `${waData.aiResponseRate}%` },
                    { Metric: 'Avg Response Time', Value: `${waData.avgResponseTime}s` },
                    {},
                    { Metric: 'Intent Breakdown' },
                    ...(waData.intentBreakdown || []).map((intent: any) => ({
                        Metric: intent.intent,
                        Value: intent.count,
                        Percentage: `${intent.percentage}%`
                    }))
                ];

            case 'staff-performance':
                return (reportData.staffPerformance || []).map((staff: any) => ({
                    Name: staff.name,
                    Sales: staff.sales,
                    Revenue: staff.revenue,
                    Performance: staff.performance
                }));

            case 'total-inventory':
                if (reportData.inventoryDetail && reportData.inventoryDetail.length > 0) {
                    return reportData.inventoryDetail.map((v: any) => ({
                        ID: v.displayId,
                        Make: v.make,
                        Model: v.model,
                        Year: v.year,
                        Price: v.price,
                        DaysInStock: v.daysInStock
                    }));
                }
                return [
                    { Metric: 'Total Inventory', Value: reportData.totalInventory || 0 },
                    { Metric: 'Avg Stock Price', Value: reportData.avgStockPrice || 0 }
                ];

            case 'low-stock-alert':
                return (reportData.lowStockVehicles || []).map((v: any) => ({
                    ID: v.displayId,
                    Make: v.make,
                    Model: v.model,
                    Year: v.year,
                    DaysInStock: v.daysInStock,
                    Status: v.status
                }));

            case 'sales-metrics':
            case 'operational-metrics':
            case 'customer-metrics':
                const kpis = reportData.kpis || {};
                return Object.entries(kpis).map(([key, value]) => ({
                    KPI: key,
                    Value: value
                }));

            case 'management-insights':
                return (reportData.managementInsights || []).map((insight: string, idx: number) => ({
                    No: idx + 1,
                    Insight: insight,
                    Category: 'Strategic Analysis'
                }));

            default:
                // Generic dump of what we have
                const flatData: any[] = [];
                if (reportData.totalSales !== undefined) flatData.push({ Metric: 'Total Sales', Value: reportData.totalSales });
                if (reportData.totalRevenue !== undefined) flatData.push({ Metric: 'Total Revenue', Value: reportData.totalRevenue });

                return flatData.length > 0 ? flatData : [{ Info: 'No detailed data available for Excel export of this report type.' }];
        }
    }
}
