export const AUTOMOTIVE_KNOWLEDGE_BASE = `
📚 KLASIFIKASI KENDARAAN (VEHICLE TYPES & CAPACITY):

**TIPE KENDARAAN (Berdasarkan Body Type):**
- SEDAN: Mobil penumpang 4-5 seat, bagasi terpisah, cocok untuk pemakaian pribadi/bisnis
  → Contoh: Honda City, Toyota Vios, Honda Civic, Toyota Camry
  → Kapasitas: 5 penumpang (2 depan, 3 belakang)
  
- HATCHBACK: Mobil compact 5 penumpang, bagasi menyatu dengan kabin
  → Contoh: Honda Brio, Toyota Agya, Suzuki Swift, Suzuki Ignis
  → Kapasitas: 5 penumpang (2 depan, 3 belakang)
  
- MPV (Multi-Purpose Vehicle): Mobil keluarga 7 penumpang, 3 baris kursi
  → Contoh: Toyota Avanza, Xpander, Ertiga, Innova
  → Kapasitas: 7 penumpang (biasanya konfigurasi 2-3-2)
  
- SUV (Sport Utility Vehicle): Mobil dengan ground clearance tinggi, bisa off-road
  → Contoh: Fortuner, Pajero Sport, CR-V, Rush
  → Kapasitas: 5-7 penumpang tergantung varian
  → Ground Clearance: Biasanya >200mm
  
- LCGC (Low Cost Green Car): Mobil murah ramah lingkungan
  → Contoh: Agya, Calya, Karimun Wagon R, Brio Satya
  → Kapasitas: 5-7 penumpang tergantung model

**SPESIFIKASI TEKNIS KONSULTAN (DATA REFERENSI UMUM - BUKAN SPESIFIK UNIT STOK):**
- **Konsumsi BBM Rata-rata (Estimasi Umum):**
  - LCGC 1.0L - 1.2L: 14-18 km/liter (Sangat Irit)
  - City Car/Sedan 1.5L: 11-14 km/liter (Irit)
  - MPV 1.5L (Avanza/Xpander): 10-12 km/liter (Sedang)
  - SUV Diesel 2.4L (Fortuner/Pajero): 9-11 km/liter (Efisien Torsi)
  - SUV Bensin 2.0L+ (CRV): 7-9 km/liter (Boros)

- **Dimensi Garasi Minimal (Estimasi Standar):**
  - City Car (Brio/Agya): 4m x 2.5m
  - MPV/Sedan (Avanza/City): 5m x 2.8m
  - SUV Besar (Fortuner/Pajero): 5.5m x 3m

- **Biaya Perawatan Berkala (Estimasi Kasar per 10.000km):**
  - Honda/Toyota (Kelas Menengah): Rp 1.5jt - 2.5jt
  - Mitsubishi (Expander/Pajero): Rp 2jt - 3.5jt
  - Mobil Eropa/CBU: > Rp 5jt

**ATURAN PENTING MENJAWAB PERTANYAAN TIPE KENDARAAN:**
- Jika user tanya "Honda City itu SUV atau apa?" → Jawab: "Honda City adalah SEDAN, bukan SUV. Kapasitas 5 penumpang."
- Jika user tanya "kapasitas berapa?" → Jawab kapasitas berdasar tipe (Sedan=5, MPV=7)
- JANGAN fallback ke template budget jika pertanyaan spesifik tentang tipe/kapasitas!

---

**HONDA CITY (OLDER MODELS - 2003-2008 GEN):**
- Tipe: SEDAN kompak
- Kapasitas: 5 penumpang (2 depan, 3 belakang)
- Mesin: 1.5L i-VTEC (110 PS) atau 1.3L i-DSI
- Transmisi: Manual 5-speed / Automatic 5-speed atau CVT
- Fitur: Power steering, AC, Central Lock, Power Window
- Cocok untuk: Penggunaan harian di kota, first car, mobil keluarga kecil
- Konsumsi BBM: ±12-15 km/L (dalam kota)
- Kelebihan: Irit, parts murah, service mudah, resale value bagus
- Harga second (2006): 70-100 juta (tergantung kondisi & km)

---

DATABASE PENGETAHUAN KENDARAAN (CATALOG REFERENCE ONLY):
⚠️ PERINGATAN: Data di bawah adalah referensi katalog umum Toyota/Honda/dll.
⚠️ JANGAN anggap stok showroom memiliki semua mobil ini. Cek ketersediaan via tool search_vehicles dulu!


**TOYOTA AVANZA/VELOZ (2022+)**
- Varian: 1.3 E MT, 1.3 E CVT, 1.5 G CVT, Veloz 1.5 CVT, Veloz 1.5 Q CVT
- Mesin: 1.3L (98 PS) / 1.5L (106 PS), Dual VVT-i
- Transmisi: Manual 5-speed / CVT
- Fitur Veloz Q: TSS (Pre-Collision, LDA, AHB), Panoramic View Monitor, Wireless Charger
- Kapasitas: 7 penumpang
- Harga kisaran: 230-290 juta (2023)

**TOYOTA FORTUNER (2023+)**
- Varian: 2.4 VRZ 4x2 AT, 2.4 VRZ 4x4 AT, 2.8 VRZ 4x4 AT
- Mesin: 2.4L Diesel (150 PS) / 2.8L Diesel (204 PS)
- Transmisi: Automatic 6-speed
- Fitur VRZ: TSS, Leather Seat, Sunroof (tipe tertentu), LED Headlamp, 18" Alloy Wheels
- 4WD: Part-time 4WD dengan Diff Lock
- Harga kisaran: 550-750 juta

**TOYOTA INNOVA ZENIX (2023+)**
- Varian: 2.0 G CVT, 2.0 V CVT, Hybrid V CVT, Hybrid Q CVT
- Mesin: 2.0L Bensin (174 PS) / 2.0L Hybrid (186 PS)
- Transmisi: CVT (Direct Shift-CVT untuk Hybrid)
- Fitur Hybrid Q: TSS, Panoramic Sunroof, 360 Camera, Wireless Charger, 10" Display Audio
- Kapasitas: 7 penumpang (Captain Seat di V/Q)
- Harga kisaran: 400-650 juta

**TOYOTA RAIZE (2023+)**
- Varian: 1.0 G MT, 1.0 G CVT, 1.0 GR Sport CVT, 1.2 Turbo GR Sport CVT
- Mesin: 1.0L (98 PS) / 1.2L Turbo (98 PS)
- Transmisi: Manual 5-speed / CVT
- Fitur GR Sport: Sporty Bodykit, Red Interior Accent, Paddle Shift
- Fitur Safety: 6 Airbags, VSC, Hill Start Assist
- Harga kisaran: 230-280 juta

**TOYOTA RUSH (2023+)**
- Varian: 1.5 G MT, 1.5 G AT, 1.5 S GR Sport AT
- Mesin: 1.5L (105 PS), Dual VVT-i
- Transmisi: Manual 5-speed / Automatic 4-speed
- Fitur GR Sport: Bodykit, 17" Alloy Wheels, Leather Seat
- Kapasitas: 7 penumpang
- Harga kisaran: 270-310 juta

**TOYOTA AGYA (2023+)**
- Varian: 1.0 E MT, 1.0 G MT, 1.0 G AT, 1.2 GR Sport AT
- Mesin: 1.0L (66 PS) / 1.2L (88 PS)
- Transmisi: Manual 5-speed / Automatic 4-speed
- Fitur GR Sport: Sporty Design, Touchscreen 9", Reverse Camera
- Harga kisaran: 160-210 juta

**TOYOTA CALYA (2023+)**
- Varian: 1.2 E MT, 1.2 G MT, 1.2 G AT
- Mesin: 1.2L (88 PS), Dual VVT-i
- Transmisi: Manual 5-speed / Automatic 4-speed
- Kapasitas: 7 penumpang
- Harga kisaran: 160-200 juta

**HONDA BRIO (2023+)**
- Varian: Satya E MT, Satya S MT, RS CVT, RS Urbanite CVT
- Mesin: 1.2L i-VTEC (90 PS)
- Transmisi: Manual 5-speed / CVT
- Fitur RS: LED Headlamp, Touchscreen 7", Cruise Control, Paddle Shift
- Harga kisaran: 160-240 juta

**HONDA CITY (2023+)**
- Varian: S MT, S CVT, E CVT, RS CVT
- Mesin: 1.5L i-VTEC (121 PS)
- Transmisi: Manual 6-speed / CVT
- Fitur RS: Honda SENSING (ACC, LKAS, Auto High Beam), LED Headlamp, Paddle Shift
- Harga kisaran: 330-390 juta

**HONDA CR-V (2023+)**
- Varian: 1.5 Turbo CVT, 1.5 Turbo Prestige CVT
- Mesin: 1.5L Turbo (190 PS)
- Transmisi: CVT
- Fitur Prestige: Honda SENSING, Panoramic Sunroof, Hands-Free Power Tailgate, Wireless Charger
- Harga kisaran: 750-850 juta

**MITSUBISHI XPANDER (2023+)**
- Varian: GLX MT, GLS MT, Exceed MT, Sport MT, Ultimate AT, Cross AT
- Mesin: 1.5L MIVEC (105 PS)
- Transmisi: Manual 5-speed / Automatic 4-speed
- Fitur Ultimate: Touchscreen 9", 360 Camera, Leather Seat
- Kapasitas: 7 penumpang
- Harga kisaran: 260-340 juta

**MITSUBISHI PAJERO SPORT (2023+)**
- Varian: Exceed 4x2 AT, Dakar 4x2 AT, Dakar Ultimate 4x4 AT
- Mesin: 2.4L Diesel MIVEC (181 PS)
- Transmisi: Automatic 8-speed
- Fitur Dakar Ultimate: Sunroof, Rockford Fosgate Audio, 360 Camera, Paddle Shift
- 4WD: Super Select 4WD II
- Harga kisaran: 560-750 juta

**SUZUKI ERTIGA (2023+)**
- Varian: GL MT, GL AT, GX MT, GX AT, Sport MT, Sport AT
- Mesin: 1.5L K15B (105 PS), VVT
- Transmisi: Manual 5-speed / Automatic 4-speed
- Fitur Sport: Sporty Bodykit, Touchscreen 10", Rear Parking Camera, Leather Seat
- Kapasitas: 7 penumpang (3 baris)
- Harga kisaran: 230-290 juta

**SUZUKI XL7 (2023+)**
- Varian: Beta MT, Beta AT, Alpha MT, Alpha AT, Zeta AT
- Mesin: 1.5L K15B (105 PS), VVT
- Transmisi: Manual 5-speed / Automatic 4-speed
- Fitur Zeta: Smart Play Cast, 360 View Camera, Cruise Control, Paddle Shift
- Ground Clearance: 200mm (lebih tinggi dari Ertiga)
- Kapasitas: 7 penumpang
- Harga kisaran: 250-310 juta

**SUZUKI BALENO (2023+)**
- Varian: MT, AT, Hatchback Premium
- Mesin: 1.4L K14B (95 PS), VVT
- Transmisi: Manual 5-speed / Automatic 4-speed
- Fitur: Smart Play Cast, Reverse Camera, Keyless Entry, Push Start Button
- Tipe: Hatchback 5-pintu
- Harga kisaran: 230-270 juta

**SUZUKI IGNIS (2023+)**
- Varian: GL MT, GL AGS, GX MT, GX AGS
- Mesin: 1.2L K12M (83 PS), Dual Jet VVT
- Transmisi: Manual 5-speed / AGS (Auto Gear Shift)
- Fitur GX: LED Headlamp, Touchscreen 7", Reverse Camera, Alloy Wheels
- Tipe: Urban Compact SUV
- Harga kisaran: 180-230 juta

**SUZUKI JIMNY (2023+)**
- Varian: 1.5 MT 4WD, 1.5 AT 4WD
- Mesin: 1.5L K15B (102 PS), VVT
- Transmisi: Manual 5-speed / Automatic 4-speed
- 4WD: Part-time 4WD dengan Low Range, Brake LSD Traction Control
- Fitur: Ladder Frame Chassis, Approach Angle 37°, Departure Angle 49°
- Tipe: Off-road Legend
- Harga kisaran: 430-470 juta

**SUZUKI CARRY PICKUP (2023+)**
- Varian: 1.5 WD, 1.5 FD (Flat Deck)
- Mesin: 1.5L K15B (97 PS), VVT
- Transmisi: Manual 5-speed
- Kapasitas Angkut: 800 kg
- Fitur: Power Steering, AC, Radio
- Harga kisaran: 160-180 juta

**SUZUKI S-PRESSO (2023+)**
- Varian: GL MT, GL AGS, GX MT, GX AGS
- Mesin: 1.0L K10B (68 PS), VVT
- Transmisi: Manual 5-speed / AGS
- Fitur GX: Touchscreen 7", Reverse Camera, Roof Rail
- Tipe: Entry SUV Compact
- Harga kisaran: 120-160 juta

**SUZUKI SWIFT (2023+)**
- Varian: GL MT, GL AT, GX MT, GX AT
- Mesin: 1.2L K12M (83 PS), Dual Jet VVT
- Transmisi: Manual 5-speed / Automatic CVT
- Fitur GX: LED Headlamp, Touchscreen 7", Cruise Control, Paddle Shift
- Tipe: Sporty Hatchback
- Harga kisaran: 210-260 juta

**SUZUKI KARIMUN WAGON R (2023+)**
- Varian: GA MT, GL MT, GL AGS, GS MT, GS AGS
- Mesin: 1.0L K10B (68 PS), VVT
- Transmisi: Manual 5-speed / AGS
- Fitur GS: Touchscreen 7", Reverse Camera, Keyless Entry
- Tipe: Tall Wagon (ruang kabin luas)
- Harga kisaran: 120-160 juta


**KEBIJAKAN KKB & SIMULASI KREDIT (PENGETAHUAN FINANSIAL):**
- Partner Leasing: BCA Finance, Adira Finance, Mandiri Tunas Finance (MTF), OTO, WOM Finance.
- Estimasi Bunga (Flat p.a.):
  - Tenor 1-3 thn: 4.5% - 6.5% (BCA/Priority) | 8% - 9.5% (Umum)
  - Tenor 4-5 thn: 6.25% - 9.0% (BCA/Priority) | 10% - 11.5% (Umum)
- DP (Down Payment) Standar: Minimal 20% - 30% dari harga OTR (On The Road).
- Syarat Dokumen (Wajib): KTP Suami/Istri, Kartu Keluarga, NPWP, PBB/Rek Listrik, Rekening Tabungan (3 bulan terkahir), Slip Gaji (Karyawan) atau SKU (Wiraswasta).
- Asuransi: Biasanya sudah termasuk TLO (Total Loss Only) atau All Risk dalam paket angsuran.

CARA MENGGUNAKAN DATABASE:
1. Jika ditanya spesifikasi, sebutkan detail lengkap (mesin, transmisi, fitur unggulan).
2. Jika ditanya perbandingan varian, jelaskan perbedaan fitur dan harga.
3. Jika ditanya rekomendasi, sesuaikan dengan budget dan kebutuhan customer.
4. Jika ditanya "pakai rate apa" atau "mitra apa", jawab berdasarkan data Kebijakan KKB di atas.
5. SELALU sebutkan "berdasarkan data pasar terbaru" untuk disclaimer.

ATURAN SEARCH QUERY (PENTING):
- Jika user mencari model spesifik (contoh: "Brio"), JANGAN search merk ("Honda").
- Tool \`send_vehicle_images\`: query harus SPESIFIK.
  - Benar: search_query="Brio"
  - Salah: search_query="Honda" (Kecuali user memang tanya "Ada Honda apa aja?")
- Jika user upload foto dan tanya info, JANGAN tebak jika tidak yakin. Cukup bilang "Maaf saya belum mengenali unit ini, bisa sebutkan nama mobilnya?"
- JANGAN PERNAH mengirim foto mobil yang BEDA dengan yang diminta user. Jika user minta Brio, jangan kirim foto City walaupun stok Brio habis. Bilang saja "Mohon maaf, unit Brio sedang tidak tersedia".
`;


export function getCompanyKnowledgeBase(tenant: any): string {
  const showroomName = tenant?.name || "Showroom Kami";
  const city = tenant?.city || "Indonesia";
  const address = tenant?.address || "Lokasi Strategis";

  return `
🏆 PROFIL PERUSAHAAN (SOURCE OF TRUTH):

🏢 TENTANG ${showroomName} (The Showroom)
- Identitas: Showroom mobil second premium terpercaya di ${city} dengan standar kualitas tinggi.
- Visi: Menghadirkan transparansi total, kemudahan transaksi, dan kepuasan pelanggan melalui teknologi.
- Keunggulan:
  1. Unit Pilihan: Semua mobil lolos inspeksi ketat (bebas banjir, bebas tabrak).
  2. Transparan: Kilometer asli, dokumen lengkap & sah.
  3. Teknologi: Didukung sistem AI canggih untuk layanan 24/7 dan update stok real-time.
- Lokasi: ${address}
- Layanan: Melayani jual beli, tukar tambah, dan kredit dengan mitra leasing terpercaya.

🤖 TENTANG PROJECT AUTOLUMIKU (The Technology)
- Definisi: Platform SaaS (Software as a Service) Otomotif canggih yang menjadi "otak" di balik operasional ${showroomName}.
- Peran: Mitra teknologi strategis yang mendigitalkan seluruh proses bisnis showroom.
- Teknologi Utama:
  1. **AI 5.2 Agentic Core**: Kecerdasan buatan otonom dengan kemampuan 'Thinking Mode', 'Trade-In Valuation', dan 'Smart Scheduling'.
  2. **Real-time Inventory Cloud**: Sistem manajemen stok berbasis cloud yang memastikan data ketersediaan unit selalu akurat detik-demi-detik.
  3. **Auto-Document Engine**: Generator otomatis untuk brosur, invoice, dan dokumen legalitas.
  4. **Next.js & Modern Web Stack**: Dibangun dengan teknologi web modern untuk kecepatan dan keamanan maksimal.
- Filosofi: "Empowering Automotive Business with Intelligent Technology".
- Hubungan: ${showroomName} adalah pengguna utama (flagship implementation) dari teknologi Autolumiku.

💡 CARA MENJAWAB TENTANG PERUSAHAAN:
1. Jika ditanya "Apa itu ${showroomName}?": Jelaskan sebagai showroom terpercaya di ${city} dengan unit berkualitas.
2. Jika ditanya "Kamu pakai sistem apa?" / "Siapa Autolumiku?": Jelaskan dengan bangga bahwa Anda didukung oleh teknologi **Autolumiku**, platform otomotif tercanggih dengan AI 5.2.
3. Posisi Anda (AI): Anda adalah **AI Assistant ${showroomName}** yang ditenagai oleh otak **Autolumiku**.
`;
}

