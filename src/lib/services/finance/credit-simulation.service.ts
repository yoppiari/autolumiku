/**
 * Credit Simulation Service (KKB)
 * -------------------------------------------------------------
 * Provider-pluggable credit simulation for used-car financing.
 *
 * Adopted from the partner finance APIs (study: docs/GAP_ANALYSIS_AND_ROADMAP.md):
 *   - NCU / Dipostar "New Universal Calculator"  -> grounded, accurate (insurance, admin fee, regional)
 *   - Local estimate (legacy homegrown flat-rate) -> labeled fallback only
 *
 * Philosophy (matches MotoVax "remove fabricated fallback; ground all finance answers"):
 *   Prefer a real provider when configured. The local estimate is clearly marked
 *   "[ESTIMASI]" so the AI never presents guessed numbers as authoritative.
 *
 * Configuration (env):
 *   CREDIT_SIM_PROVIDER   = "ncu" | "local" | "auto"   (default: "auto")
 *   NCU_BASE_URL          = https://simulation.dipostar.com  (QA: https://qasimulation.dipostar.org)
 *   NCU_BEARER_TOKEN      = <token from provider>
 *   NCU_DEFAULT_CITY      = JAKARTA PUSAT   (NCU requires City)
 *   NCU_DEFAULT_PROVINCE  = DKI JAKARTA
 *   NCU_ADMIN_FEE         = 3300000
 *   NCU_BEA_POLIS         = 25000
 */

export type SimulationType = 'TDP' | 'DP' | 'INSTALLMENT';

export interface CreditSimInput {
  vehiclePrice: number;          // OTR price (Rupiah)
  vehicleYear?: number;
  city?: string;
  province?: string;
  vehicleType?: 'PC' | 'CV' | 'BUS';
  /** Down-payment percentages to simulate (e.g. [25, 30]) */
  dpPercentages?: number[];
  /** Explicit DP amount (overrides percentage if given) */
  dpAmount?: number | null;
  /** Tenors in YEARS (e.g. [3, 4, 5]) — converted to months for providers */
  tenorsYears?: number[];
  paymentType?: 'ADDM' | 'ADDB';
}

export interface CreditSimTenorResult {
  tenorMonths: number;
  tenorYears: number;
  downPayment: number;
  downPaymentPercentage: number;
  totalLoan: number;
  installmentAmount: number;
  totalDownPayment?: number;     // TDP (uang muka + angsuran 1 + biaya2)
  interestRatePctFlatPerYear?: number;
  disclaimer?: string[];
}

export interface CreditSimResult {
  provider: 'ncu' | 'local';
  grounded: boolean;             // true = from real provider; false = estimate
  vehiclePrice: number;
  vehicleYear?: number;
  results: CreditSimTenorResult[];
  notes?: string[];
}

// ==================== PROVIDER SELECTION ====================

function selectedProvider(): 'ncu' | 'local' {
  const cfg = (process.env.CREDIT_SIM_PROVIDER || 'auto').toLowerCase();
  if (cfg === 'ncu') return 'ncu';
  if (cfg === 'local') return 'local';
  // auto: use NCU only when fully configured
  return isNcuConfigured() ? 'ncu' : 'local';
}

export function isNcuConfigured(): boolean {
  return Boolean(process.env.NCU_BASE_URL && process.env.NCU_BEARER_TOKEN);
}

export function getProviderStatus() {
  return {
    selected: selectedProvider(),
    ncuConfigured: isNcuConfigured(),
    configMode: (process.env.CREDIT_SIM_PROVIDER || 'auto').toLowerCase(),
  };
}

// ==================== PUBLIC API ====================

/**
 * Run a credit simulation. Never throws on provider failure —
 * falls back to the local estimate and records the reason in `notes`.
 */
export async function simulateCredit(input: CreditSimInput): Promise<CreditSimResult> {
  const provider = selectedProvider();

  if (provider === 'ncu') {
    try {
      return await simulateWithNcu(input);
    } catch (err: any) {
      console.error('[CreditSim] NCU failed, falling back to local estimate:', err?.message);
      const local = simulateLocal(input);
      local.notes = [
        ...(local.notes || []),
        `Provider akurat (NCU) gagal dihubungi (${err?.message || 'error'}); menampilkan estimasi.`,
      ];
      return local;
    }
  }

  return simulateLocal(input);
}

// ==================== NCU PROVIDER ====================

const NCU_DEFAULTS = {
  city: () => process.env.NCU_DEFAULT_CITY || 'JAKARTA PUSAT',
  province: () => process.env.NCU_DEFAULT_PROVINCE || 'DKI JAKARTA',
  adminFee: () => Number(process.env.NCU_ADMIN_FEE || 3300000),
  beaPolis: () => Number(process.env.NCU_BEA_POLIS || 25000),
};

async function simulateWithNcu(input: CreditSimInput): Promise<CreditSimResult> {
  const baseUrl = (process.env.NCU_BASE_URL || '').replace(/\/+$/, '');
  const token = process.env.NCU_BEARER_TOKEN || '';
  if (!baseUrl || !token) throw new Error('NCU not configured');

  const tenorsYears = input.tenorsYears?.length ? input.tenorsYears : [3, 4, 5];
  const dpPercentages = input.dpPercentages?.length
    ? input.dpPercentages
    : input.dpAmount
      ? [Math.round((input.dpAmount / input.vehiclePrice) * 100)]
      : [25];

  const results: CreditSimTenorResult[] = [];

  // NCU computes one (tenor, DP) at a time via /api/calculator/tenor
  for (const dpPerc of dpPercentages) {
    for (const tenorYears of tenorsYears) {
      const body = buildNcuBody(input, dpPerc, tenorYears * 12);
      const res = await fetch(`${baseUrl}/api/calculator/tenor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
        // 30s budget — finance calls must not hang the WA reply
        signal: AbortSignal.timeout(Number(process.env.NCU_TIMEOUT_MS || 30000)),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`NCU ${res.status}: ${text.slice(0, 200)}`);
      }

      const json: any = await res.json();
      const d = json?.data || {};
      results.push({
        tenorMonths: Number(d.Tenor ?? tenorYears * 12),
        tenorYears,
        downPayment: Number(d.DownPayment ?? 0),
        downPaymentPercentage: Number(d.DownPaymentPercentage ?? dpPerc),
        totalLoan: Number(d.TotalLoan ?? 0),
        installmentAmount: Number(d.TotalRoundedInstallment ?? d.InstallmentAmount ?? 0),
        totalDownPayment: Number(d.TotalRoundedDownPayment ?? 0) || undefined,
        disclaimer: Array.isArray(d.Disclaimer) ? d.Disclaimer : undefined,
      });
    }
  }

  return {
    provider: 'ncu',
    grounded: true,
    vehiclePrice: input.vehiclePrice,
    vehicleYear: input.vehicleYear,
    results,
  };
}

function buildNcuBody(input: CreditSimInput, dpPercentage: number, tenorInMonths: number) {
  // SimulationType TDP with SimulationValue = DP amount derived from percentage.
  const dpAmount = input.dpAmount ?? Math.round(input.vehiclePrice * (dpPercentage / 100));
  return {
    UnitPrice: input.vehiclePrice,
    Province: input.province || NCU_DEFAULTS.province(),
    City: input.city || NCU_DEFAULTS.city(),
    Brand: '',
    Model: '',
    Variant: '',
    VehicleType: input.vehicleType || 'PC',
    ManufacturedYear: String(input.vehicleYear || new Date().getFullYear()),
    LoanPackageName: '',
    PaymentType: input.paymentType || 'ADDM',
    Insurances: {
      VehicleType: input.vehicleType || 'PC',
      InsuranceType: 'All Risk',
      AdditionalInsurances: [],
      LifeInsurance: 'no',
      TanggungJawabPihakKetiga: { IsApplied: 'no', UangPertanggungan: 0 },
      PutAsOnLoan: 'yes',
    },
    Fee: {
      BeaPolis: NCU_DEFAULTS.beaPolis(),
      AdminFee: NCU_DEFAULTS.adminFee(),
    },
    ProvisionPercentage: 0,
    TenorInMonths: tenorInMonths,
    SimulationType: 'TDP',
    SimulationValue: dpAmount,
  };
}

// ==================== LOCAL ESTIMATE (labeled fallback) ====================

/**
 * Homegrown flat-rate estimate. Kept ONLY as a clearly-labeled fallback.
 * Numbers are approximate and must be presented as "[ESTIMASI]".
 */
export function simulateLocal(input: CreditSimInput): CreditSimResult {
  const dpPercentages = (input.dpPercentages?.length
    ? input.dpPercentages
    : input.dpAmount
      ? [Math.round((input.dpAmount / input.vehiclePrice) * 100)]
      : [25]
  ).slice().sort((a, b) => a - b);

  const tenorsYears = (input.tenorsYears?.length ? input.tenorsYears : [3, 4, 5])
    .slice()
    .sort((a, b) => a - b);

  // Estimated flat rates/year for used cars (average across common leasing partners)
  const avgRatesByTenor = [7.3, 8.25, 8.9, 9.7, 10.7]; // index = tenor year - 1
  let ageRateAdjustment = 0;
  if (input.vehicleYear) {
    const age = new Date().getFullYear() - input.vehicleYear;
    if (age > 5) ageRateAdjustment = Math.min((age - 5) * 0.5, 3.0);
  }

  const results: CreditSimTenorResult[] = [];
  for (const dpPerc of dpPercentages) {
    const dpAmt = input.vehiclePrice * (dpPerc / 100);
    const principal = input.vehiclePrice - dpAmt;
    for (const tenorYears of tenorsYears) {
      const baseRate = avgRatesByTenor[Math.min(tenorYears - 1, avgRatesByTenor.length - 1)] || 9;
      const finalRate = baseRate + ageRateAdjustment;
      const totalInterest = principal * (finalRate / 100) * tenorYears;
      const monthly = (principal + totalInterest) / (tenorYears * 12);
      results.push({
        tenorMonths: tenorYears * 12,
        tenorYears,
        downPayment: Math.round(dpAmt),
        downPaymentPercentage: dpPerc,
        totalLoan: Math.round(principal),
        installmentAmount: Math.round(monthly),
        interestRatePctFlatPerYear: Number(finalRate.toFixed(1)),
      });
    }
  }

  return {
    provider: 'local',
    grounded: false,
    vehiclePrice: input.vehiclePrice,
    vehicleYear: input.vehicleYear,
    results,
    notes: ['Estimasi internal (bukan dari mitra pembiayaan resmi).'],
  };
}

// ==================== FORMATTING ====================

const formatRp = (num: number) => 'Rp ' + Math.round(num).toLocaleString('id-ID');

/**
 * Format a simulation result into WhatsApp-friendly Indonesian text.
 */
export function formatSimulationText(
  sim: CreditSimResult,
  options?: { hideSyarat?: boolean; hideTitle?: boolean }
): string {
  const label = sim.grounded ? '' : ' [ESTIMASI]';
  let out = options?.hideTitle ? '' : `📊 *SIMULASI KREDIT (KKB)${label}*\n`;
  out += `Harga Mobil: ${formatRp(sim.vehiclePrice)}\n`;
  if (sim.vehicleYear) out += `Tahun: ${sim.vehicleYear}\n`;

  // Group by DP percentage for readability
  const byDp = new Map<number, CreditSimTenorResult[]>();
  for (const r of sim.results) {
    const arr = byDp.get(r.downPaymentPercentage) || [];
    arr.push(r);
    byDp.set(r.downPaymentPercentage, arr);
  }

  const multiDp = byDp.size > 1;
  for (const [dpPerc, rows] of Array.from(byDp.entries()).sort((a, b) => a[0] - b[0])) {
    if (multiDp) out += `\n--- *OPSI DP ${dpPerc}%* ---\n`;
    out += `DP (${dpPerc}%): ${formatRp(rows[0].downPayment)}\n`;
    if (rows[0].totalDownPayment) out += `Total DP: ${formatRp(rows[0].totalDownPayment)}\n`;
    out += `Pokok Hutang: ${formatRp(rows[0].totalLoan)}\n`;
    out += `\n*Angsuran per Bulan:*\n`;
    for (const r of rows.sort((a, b) => a.tenorYears - b.tenorYears)) {
      out += `\n🕒 *Tenor ${r.tenorYears} Tahun (${r.tenorMonths} bln)*\n`;
      out += `• Angsuran: ${formatRp(r.installmentAmount)}\n`;
      if (r.interestRatePctFlatPerYear) out += `• Bunga Est: ${r.interestRatePctFlatPerYear}% flat/thn\n`;
    }
  }

  if (sim.notes?.length) out += `\nℹ️ ${sim.notes.join(' ')}`;
  if (!options?.hideSyarat) {
    out += `\n\n📝 *Syarat Kredit:* KTP Suami Istri, KK, NPWP, PBB/AJB, Mutasi Rek 3 Bln.`;
  }
  return out;
}
