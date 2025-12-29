# WhatsApp AI Commands - Example Outputs

## Universal Commands - Example Responses

### 1. Command: "status"
```
📊 STATUS SHOWROOM

Total Kendaraan: 45 unit
✅ Tersedia: 28 unit
🔒 Terbook: 7 unit
✅ Terjual: 10 unit

Lihat detail di: https://primamobil.id/dashboard
```

### 2. Command: "inventory" or "stok"
```
📦 INVENTORY SHOWROOM

Total stok: 28 unit

10 Kendaraan terbaru:

1. Toyota Avanza (2021)
   Rp 185.000.000 - AVAILABLE
   ID: PM-2024-001

2. Honda Brio (2022)
   Rp 160.000.000 - AVAILABLE
   ID: PM-2024-002

3. Suzuki Ertiga (2023)
   Rp 210.000.000 - BOOKED
   ID: PM-2024-003

...dan 18 unit lainnya.

Lihat full inventory di: https://primamobil.id/dashboard/vehicles
```

### 3. Command: "statistik" or "stats"
```
📈 STATISTIK BULAN INI (01 Desember 2024 - 29 Desember 2024)

✅ Total Penjualan: 10 unit
💰 Total Revenue: Rp 1.850.000.000

📊 Performa Anda:
   Unit terjual: 3
   Kontribusi: 30.0%

Lihat detail analytics di: https://primamobil.id/dashboard/whatsapp-ai/analytics
```

### 4. Command: "upload"
```
Untuk upload kendaraan baru, silakan gunakan menu Upload di dashboard: https://primamobil.id/dashboard/vehicles/upload

Anda akan diminta untuk:
1. Input data kendaraan (merek, model, tahun, harga, dll)
2. Upload foto kendaraan (max 10 foto)
3. Submit untuk memproses
```

### 5. Command: "rubah" or "ubah" or "edit"
```
Untuk mengedit data kendaraan, silakan gunakan menu Edit di dashboard: https://primamobil.id/dashboard/vehicles/[id-kendaraan]/edit

Contoh:
- Edit: https://primamobil.id/dashboard/vehicles/PM-2024-001/edit
```

## PDF Report Commands - Example Content

### Sales Report PDF
**Pages:**
- Page 1: Cover + Summary (Total Sales, Revenue, Average Price)
- Page 2: Sales by Make (Toyota: 5 units, Honda: 3 units, etc.)
- Page 3: Staff Performance Rankings

**Filename:** `sales-report-2024-12-29.pdf`

### WhatsApp AI Analytics PDF
**Pages:**
- Page 1: Cover + Overview (Total Conversations, AI Response Rate)
- Page 2: Performance Metrics (AI Accuracy, Escalation Rate)
- Page 3: Intent Breakdown (Price: 35%, Vehicle: 40%, etc.)

**Filename:** `whatsapp-ai-analytics-2024-12-29.pdf`

### Staff Performance PDF
**Pages:**
- Page 1: Cover
- Page 2-5: Individual Staff Rankings
  1. Ahmad Rizki - 5 units - Rp 925.000.000
  2. Budi Santoso - 3 units - Rp 555.000.000
  3. Citra Dewi - 2 units - Rp 370.000.000

**Filename:** `staff-performance-2024-12-29.pdf`

### Low Stock Alert PDF
**Pages:**
- Page 1: Cover + Status
- Page 2: Alert Details
  - If stock < 10: 🔴 LOW STOCK ALERT
  - If stock < 20: ⚠️ Stok Menipis
  - If stock >= 20: ✅ Stok Aman

**Filename:** `low-stock-alert-2024-12-29.pdf`

## Error Responses

### Unauthorized PDF Access (Sales role trying PDF command)
```
❌ Maaf, fitur PDF Report hanya untuk Owner, Admin, dan Super Admin.

Silakan hubungi admin jika Anda memerlukan akses ke fitur ini.
```

### User Not Found
```
❌ Maaf, nomor WhatsApp Anda tidak terdaftar di sistem.

Silakan daftarkan nomor WhatsApp Anda di: https://primamobil.id/dashboard/users
```

### Unknown Command
```
❌ Maaf, saya tidak mengerti command tersebut.

Ketik "help" untuk daftar command yang tersedia:

Universal Commands:
• status - Cek status showroom
• inventory/stok - Cek stok kendaraan
• statistik/stats - Lihat statistik penjualan
• upload - Upload kendaraan baru
• rubah/ubah/edit - Edit kendaraan

PDF Reports (Admin+):
• sales report
• whatsapp ai
• metrix penjualan
• ... dan 11 lainnya
```

## Success Confirmation

### PDF Successfully Sent
```
✅ Sales Report berhasil dibuat. Mengirim PDF...
✅ PDF berhasil dikirim!

Apakah perlu bantuan lainnya?
```

### Processing Error
```
❌ Gagal mengirim PDF: Connection timeout

Silakan coba lagi atau hubungi admin.
```

## Bot Conversation Flow Example

### Complete Transaction Flow:
```
👤 User: sales report

🤖 Bot: ✅ Sales Report berhasil dibuat. Mengirim PDF...
         ✅ PDF berhasil dikirim!

         Apakah perlu bantuan lainnya?

👤 User: ya, inventory juga

🤖 Bot: 📦 INVENTORY SHOWROOM
         Total stok: 28 unit
         [Shows 10 latest vehicles...]

         Apakah perlu bantuan lainnya?

👤 User: sudah cukup

🤖 Bot: Terima kasih! Semoga laporannya bermanfaat 🙏
         Sampai jumpa lagi!
```

## Notes

- All PDFs are stored in `/app/uploads/reports/{tenantId}/{timestamp}-{filename}`
- PDFs are sent via WhatsApp using AimeowClientService.sendDocument()
- Each PDF has a unique timestamp in the filename
- PDFs include tenant name, date, and professional formatting
- Currency is formatted in Indonesian Rupiah (IDR)
- Dates are formatted in Indonesian locale (DD Month YYYY)
