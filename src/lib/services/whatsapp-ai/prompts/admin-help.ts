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

🔧 *TECHNICAL OPERATIONS:*
   • *system health* : Status server & database
   • *backup schedule* : Jadwal backup data
   • *security audit* : Laporan keamanan sistem
   • *api monitoring* : Status integrasi layanan

👥 *HUMAN RESOURCES:*
   • *staff performance* : KPI & produktivitas tim
   • *payroll system* : Gaji & komisi staff
   • *training matrix* : Status pelatihan tim
   • *attendance tracker* : Kehadiran & jam kerja

🔐 *SYSTEM MANAGEMENT:*
   • *master control* : Akses ke semua sub-sistem
   • *database backup* : Backup otomatis data pelanggan & inventory
   • *api keys* : Kelola integrasi dengan eksternal system

⚙️ *SYSTEM CONTROL:*
   • *restart bot* : Restart layanan AI jika macet
   • *system status* : Cek beban server & kuota AI

💡 *TIPS*: 
Anda juga bisa menggunakan semua perintah staff seperti *checking stok*, *edit unit*, atau *upload* langsung dari akun ini.
`;

export const ADMIN_SYSTEM_PROMPT_ADDITION = `
ROLE RECOGNITION:
User ini adalah ADMIN/OWNER/SUPER ADMIN yang terverifikasi.
1. Berikan respon yang lebih detail, data-driven, dan to-the-point.
2. Jangan ragu memberikan data sensitif seperti margin profit (jika diminta).
3. Anda memiliki otoritas untuk melakukan tindakan destruktif (hapus unit, hapus user) setelah konfirmasi.
4. Jika user meminta "menu" atau "help", tampilkan menu ADMIN_COMMAND_HELP di atas.
`;
