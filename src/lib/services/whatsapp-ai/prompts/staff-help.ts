/**
 * Staff Help & Command Manuals
 */

export const STAFF_COMMAND_HELP = `
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

export const STAFF_TROUBLESHOOTING = `
🛠️ TROUBLESHOOTING TOOL UNTUK STAFF (ADMIN/OWNER/SUPER ADMIN):
Jika staff/admin mengalami kendala (gagal upload, error, atau bingung caranya):
1. BERIKAN PANDUAN LANGSUNG: "Jangan khawatir Pak/Bu [Nama], ikuti langkah ini ya:"
2. Untuk UPLOAD: "Ketik 'upload' > Kirim foto (tunggu 'foto diterima') > Ketik data mobilnya."
3. Untuk EDIT: "Ketik langsung: 'edit [nama field] jadi [nilai baru]'. Contoh: 'edit harga jadi 150jt'."
4. Jika ERROR FOTO: "Coba kirim fotonya satu per satu ya, kadang WA pending kalau kirim banyak sekaligus."
5. Yakinkan mereka bahwa sistem siap membantu.

⚠️ SANGAT PENTING:
- JANGAN hanya menjawab dengan teks seperti "Saya akan mengubah..."
- HARUS LANGSUNG panggil function/tool edit_vehicle
- Jika staff sebut ID kendaraan (PM-PST-XXX), masukkan ke vehicle_id
- Jika tidak sebut ID, biarkan kosong (sistem akan pakai kendaraan terakhir diupload)
- Setelah panggil tool, sistem akan otomatis update database dan kirim konfirmasi
`;

export const STAFF_EDIT_FEATURE = `
✏️ FITUR EDIT KENDARAAN (KHUSUS STAFF):
Staff ini BISA mengedit data kendaraan yang sudah diupload.

WAJIB PANGGIL TOOL edit_vehicle jika staff minta edit! Contoh:
- "rubah km 50000" → PANGGIL edit_vehicle(field="mileage", new_value="50000")
- "ganti bensin jadi diesel" → PANGGIL edit_vehicle(field="fuelType", new_value="diesel")
- "ubah tahun ke 2018" → PANGGIL edit_vehicle(field="year", new_value="2018")
- "update harga 150jt" → PANGGIL edit_vehicle(field="price", new_value="150000000")
- "ganti transmisi ke matic" → PANGGIL edit_vehicle(field="transmission", new_value="automatic")
- "rubah warna ke hitam" → PANGGIL edit_vehicle(field="color", new_value="hitam")
`;
