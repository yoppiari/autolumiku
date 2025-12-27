/**
 * Invoice Detail Page
 * Shows invoice details, payments, and actions
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { FaArrowLeft, FaPlus, FaBan, FaPrint, FaCheckCircle } from 'react-icons/fa';
import { SalesInvoice, INVOICE_STATUS, PAYMENT_METHODS, formatRupiah, formatDate, formatDateTime } from '@/types/invoice';

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<SalesInvoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userRoleLevel, setUserRoleLevel] = useState(30);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showVoidModal, setShowVoidModal] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      setUserRoleLevel(user.roleLevel || 30);
    }
    loadInvoice();
  }, [params.id]);

  const loadInvoice = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/v1/sales-invoices/${params.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setInvoice(data.data);
      }
    } catch (error) {
      console.error('Error loading invoice:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const canRecordPayment = userRoleLevel >= 60 && invoice?.status !== 'paid' && invoice?.status !== 'void';
  const canVoid = userRoleLevel >= 70 && invoice?.status !== 'void';
  const canExport = userRoleLevel >= 70;

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Invoice tidak ditemukan</p>
        <Link href="/dashboard/invoices" className="text-blue-600 hover:underline mt-2 inline-block">
          Kembali ke daftar invoice
        </Link>
      </div>
    );
  }

  const remainingAmount = invoice.grandTotal - invoice.paidAmount;

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/invoices"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FaArrowLeft className="text-gray-600" />
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">{invoice.invoiceNumber}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${INVOICE_STATUS[invoice.status]?.color}`}>
                {INVOICE_STATUS[invoice.status]?.label}
              </span>
              <span className="text-sm text-gray-500">{formatDate(invoice.invoiceDate)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4 md:mt-0">
          {canRecordPayment && (
            <button
              onClick={() => setShowPaymentModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
            >
              <FaPlus className="text-xs" />
              Catat Pembayaran
            </button>
          )}
          {canVoid && (
            <button
              onClick={() => setShowVoidModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 text-sm font-medium"
            >
              <FaBan className="text-xs" />
              Batalkan
            </button>
          )}
          {canExport && (
            <button className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">
              <FaPrint className="text-xs" />
              Cetak
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer & Vehicle Info */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Customer */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Informasi Customer</h3>
                <div className="space-y-2">
                  <p className="text-sm"><span className="text-gray-500">Nama:</span> <span className="font-medium">{invoice.customer?.name}</span></p>
                  <p className="text-sm"><span className="text-gray-500">Telepon:</span> {invoice.customer?.phone}</p>
                  {invoice.customer?.email && (
                    <p className="text-sm"><span className="text-gray-500">Email:</span> {invoice.customer?.email}</p>
                  )}
                  {invoice.customer?.address && (
                    <p className="text-sm"><span className="text-gray-500">Alamat:</span> {invoice.customer?.address}</p>
                  )}
                  {invoice.customer?.nik && (
                    <p className="text-sm"><span className="text-gray-500">NIK:</span> {invoice.customer?.nik}</p>
                  )}
                </div>
              </div>

              {/* Vehicle */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Informasi Kendaraan</h3>
                <div className="space-y-2">
                  <p className="text-sm"><span className="text-gray-500">Kendaraan:</span> <span className="font-medium">{invoice.vehicleMake} {invoice.vehicleModel}</span></p>
                  <p className="text-sm"><span className="text-gray-500">Tahun:</span> {invoice.vehicleYear}</p>
                  <p className="text-sm"><span className="text-gray-500">Warna:</span> {invoice.vehicleColor}</p>
                  <p className="text-sm"><span className="text-gray-500">Plat:</span> {invoice.vehiclePlateNumber || '-'}</p>
                  <p className="text-sm"><span className="text-gray-500">No. Rangka:</span> {invoice.vehicleFrameNumber || '-'}</p>
                  <p className="text-sm"><span className="text-gray-500">No. Mesin:</span> {invoice.vehicleEngineNumber || '-'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Rincian Harga</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Harga Kendaraan</span>
                <span>{formatRupiah(invoice.vehiclePrice)}</span>
              </div>
              {invoice.discountAmount > 0 && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>Diskon {invoice.discountNote && `(${invoice.discountNote})`}</span>
                  <span>-{formatRupiah(invoice.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm border-t pt-2">
                <span className="text-gray-500">DPP</span>
                <span>{formatRupiah(invoice.dpp)}</span>
              </div>
              {invoice.adminFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Biaya Admin</span>
                  <span>{formatRupiah(invoice.adminFee)}</span>
                </div>
              )}
              {invoice.transferFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Biaya Balik Nama</span>
                  <span>{formatRupiah(invoice.transferFee)}</span>
                </div>
              )}
              {invoice.otherFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Biaya Lain {invoice.otherFeeNote && `(${invoice.otherFeeNote})`}</span>
                  <span>{formatRupiah(invoice.otherFee)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold border-t pt-2 mt-2">
                <span>Grand Total</span>
                <span>{formatRupiah(invoice.grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Credit Details */}
          {invoice.paymentMethod === 'credit' && invoice.creditDetail && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Detail Kredit</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm"><span className="text-gray-500">Leasing:</span> <span className="font-medium">{invoice.creditDetail.leasingPartner?.name}</span></p>
                  <p className="text-sm"><span className="text-gray-500">DP:</span> {formatRupiah(invoice.creditDetail.dpAmount)} ({invoice.creditDetail.dpPercent}%)</p>
                  <p className="text-sm"><span className="text-gray-500">Pokok Hutang:</span> {formatRupiah(invoice.creditDetail.principalAmount)}</p>
                </div>
                <div>
                  <p className="text-sm"><span className="text-gray-500">Tenor:</span> {invoice.creditDetail.tenor} bulan</p>
                  <p className="text-sm"><span className="text-gray-500">Bunga:</span> {invoice.creditDetail.interestRate}% ({invoice.creditDetail.interestType})</p>
                  <p className="text-sm"><span className="text-gray-500">Angsuran:</span> {formatRupiah(invoice.creditDetail.monthlyInstallment)}/bulan</p>
                </div>
              </div>
            </div>
          )}

          {/* Payment History */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Riwayat Pembayaran</h3>
            {invoice.payments && invoice.payments.length > 0 ? (
              <div className="space-y-3">
                {invoice.payments.map((payment, idx) => (
                  <div key={payment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <FaCheckCircle className="text-green-600 text-sm" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Pembayaran #{payment.paymentNumber}</p>
                        <p className="text-xs text-gray-500">
                          {formatDateTime(payment.receivedAt)} - {payment.method === 'transfer' ? `Transfer ${payment.bankName || ''}` : payment.method}
                        </p>
                        {payment.referenceNumber && (
                          <p className="text-xs text-gray-400">Ref: {payment.referenceNumber}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-sm font-bold text-green-600">{formatRupiah(payment.amount)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">Belum ada pembayaran</p>
            )}
          </div>
        </div>

        {/* Right Column - Summary */}
        <div className="space-y-6">
          {/* Payment Summary */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Ringkasan Pembayaran</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Metode</span>
                <span className="text-sm font-medium">{PAYMENT_METHODS[invoice.paymentMethod]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Total Tagihan</span>
                <span className="text-sm font-bold">{formatRupiah(invoice.grandTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Terbayar</span>
                <span className="text-sm font-medium text-green-600">{formatRupiah(invoice.paidAmount)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t">
                <span className="text-sm font-medium">Sisa Tagihan</span>
                <span className={`text-sm font-bold ${remainingAmount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatRupiah(remainingAmount)}
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Progress</span>
                <span>{Math.round((invoice.paidAmount / invoice.grandTotal) * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (invoice.paidAmount / invoice.grandTotal) * 100)}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Tanggal</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Invoice</span>
                <span>{formatDate(invoice.invoiceDate)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Jatuh Tempo</span>
                <span>{formatDate(invoice.dueDate)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Dibuat</span>
                <span>{formatDateTime(invoice.createdAt)}</span>
              </div>
              {invoice.lockedAt && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Dikunci</span>
                  <span>{formatDateTime(invoice.lockedAt)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Catatan</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}

          {/* Void Info */}
          {invoice.status === 'void' && (
            <div className="bg-red-50 rounded-lg border border-red-200 p-4">
              <h3 className="text-sm font-semibold text-red-700 mb-2">Invoice Dibatalkan</h3>
              <p className="text-sm text-red-600">{invoice.voidReason || 'Tidak ada alasan'}</p>
              {invoice.voidedAt && (
                <p className="text-xs text-red-500 mt-1">Dibatalkan pada {formatDateTime(invoice.voidedAt)}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal - Simple inline for now */}
      {showPaymentModal && (
        <PaymentModal
          invoice={invoice}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => {
            setShowPaymentModal(false);
            loadInvoice();
          }}
        />
      )}

      {/* Void Modal */}
      {showVoidModal && (
        <VoidModal
          invoice={invoice}
          onClose={() => setShowVoidModal(false)}
          onSuccess={() => {
            setShowVoidModal(false);
            loadInvoice();
          }}
        />
      )}
    </div>
  );
}

// Payment Modal Component
function PaymentModal({ invoice, onClose, onSuccess }: { invoice: SalesInvoice; onClose: () => void; onSuccess: () => void }) {
  const [amount, setAmount] = useState(invoice.grandTotal - invoice.paidAmount);
  const [method, setMethod] = useState('transfer');
  const [bankName, setBankName] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/v1/sales-invoices/${invoice.id}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount,
          method,
          bankName: method === 'transfer' ? bankName : undefined,
          referenceNumber: method === 'transfer' ? referenceNumber : undefined,
          receivedAt: new Date().toISOString(),
        }),
      });

      const data = await response.json();
      if (data.success) {
        onSuccess();
      } else {
        alert(data.error || 'Gagal mencatat pembayaran');
      }
    } catch (error) {
      console.error('Error recording payment:', error);
      alert('Terjadi kesalahan');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Catat Pembayaran</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
              min={1}
              max={invoice.grandTotal - invoice.paidAmount}
            />
            <p className="text-xs text-gray-500 mt-1">Sisa: {formatRupiah(invoice.grandTotal - invoice.paidAmount)}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Metode</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="cash">Tunai</option>
              <option value="transfer">Transfer Bank</option>
              <option value="check">Cek/Giro</option>
            </select>
          </div>

          {method === 'transfer' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Bank</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="BCA, Mandiri, BNI..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">No. Referensi</label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="No. transaksi / bukti transfer"
                />
              </div>
            </>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Void Modal Component
function VoidModal({ invoice, onClose, onSuccess }: { invoice: SalesInvoice; onClose: () => void; onSuccess: () => void }) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      alert('Alasan pembatalan wajib diisi');
      return;
    }

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/v1/sales-invoices/${invoice.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ voidReason: reason }),
      });

      const data = await response.json();
      if (data.success) {
        onSuccess();
      } else {
        alert(data.error || 'Gagal membatalkan invoice');
      }
    } catch (error) {
      console.error('Error voiding invoice:', error);
      alert('Terjadi kesalahan');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-lg font-bold text-red-600 mb-4">Batalkan Invoice</h2>
        <p className="text-sm text-gray-600 mb-4">
          Anda akan membatalkan invoice <strong>{invoice.invoiceNumber}</strong>. Aksi ini tidak dapat dibatalkan.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Alasan Pembatalan *</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              rows={3}
              required
              placeholder="Jelaskan alasan pembatalan..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Kembali
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Memproses...' : 'Batalkan Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
