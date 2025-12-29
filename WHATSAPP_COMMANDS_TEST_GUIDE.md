# WhatsApp AI Commands - Test Guide

## Overview
The WhatsApp AI command system is fully implemented and ready for testing. This guide shows how to test all commands.

## Test Methods

### Method 1: Direct API Testing (Recommended for Development)

Test the command endpoint directly:

```bash
curl -X POST http://localhost:3000/api/v1/whatsapp-ai/command \
  -H "Content-Type: application/json" \
  -d '{
    "command": "status",
    "phoneNumber": "6281234567890",
    "tenantId": "your-tenant-id",
    "userId": "your-user-id",
    "userRole": "ADMIN",
    "userRoleLevel": 90
  }'
```

### Method 2: WhatsApp Testing (Production)
Send commands directly to the WhatsApp bot:
1. Open WhatsApp on your phone
2. Send a message to the showroom's WhatsApp number
3. Type any command from the list below

## Commands to Test

### Universal Commands (ALL Roles)

#### 1. Status Command
```
Command: status
Expected Response: Showroom status breakdown
- Total Kendaraan: X unit
- Tersedia: X unit
- Terbook: X unit
- Terjual: X unit
```

#### 2. Inventory/Stok Command
```
Command: inventory
OR: stok
Expected Response: Latest 10 vehicles in inventory
- Total stok: X unit
- List of vehicles with make, model, year, price, status
```

#### 3. Statistik Command
```
Command: statistik
OR: stats
Expected Response: Monthly sales statistics
- Total Penjualan: X unit
- Total Revenue: Rp X
- Performa Anda: X unit (X%)
```

#### 4. Upload Command
```
Command: upload
Expected Response: Dashboard link and instructions
- Link to upload page
- Step-by-step instructions
```

#### 5. Rubah/Ubah/Edit Command
```
Command: rubah
OR: ubah
OR: edit
Expected Response: Edit dashboard link
- Link to edit vehicle page
```

### PDF Report Commands (ADMIN+, OWNER, SUPER ADMIN ONLY)

#### 1. Sales Report
```
Command: sales report
Expected:
- PDF file sent via WhatsApp
- Contains: Sales summary, by make breakdown, staff performance
- Filename: sales-report-YYYY-MM-DD.pdf
```

#### 2. WhatsApp AI Analytics
```
Command: whatsapp ai
Expected:
- PDF with conversation metrics
- AI response rate, accuracy
- Intent breakdown
- Filename: whatsapp-ai-analytics-YYYY-MM-DD.pdf
```

#### 3. Sales Metrics
```
Command: metrix penjualan
Expected:
- PDF with KPIs and inventory metrics
- Total sales, revenue, average price
- Filename: metrik-penjualan-YYYY-MM-DD.pdf
```

#### 4. Customer Metrics
```
Command: metrix pelanggan
Expected:
- PDF with customer engagement data
- Total conversations, intent breakdown
- Filename: metrik-pelanggan-YYYY-MM-DD.pdf
```

#### 5. Operational Metrics
```
Command: metrix operational
Expected:
- PDF with operational KPIs
- Staff count, inventory value
- Filename: metrik-operational-YYYY-MM-DD.pdf
```

#### 6. Sales Trends
```
Command: tren penjualan
Expected:
- PDF with daily sales trends
- Last 30 days breakdown
- Filename: tren-penjualan-YYYY-MM-DD.pdf
```

#### 7. Staff Performance
```
Command: staff performance
Expected:
- PDF with staff rankings
- Individual performance details
- Filename: staff-performance-YYYY-MM-DD.pdf
```

#### 8. Recent Sales
```
Command: recent sales
Expected:
- PDF with last 7 days sales
- Transaction details
- Filename: recent-sales-YYYY-MM-DD.pdf
```

#### 9. Low Stock Alert
```
Command: low stock alert
Expected:
- PDF with inventory status
- Warnings if stock < 10 units
- Filename: low-stock-alert-YYYY-MM-DD.pdf
```

#### 10. Total Sales
```
Command: total penjualan showroom
Expected:
- PDF with total units sold
- Summary view
- Filename: total-penjualan-YYYY-MM-DD.pdf
```

#### 11. Total Revenue
```
Command: total revenue
Expected:
- PDF with revenue summary
- Large display format
- Filename: total-revenue-YYYY-MM-DD.pdf
```

#### 12. Total Inventory
```
Command: total inventory
Expected:
- PDF with inventory count
- Total value
- Filename: total-inventory-YYYY-MM-DD.pdf
```

#### 13. Average Price
```
Command: average price
Expected:
- PDF comparing sales vs stock prices
- Color-coded display
- Filename: average-price-YYYY-MM-DD.pdf
```

#### 14. Sales Summary
```
Command: penjualan
OR: sales
Expected:
- PDF with quick overview
- All key metrics
- Filename: sales-summary-YYYY-MM-DD.pdf
```

## Role-Based Access Control Testing

### Test as SALES (roleLevel < 90):
```
✅ status - Should work
✅ inventory - Should work
✅ statistik - Should work (shows personal stats)
✅ upload - Should work
✅ rubah - Should work
❌ sales report - Should DENY with message
❌ whatsapp ai - Should DENY with message
❌ All PDF commands - Should DENY with message
```

### Test as ADMIN/OWNER/SUPER ADMIN (roleLevel >= 90):
```
✅ ALL commands should work
✅ ALL PDF reports should be generated and sent
```

## Expected Bot Behavior

### Successful Command Flow:
1. User sends command
2. Bot processes command
3. Bot sends response message
4. If PDF command:
   - PDF generated and saved to storage
   - PDF sent via WhatsApp
   - Confirmation message sent
5. Bot asks: "Apakah perlu bantuan lainnya?"

### Unauthorized Access:
```
Bot: "Maaf, fitur PDF Report hanya untuk Owner, Admin, dan Super Admin."
```

### Invalid Command:
```
Bot: "Maaf, saya tidak mengerti command tersebut. Ketik 'help' untuk daftar command yang tersedia."
```

## Troubleshooting

### PDF Not Sending:
1. Check StorageService is configured
2. Check uploads directory exists and is writable
3. Check Aimeow client is connected
4. Check network connectivity

### Command Not Detected:
1. Check message-orchestrator logs
2. Verify command pattern matching
3. Check user phone number is in database

### RBAC Issues:
1. Verify user roleLevel in database
2. Check RBAC constants in src/lib/rbac.ts
3. Ensure user has correct role assigned

## Files Modified/Created

1. **src/app/api/v1/whatsapp-ai/command/route.ts** - Command API endpoint
2. **src/lib/services/whatsapp-ai/command-handler.service.ts** - Core command logic
3. **src/lib/services/whatsapp-ai/message-orchestrator.service.ts** - Command detection + PDF sending

## Production Deployment

✅ Build successful
✅ All TypeScript types validated
✅ Committed to git (commit 237c858)
✅ Pushed to origin/main

Ready for deployment to production!
