/**
 * Invoice Types for Prima Mobil Sales System
 */

// Status colors and labels
export const INVOICE_STATUS = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-800' },
  unpaid: { label: 'Belum Bayar', color: 'bg-red-100 text-red-800' },
  partial: { label: 'Sebagian', color: 'bg-yellow-100 text-yellow-800' },
  paid: { label: 'Lunas', color: 'bg-green-100 text-green-800' },
  void: { label: 'Batal', color: 'bg-slate-100 text-slate-800' },
} as const;

export type InvoiceStatus = keyof typeof INVOICE_STATUS;

export const PAYMENT_METHODS = {
  cash: 'Tunai',
  transfer: 'Transfer Bank',
  credit: 'Kredit/Leasing',
} as const;

export type PaymentMethod = keyof typeof PAYMENT_METHODS;

// Customer
export interface SalesCustomer {
  id: string;
  tenantId: string;
  name: string;
  type: 'individual' | 'company';
  phone: string;
  email?: string | null;
  address?: string | null;
  nik?: string | null;
  npwp?: string | null;
  source?: string | null;
  isActive: boolean;
  createdAt: string;
}

// Leasing Partner
export interface LeasingPartner {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  interestRateMin: number;
  interestRateMax: number;
  interestType: 'flat' | 'effective';
  tenorOptions: string;
  dpMinPercent: number;
  adminFee: number;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  isActive: boolean;
}

// Credit Detail
export interface SalesInvoiceCreditDetail {
  id: string;
  invoiceId: string;
  leasingPartnerId: string;
  leasingPartner?: LeasingPartner;
  dpAmount: number;
  dpPercent: number;
  principalAmount: number;
  tenor: number;
  interestRate: number;
  interestType: 'flat' | 'effective';
  monthlyInstallment: number;
  totalInterest: number;
  totalPayment: number;
  leasingApprovalNumber?: string | null;
  approvalDate?: string | null;
  disbursementDate?: string | null;
}

// Payment
export interface SalesInvoicePayment {
  id: string;
  invoiceId: string;
  paymentNumber: number;
  amount: number;
  method: 'cash' | 'transfer' | 'check' | 'leasing_disbursement';
  paymentType: 'dp' | 'installment' | 'settlement' | 'regular';
  bankName?: string | null;
  accountNumber?: string | null;
  referenceNumber?: string | null;
  proofUrl?: string | null;
  receivedAt: string;
  receivedBy?: string | null;
  notes?: string | null;
  createdAt: string;
}

// Commission
export interface SalesCommission {
  id: string;
  tenantId: string;
  invoiceId: string;
  salesUserId: string;
  calculationType: 'fixed' | 'percentage_price';
  baseAmount: number;
  rate?: number | null;
  commissionAmount: number;
  bonusAmount: number;
  totalAmount: number;
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  paidAt?: string | null;
}

// Audit Log
export interface SalesInvoiceAuditLog {
  id: string;
  invoiceId: string;
  action: string;
  field?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  performedBy: string;
  performedAt: string;
}

// Main Invoice
export interface SalesInvoice {
  id: string;
  tenantId: string;
  invoiceNumber: string;
  customerId: string;
  customer?: SalesCustomer;
  vehicleId?: string | null;
  salesUserId?: string | null;
  invoiceDate: string;
  dueDate: string;

  // Vehicle snapshot
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vehicleYear?: number | null;
  vehicleColor?: string | null;
  vehiclePlateNumber?: string | null;
  vehicleFrameNumber?: string | null;
  vehicleEngineNumber?: string | null;
  vehicleMileage?: number | null;

  // Amounts
  vehiclePrice: number;
  discountAmount: number;
  discountNote?: string | null;
  dpp: number;
  ppnPercent: number;
  ppnAmount: number;
  ppnbmPercent: number;
  ppnbmAmount: number;
  adminFee: number;
  transferFee: number;
  otherFee: number;
  otherFeeNote?: string | null;
  grandTotal: number;
  paidAmount: number;

  // Payment
  paymentMethod: PaymentMethod;
  status: InvoiceStatus;

  // Void
  voidReason?: string | null;
  voidedAt?: string | null;
  voidedBy?: string | null;

  // Notes
  notes?: string | null;
  termsConditions?: string | null;

  // Lock
  lockedAt?: string | null;

  // Audit
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  updatedBy?: string | null;

  // Relations
  payments?: SalesInvoicePayment[];
  creditDetail?: SalesInvoiceCreditDetail | null;
  commission?: SalesCommission | null;
  auditLogs?: SalesInvoiceAuditLog[];
}

// Form types
export interface CreateInvoiceForm {
  customerId: string;
  vehicleId?: string;
  dueDate: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number;
  vehicleColor: string;
  vehiclePlateNumber: string;
  vehicleFrameNumber: string;
  vehicleEngineNumber: string;
  vehicleMileage?: number;
  vehiclePrice: number;
  discountAmount: number;
  discountNote?: string;
  adminFee: number;
  transferFee: number;
  otherFee: number;
  otherFeeNote?: string;
  paymentMethod: PaymentMethod;
  notes?: string;
  termsConditions?: string;
  // Credit fields (if credit)
  leasingPartnerId?: string;
  dpAmount?: number;
  tenor?: number;
  interestRate?: number;
}

export interface RecordPaymentForm {
  amount: number;
  method: 'cash' | 'transfer' | 'check' | 'leasing_disbursement';
  paymentType: 'dp' | 'installment' | 'settlement' | 'regular';
  bankName?: string;
  accountNumber?: string;
  referenceNumber?: string;
  proofUrl?: string;
  receivedAt: string;
  notes?: string;
}

// Utility
export const formatRupiah = (n: number): string =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

export const formatDate = (dateString: string): string =>
  new Date(dateString).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

export const formatDateTime = (dateString: string): string =>
  new Date(dateString).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
