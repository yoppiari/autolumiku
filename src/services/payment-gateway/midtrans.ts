/**
 * Midtrans Payment Gateway Integration
 * Indonesian payment gateway supporting:
 * - Bank Transfer (BCA, Mandiri, BNI, BRI)
 * - E-Wallets (GoPay, OVO, Dana, ShopeePay)
 * - Virtual Account
 * - Credit Card
 *
 * Part of Technical Debt Resolution - Story 1.6
 */

import { createLogger, format, transports } from 'winston';
import crypto from 'crypto';

const logger = createLogger({
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    }),
    new transports.File({ filename: 'logs/midtrans-error.log', level: 'error' }),
    new transports.File({ filename: 'logs/midtrans-combined.log' })
  ]
});

export interface MidtransConfig {
  serverKey: string;
  clientKey: string;
  isProduction: boolean;
}

export interface MidtransTransaction {
  order_id: string;
  gross_amount: number;
}

export interface MidtransCustomerDetails {
  first_name: string;
  last_name?: string;
  email: string;
  phone: string;
}

export interface MidtransItemDetails {
  id: string;
  price: number;
  quantity: number;
  name: string;
}

export interface MidtransChargeRequest {
  transaction_details: MidtransTransaction;
  customer_details: MidtransCustomerDetails;
  item_details: MidtransItemDetails[];
  payment_type: 'bank_transfer' | 'echannel' | 'gopay' | 'shopeepay' | 'credit_card' | 'qris';
  bank_transfer?: {
    bank: 'bca' | 'bni' | 'bri' | 'permata';
  };
  echannel?: {
    bill_info1: string;
    bill_info2: string;
  };
  gopay?: {
    enable_callback: boolean;
    callback_url: string;
  };
  custom_expiry?: {
    order_time: string;
    expiry_duration: number;
    unit: 'second' | 'minute' | 'hour' | 'day';
  };
}

export interface MidtransChargeResponse {
  status_code: string;
  status_message: string;
  transaction_id: string;
  order_id: string;
  merchant_id: string;
  gross_amount: string;
  currency: string;
  payment_type: string;
  transaction_time: string;
  transaction_status: 'pending' | 'settlement' | 'capture' | 'deny' | 'cancel' | 'expire' | 'failure';
  fraud_status?: 'accept' | 'deny' | 'challenge';

  // Bank Transfer specific
  va_numbers?: Array<{
    bank: string;
    va_number: string;
  }>;

  // Mandiri Bill specific
  bill_key?: string;
  biller_code?: string;

  // GoPay specific
  actions?: Array<{
    name: string;
    method: string;
    url: string;
  }>;

  // QR specific
  qr_string?: string;
}

export interface MidtransNotification {
  transaction_time: string;
  transaction_status: string;
  transaction_id: string;
  status_message: string;
  status_code: string;
  signature_key: string;
  payment_type: string;
  order_id: string;
  merchant_id: string;
  gross_amount: string;
  fraud_status?: string;
  currency: string;

  // Bank Transfer specific
  va_numbers?: Array<{
    bank: string;
    va_number: string;
  }>;

  // GoPay specific
  payment_code?: string;

  // Settlement specific
  settlement_time?: string;
}

export class MidtransService {
  private readonly config: MidtransConfig;
  private readonly baseUrl: string;
  private readonly snapUrl: string;

  constructor() {
    this.config = {
      serverKey: process.env.MIDTRANS_SERVER_KEY || '',
      clientKey: process.env.MIDTRANS_CLIENT_KEY || '',
      isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true'
    };

    this.baseUrl = this.config.isProduction
      ? 'https://api.midtrans.com'
      : 'https://api.sandbox.midtrans.com';

    this.snapUrl = this.config.isProduction
      ? 'https://app.midtrans.com/snap/v1'
      : 'https://app.sandbox.midtrans.com/snap/v1';

    if (!this.config.serverKey) {
      logger.warn('Midtrans server key not configured');
    }

    logger.info(`Midtrans initialized (${this.config.isProduction ? 'PRODUCTION' : 'SANDBOX'})`);
  }

  /**
   * Create bank transfer charge
   */
  async createBankTransferCharge(
    orderId: string,
    amount: number,
    bank: 'bca' | 'bni' | 'bri' | 'permata',
    customerDetails: MidtransCustomerDetails,
    itemDetails: MidtransItemDetails[]
  ): Promise<MidtransChargeResponse> {
    try {
      const chargeRequest: MidtransChargeRequest = {
        transaction_details: {
          order_id: orderId,
          gross_amount: amount
        },
        customer_details: customerDetails,
        item_details: itemDetails,
        payment_type: 'bank_transfer',
        bank_transfer: {
          bank
        },
        custom_expiry: {
          order_time: new Date().toISOString(),
          expiry_duration: 1,
          unit: 'day'
        }
      };

      const response = await this.charge(chargeRequest);

      logger.info(`Bank transfer charge created: ${orderId} - ${bank.toUpperCase()}`);

      return response;
    } catch (error) {
      logger.error('Error creating bank transfer charge:', error);
      throw error;
    }
  }

  /**
   * Create Mandiri Bill payment (e-channel)
   */
  async createMandiriBillCharge(
    orderId: string,
    amount: number,
    customerDetails: MidtransCustomerDetails,
    itemDetails: MidtransItemDetails[]
  ): Promise<MidtransChargeResponse> {
    try {
      const chargeRequest: MidtransChargeRequest = {
        transaction_details: {
          order_id: orderId,
          gross_amount: amount
        },
        customer_details: customerDetails,
        item_details: itemDetails,
        payment_type: 'echannel',
        echannel: {
          bill_info1: 'Payment for AutoLumiku',
          bill_info2: `Order: ${orderId}`
        }
      };

      const response = await this.charge(chargeRequest);

      logger.info(`Mandiri Bill charge created: ${orderId}`);

      return response;
    } catch (error) {
      logger.error('Error creating Mandiri Bill charge:', error);
      throw error;
    }
  }

  /**
   * Create GoPay charge
   */
  async createGoPayCharge(
    orderId: string,
    amount: number,
    customerDetails: MidtransCustomerDetails,
    itemDetails: MidtransItemDetails[],
    callbackUrl: string
  ): Promise<MidtransChargeResponse> {
    try {
      const chargeRequest: MidtransChargeRequest = {
        transaction_details: {
          order_id: orderId,
          gross_amount: amount
        },
        customer_details: customerDetails,
        item_details: itemDetails,
        payment_type: 'gopay',
        gopay: {
          enable_callback: true,
          callback_url: callbackUrl
        }
      };

      const response = await this.charge(chargeRequest);

      logger.info(`GoPay charge created: ${orderId}`);

      return response;
    } catch (error) {
      logger.error('Error creating GoPay charge:', error);
      throw error;
    }
  }

  /**
   * Create QRIS charge (supports GoPay, OVO, Dana, ShopeePay)
   */
  async createQRISCharge(
    orderId: string,
    amount: number,
    customerDetails: MidtransCustomerDetails,
    itemDetails: MidtransItemDetails[]
  ): Promise<MidtransChargeResponse> {
    try {
      const chargeRequest: MidtransChargeRequest = {
        transaction_details: {
          order_id: orderId,
          gross_amount: amount
        },
        customer_details: customerDetails,
        item_details: itemDetails,
        payment_type: 'qris'
      };

      const response = await this.charge(chargeRequest);

      logger.info(`QRIS charge created: ${orderId}`);

      return response;
    } catch (error) {
      logger.error('Error creating QRIS charge:', error);
      throw error;
    }
  }

  /**
   * Core charge method
   */
  private async charge(chargeRequest: MidtransChargeRequest): Promise<MidtransChargeResponse> {
    const url = `${this.baseUrl}/v2/charge`;
    const authHeader = Buffer.from(this.config.serverKey + ':').toString('base64');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authHeader}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify(chargeRequest)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Midtrans API error: ${errorData.status_message || response.statusText}`);
    }

    const data = await response.json();
    return data;
  }

  /**
   * Check transaction status
   */
  async getTransactionStatus(orderId: string): Promise<MidtransChargeResponse> {
    try {
      const url = `${this.baseUrl}/v2/${orderId}/status`;
      const authHeader = Buffer.from(this.config.serverKey + ':').toString('base64');

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Midtrans API error: ${errorData.status_message || response.statusText}`);
      }

      const data = await response.json();

      logger.info(`Transaction status checked: ${orderId} - ${data.transaction_status}`);

      return data;
    } catch (error) {
      logger.error(`Error checking transaction status for ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Cancel transaction
   */
  async cancelTransaction(orderId: string): Promise<MidtransChargeResponse> {
    try {
      const url = `${this.baseUrl}/v2/${orderId}/cancel`;
      const authHeader = Buffer.from(this.config.serverKey + ':').toString('base64');

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Midtrans API error: ${errorData.status_message || response.statusText}`);
      }

      const data = await response.json();

      logger.info(`Transaction canceled: ${orderId}`);

      return data;
    } catch (error) {
      logger.error(`Error canceling transaction ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Verify notification signature
   */
  verifyNotificationSignature(notification: MidtransNotification): boolean {
    try {
      const { order_id, status_code, gross_amount, signature_key } = notification;

      const signatureString = `${order_id}${status_code}${gross_amount}${this.config.serverKey}`;
      const calculatedSignature = crypto
        .createHash('sha512')
        .update(signatureString)
        .digest('hex');

      const isValid = calculatedSignature === signature_key;

      if (!isValid) {
        logger.warn(`Invalid signature for order ${order_id}`);
      }

      return isValid;
    } catch (error) {
      logger.error('Error verifying notification signature:', error);
      return false;
    }
  }

  /**
   * Process notification webhook
   */
  async processNotification(notification: MidtransNotification): Promise<{
    orderId: string;
    status: string;
    fraudStatus?: string;
    settlementTime?: string;
  }> {
    try {
      // Verify signature
      if (!this.verifyNotificationSignature(notification)) {
        throw new Error('Invalid notification signature');
      }

      logger.info(`Processing notification for order ${notification.order_id}: ${notification.transaction_status}`);

      return {
        orderId: notification.order_id,
        status: notification.transaction_status,
        fraudStatus: notification.fraud_status,
        settlementTime: notification.settlement_time
      };
    } catch (error) {
      logger.error('Error processing notification:', error);
      throw error;
    }
  }

  /**
   * Format amount to Midtrans format (no decimal, e.g., 100000 for Rp 1,000.00)
   */
  formatAmount(amountInCents: number): number {
    return Math.round(amountInCents / 100);
  }

  /**
   * Get payment instructions for user
   */
  getPaymentInstructions(response: MidtransChargeResponse): string {
    const { payment_type, va_numbers, bill_key, biller_code, actions, qr_string } = response;

    switch (payment_type) {
      case 'bank_transfer':
        if (va_numbers && va_numbers.length > 0) {
          const va = va_numbers[0];
          return `Transfer ke Virtual Account ${va.bank.toUpperCase()}: ${va.va_number}`;
        }
        break;

      case 'echannel':
        if (bill_key && biller_code) {
          return `Bayar melalui Mandiri ATM/Internet Banking:\nBiller Code: ${biller_code}\nBill Key: ${bill_key}`;
        }
        break;

      case 'gopay':
        if (actions && actions.length > 0) {
          const deeplink = actions.find(a => a.name === 'deeplink-redirect');
          if (deeplink) {
            return `Buka aplikasi GoPay atau scan QR code untuk melanjutkan pembayaran`;
          }
        }
        break;

      case 'qris':
        if (qr_string) {
          return `Scan QR code dengan aplikasi e-wallet Anda (GoPay, OVO, Dana, atau ShopeePay)`;
        }
        break;
    }

    return 'Silakan cek email Anda untuk instruksi pembayaran';
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return !!this.config.serverKey && !!this.config.clientKey;
  }
}

// Singleton instance
export const midtransService = new MidtransService();
