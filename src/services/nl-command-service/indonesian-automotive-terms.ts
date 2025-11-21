/**
 * Indonesian Automotive Terminology Dictionary
 * Epic 3: Story 3.3 - Automotive-Specific AI Understanding
 *
 * Comprehensive Indonesian automotive terms for natural language processing
 */

import { AutomotiveTerm } from './types';

// ============================================================================
// Vehicle Makes (Brands)
// ============================================================================

export const INDONESIAN_MAKES: AutomotiveTerm[] = [
  {
    indonesian: 'toyota',
    english: 'toyota',
    synonyms: ['tyt', 'toyot'],
    category: 'make',
  },
  {
    indonesian: 'honda',
    english: 'honda',
    synonyms: ['hnd', 'hond'],
    category: 'make',
  },
  {
    indonesian: 'suzuki',
    english: 'suzuki',
    synonyms: ['szk', 'suzk'],
    category: 'make',
  },
  {
    indonesian: 'daihatsu',
    english: 'daihatsu',
    synonyms: ['dht', 'daihat', 'daihats'],
    category: 'make',
  },
  {
    indonesian: 'mitsubishi',
    english: 'mitsubishi',
    synonyms: ['mitsub', 'mitsu', 'mits'],
    category: 'make',
  },
  {
    indonesian: 'nissan',
    english: 'nissan',
    synonyms: ['nis', 'niss'],
    category: 'make',
  },
  {
    indonesian: 'mazda',
    english: 'mazda',
    synonyms: ['mzd'],
    category: 'make',
  },
  {
    indonesian: 'wuling',
    english: 'wuling',
    synonyms: ['wul'],
    category: 'make',
  },
  {
    indonesian: 'bmw',
    english: 'bmw',
    synonyms: ['beemer', 'bimmer'],
    category: 'make',
  },
  {
    indonesian: 'mercedes',
    english: 'mercedes-benz',
    synonyms: ['mercy', 'merc', 'mercedes benz', 'benz'],
    category: 'make',
  },
];

// ============================================================================
// Popular Models in Indonesian Market
// ============================================================================

export const INDONESIAN_MODELS: AutomotiveTerm[] = [
  // Toyota
  { indonesian: 'avanza', english: 'avanza', synonyms: ['avanz', 'avz'], category: 'model' },
  { indonesian: 'innova', english: 'innova', synonyms: ['inova', 'inn'], category: 'model' },
  { indonesian: 'fortuner', english: 'fortuner', synonyms: ['fort', 'fortun'], category: 'model' },
  { indonesian: 'rush', english: 'rush', synonyms: ['rsh'], category: 'model' },
  { indonesian: 'agya', english: 'agya', synonyms: ['agy'], category: 'model' },
  { indonesian: 'calya', english: 'calya', synonyms: ['caly'], category: 'model' },
  { indonesian: 'yaris', english: 'yaris', synonyms: ['yrs'], category: 'model' },
  { indonesian: 'alphard', english: 'alphard', synonyms: ['alph', 'alpha'], category: 'model' },
  { indonesian: 'vellfire', english: 'vellfire', synonyms: ['vell', 'vellf'], category: 'model' },

  // Honda
  { indonesian: 'brio', english: 'brio', synonyms: ['bri'], category: 'model' },
  { indonesian: 'jazz', english: 'jazz', synonyms: ['jz'], category: 'model' },
  { indonesian: 'civic', english: 'civic', synonyms: ['cvc', 'civs'], category: 'model' },
  { indonesian: 'city', english: 'city', synonyms: ['cty'], category: 'model' },
  { indonesian: 'crv', english: 'cr-v', synonyms: ['cr-v', 'cr v'], category: 'model' },
  { indonesian: 'hrv', english: 'hr-v', synonyms: ['hr-v', 'hr v'], category: 'model' },
  { indonesian: 'brv', english: 'br-v', synonyms: ['br-v', 'br v'], category: 'model' },
  { indonesian: 'accord', english: 'accord', synonyms: ['acc'], category: 'model' },

  // Suzuki
  { indonesian: 'ertiga', english: 'ertiga', synonyms: ['ert'], category: 'model' },
  { indonesian: 'carry', english: 'carry', synonyms: ['cary'], category: 'model' },
  { indonesian: 'baleno', english: 'baleno', synonyms: ['balen'], category: 'model' },
  { indonesian: 'swift', english: 'swift', synonyms: ['swf'], category: 'model' },
  { indonesian: 'ignis', english: 'ignis', synonyms: ['ign'], category: 'model' },

  // Daihatsu
  { indonesian: 'xenia', english: 'xenia', synonyms: ['xen'], category: 'model' },
  { indonesian: 'terios', english: 'terios', synonyms: ['ter'], category: 'model' },
  { indonesian: 'gran max', english: 'gran max', synonyms: ['granmax', 'gmax'], category: 'model' },
  { indonesian: 'ayla', english: 'ayla', synonyms: ['ayl'], category: 'model' },
  { indonesian: 'sigra', english: 'sigra', synonyms: ['sig'], category: 'model' },

  // Mitsubishi
  { indonesian: 'xpander', english: 'xpander', synonyms: ['xpand', 'xpndr'], category: 'model' },
  { indonesian: 'pajero', english: 'pajero', synonyms: ['paj', 'pajer'], category: 'model' },
  { indonesian: 'l300', english: 'l300', synonyms: ['l 300'], category: 'model' },
  { indonesian: 'eclipse', english: 'eclipse', synonyms: ['eclips'], category: 'model' },

  // Nissan
  { indonesian: 'livina', english: 'livina', synonyms: ['liv', 'grand livina'], category: 'model' },
  { indonesian: 'serena', english: 'serena', synonyms: ['ser'], category: 'model' },
  { indonesian: 'x-trail', english: 'x-trail', synonyms: ['xtrail', 'x trail'], category: 'model' },

  // Wuling
  { indonesian: 'confero', english: 'confero', synonyms: ['conf'], category: 'model' },
  { indonesian: 'cortez', english: 'cortez', synonyms: ['cort'], category: 'model' },
  { indonesian: 'almaz', english: 'almaz', synonyms: ['alm'], category: 'model' },
];

// ============================================================================
// Transmission Types
// ============================================================================

export const TRANSMISSION_TERMS: AutomotiveTerm[] = [
  {
    indonesian: 'manual',
    english: 'manual',
    synonyms: ['manual transmission', 'mt', 'm/t'],
    category: 'transmission',
  },
  {
    indonesian: 'matic',
    english: 'automatic',
    synonyms: ['matik', 'otomatis', 'automatic', 'at', 'a/t', 'auto'],
    category: 'transmission',
    variations: ['matic', 'matik', 'otomatis'],
  },
  {
    indonesian: 'cvt',
    english: 'cvt',
    synonyms: ['continuously variable transmission'],
    category: 'transmission',
  },
];

// ============================================================================
// Fuel Types
// ============================================================================

export const FUEL_TYPE_TERMS: AutomotiveTerm[] = [
  {
    indonesian: 'bensin',
    english: 'gasoline',
    synonyms: ['petrol', 'gas', 'premium', 'pertalite', 'pertamax'],
    category: 'fuel',
  },
  {
    indonesian: 'diesel',
    english: 'diesel',
    synonyms: ['solar', 'pertamina dex', 'dex'],
    category: 'fuel',
  },
  {
    indonesian: 'hybrid',
    english: 'hybrid',
    synonyms: ['hybird', 'hibrid'],
    category: 'fuel',
  },
  {
    indonesian: 'listrik',
    english: 'electric',
    synonyms: ['elektrik', 'electric', 'ev', 'electric vehicle'],
    category: 'fuel',
  },
];

// ============================================================================
// Colors
// ============================================================================

export const COLOR_TERMS: AutomotiveTerm[] = [
  {
    indonesian: 'putih',
    english: 'white',
    synonyms: ['white', 'putih mutiara', 'pearl white'],
    category: 'color',
  },
  {
    indonesian: 'hitam',
    english: 'black',
    synonyms: ['black', 'hitam metalik'],
    category: 'color',
  },
  {
    indonesian: 'silver',
    english: 'silver',
    synonyms: ['perak', 'silver metalik'],
    category: 'color',
  },
  {
    indonesian: 'abu-abu',
    english: 'gray',
    synonyms: ['grey', 'gray', 'abu', 'abu abu'],
    category: 'color',
  },
  {
    indonesian: 'merah',
    english: 'red',
    synonyms: ['red', 'merah marun', 'maroon'],
    category: 'color',
  },
  {
    indonesian: 'biru',
    english: 'blue',
    synonyms: ['blue', 'biru metalik', 'biru tua', 'navy'],
    category: 'color',
  },
  {
    indonesian: 'kuning',
    english: 'yellow',
    synonyms: ['yellow', 'kuning'],
    category: 'color',
  },
  {
    indonesian: 'hijau',
    english: 'green',
    synonyms: ['green', 'hijau tua'],
    category: 'color',
  },
  {
    indonesian: 'coklat',
    english: 'brown',
    synonyms: ['brown', 'cokelat'],
    category: 'color',
  },
  {
    indonesian: 'emas',
    english: 'gold',
    synonyms: ['gold', 'golden'],
    category: 'color',
  },
];

// ============================================================================
// Vehicle Features
// ============================================================================

export const FEATURE_TERMS: AutomotiveTerm[] = [
  {
    indonesian: 'ac double blower',
    english: 'dual ac',
    synonyms: ['ac ganda', 'dual air conditioner', 'ac 2 baris'],
    category: 'feature',
  },
  {
    indonesian: 'power steering',
    english: 'power steering',
    synonyms: ['ps', 'stir power', 'elektrik steering'],
    category: 'feature',
  },
  {
    indonesian: 'power window',
    english: 'power window',
    synonyms: ['pw', 'kaca elektrik', 'electric window'],
    category: 'feature',
  },
  {
    indonesian: 'airbag',
    english: 'airbag',
    synonyms: ['air bag', 'kantung udara'],
    category: 'feature',
  },
  {
    indonesian: 'abs',
    english: 'abs',
    synonyms: ['anti lock braking', 'rem abs'],
    category: 'feature',
  },
  {
    indonesian: 'cruise control',
    english: 'cruise control',
    synonyms: ['cc', 'cruize control'],
    category: 'feature',
  },
  {
    indonesian: 'sunroof',
    english: 'sunroof',
    synonyms: ['sun roof', 'atap kaca', 'panoramic roof'],
    category: 'feature',
  },
  {
    indonesian: 'leather seats',
    english: 'leather seats',
    synonyms: ['jok kulit', 'kursi kulit', 'leather interior'],
    category: 'feature',
  },
  {
    indonesian: 'alloy wheels',
    english: 'alloy wheels',
    synonyms: ['velg racing', 'racing wheels', 'velg alloy'],
    category: 'feature',
  },
];

// ============================================================================
// Vehicle Status
// ============================================================================

export const STATUS_TERMS: AutomotiveTerm[] = [
  {
    indonesian: 'tersedia',
    english: 'available',
    synonyms: ['available', 'ada', 'ready', 'siap'],
    category: 'status',
  },
  {
    indonesian: 'terjual',
    english: 'sold',
    synonyms: ['sold', 'laku', 'sudah terjual'],
    category: 'status',
  },
  {
    indonesian: 'booking',
    english: 'booked',
    synonyms: ['booked', 'dipesan', 'reserved', 'direserve'],
    category: 'status',
  },
];

// ============================================================================
// General Automotive Terms
// ============================================================================

export const GENERAL_TERMS: AutomotiveTerm[] = [
  {
    indonesian: 'mobil',
    english: 'car',
    synonyms: ['kendaraan', 'vehicle', 'unit', 'otomotif'],
    category: 'general',
  },
  {
    indonesian: 'bekas',
    english: 'used',
    synonyms: ['second', 'seken', 'second hand', 'secondhand'],
    category: 'general',
  },
  {
    indonesian: 'baru',
    english: 'new',
    synonyms: ['brand new'],
    category: 'general',
  },
  {
    indonesian: 'kilometer',
    english: 'kilometer',
    synonyms: ['km', 'odometer', 'jarak tempuh'],
    category: 'general',
  },
  {
    indonesian: 'tahun',
    english: 'year',
    synonyms: ['thn', 'taun'],
    category: 'general',
  },
  {
    indonesian: 'harga',
    english: 'price',
    synonyms: ['biaya', 'cost', 'tarif'],
    category: 'general',
  },
  {
    indonesian: 'diskon',
    english: 'discount',
    synonyms: ['discount', 'potongan', 'promo', 'promosi'],
    category: 'general',
  },
  {
    indonesian: 'pajak',
    english: 'tax',
    synonyms: ['tax', 'stnk', 'bpkb'],
    category: 'general',
  },
  {
    indonesian: 'showroom',
    english: 'showroom',
    synonyms: ['dealer', 'diler', 'toko mobil', 'gallery'],
    category: 'general',
  },
];

// ============================================================================
// Seasonal & Cultural Terms
// ============================================================================

export const SEASONAL_TERMS: AutomotiveTerm[] = [
  {
    indonesian: 'ramadhan',
    english: 'ramadan',
    synonyms: ['ramadan', 'puasa', 'fasting month'],
    category: 'general',
  },
  {
    indonesian: 'lebaran',
    english: 'eid',
    synonyms: ['eid', 'idul fitri', 'hari raya'],
    category: 'general',
  },
  {
    indonesian: 'tahun baru',
    english: 'new year',
    synonyms: ['new year', 'new years'],
    category: 'general',
  },
  {
    indonesian: 'harbolnas',
    english: 'national shopping day',
    synonyms: ['hari belanja nasional', '12.12', '11.11'],
    category: 'general',
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all terms as a single array
 */
export function getAllTerms(): AutomotiveTerm[] {
  return [
    ...INDONESIAN_MAKES,
    ...INDONESIAN_MODELS,
    ...TRANSMISSION_TERMS,
    ...FUEL_TYPE_TERMS,
    ...COLOR_TERMS,
    ...FEATURE_TERMS,
    ...STATUS_TERMS,
    ...GENERAL_TERMS,
    ...SEASONAL_TERMS,
  ];
}

/**
 * Find term by Indonesian or English word
 */
export function findTerm(word: string): AutomotiveTerm | undefined {
  const normalizedWord = word.toLowerCase();
  const allTerms = getAllTerms();

  return allTerms.find(term =>
    term.indonesian === normalizedWord ||
    term.english === normalizedWord ||
    term.synonyms.some(syn => syn.toLowerCase() === normalizedWord) ||
    term.variations?.some(v => v.toLowerCase() === normalizedWord)
  );
}

/**
 * Get terms by category
 */
export function getTermsByCategory(category: AutomotiveTerm['category']): AutomotiveTerm[] {
  return getAllTerms().filter(term => term.category === category);
}

/**
 * Normalize Indonesian automotive text
 */
export function normalizeAutomotiveText(text: string): string {
  let normalized = text.toLowerCase();

  // Replace common abbreviations
  const allTerms = getAllTerms();
  allTerms.forEach(term => {
    term.synonyms.forEach(synonym => {
      const regex = new RegExp(`\\b${synonym}\\b`, 'gi');
      normalized = normalized.replace(regex, term.indonesian);
    });
  });

  return normalized;
}
