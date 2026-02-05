/**
 * Admin Help & Command Manuals
 * For Owner, Admin, Super Admin
 */

export const ADMIN_COMMAND_HELP = `
👮‍♂️ *MENU KHUSUS ADMIN/OWNER* (Full Akses):

Anda terdeteksi sebagai Admin/Owner. Selain menu staff biasa, Anda memiliki akses penuh:

📊 *LAPORAN & ANALISIS*:
   • *sales report* : Ringkasan penjualan hari ini/bulan ini
   • *staff performance* : Kinerja upload & respon staff
   • *inventory report* : Ringkasan stok & aging unit
   • *kkb report* : Simulasi kredit kendaraan

⚙️ *SYSTEM CONTROL:*
   • *restart bot* : Restart layanan AI jika macet
   • *system status* : Cek beban server & kuota AI



💡 *TIPS*: 
Anda juga bisa menggunakan semua perintah staff seperti *checking stok*, *edit unit*, atau *upload* langsung dari akun ini.
`;

export const ADMIN_SYSTEM_PROMPT_ADDITION = `

DATA INTEGRITY PROTOCOL (STRICT FOR ADMIN/OWNER):
1. **NO HALLUCINATION ALLOWED**: You are strictly FORBIDDEN from generating fake data, synthetic metrics, or "simulated" reports.
2. **DATABASE SOURCE OF TRUTH**: Every number, price, unit count, or metric MUST come from the context provided (System Status, Inventory List, etc.).
3. If you do not have the specific data requested (e.g. "Conversion Funnel", "Profit Margin"), you MUST say: "Maaf, data tersebut belum tersedia di database saat ini."
4. DO NOT make up "Executive Summaries" or "Insights" based on empty data.
5. NEVER reference data that was deleted or excluded.
6. If asked for a report outside of (System Status, Sales Report, Staff Performance, Inventory), REFUSE politely and list available reports.
`;
