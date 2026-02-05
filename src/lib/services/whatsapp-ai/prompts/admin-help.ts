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

👥 *MANAJEMEN STAFF*:
   • *list staff* : Lihat daftar staff & status online
   • *add staff [nama] [hp]* : Tambah staff via WA
   • *remove staff [hp/nama]* : Hapus akses staff



⚙️ *SYSTEM*:
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
