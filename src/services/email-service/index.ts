/**
 * Email Service
 * Handles email sending for verification, password reset, notifications
 * Supports: SendGrid, AWS SES, or SMTP
 */

import { createLogger, format, transports } from 'winston';

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
    new transports.File({ filename: 'logs/email-error.log', level: 'error' }),
    new transports.File({ filename: 'logs/email-combined.log' })
  ]
});

export interface EmailTemplate {
  subject: string;
  subjectId: string; // Indonesian subject
  html: string;
  text: string;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
}

export class EmailService {
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly provider: 'sendgrid' | 'ses' | 'smtp' | 'console';

  constructor() {
    this.fromEmail = process.env.EMAIL_FROM || 'noreply@autolumiku.com';
    this.fromName = process.env.EMAIL_FROM_NAME || 'AutoLumiku';
    this.provider = (process.env.EMAIL_PROVIDER as any) || 'console';

    logger.info(`Email service initialized with provider: ${this.provider}`);
  }

  /**
   * Send email verification
   */
  async sendVerificationEmail(email: string, token: string, firstName: string): Promise<boolean> {
    try {
      const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/verify-email?token=${token}`;

      const template = this.getVerificationEmailTemplate(firstName, verificationUrl);

      await this.send({
        to: email,
        subject: template.subject,
        html: template.html,
        text: template.text
      });

      logger.info(`Verification email sent to: ${email}`);
      return true;
    } catch (error) {
      logger.error('Error sending verification email:', error);
      throw error;
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string, token: string, firstName: string): Promise<boolean> {
    try {
      const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password?token=${token}`;

      const template = this.getPasswordResetTemplate(firstName, resetUrl);

      await this.send({
        to: email,
        subject: template.subject,
        html: template.html,
        text: template.text
      });

      logger.info(`Password reset email sent to: ${email}`);
      return true;
    } catch (error) {
      logger.error('Error sending password reset email:', error);
      throw error;
    }
  }

  /**
   * Send team invitation email
   */
  async sendTeamInvitationEmail(
    email: string,
    inviterName: string,
    tenantName: string,
    invitationToken: string
  ): Promise<boolean> {
    try {
      const invitationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/accept-invitation?token=${invitationToken}`;

      const template = this.getTeamInvitationTemplate(inviterName, tenantName, invitationUrl);

      await this.send({
        to: email,
        subject: template.subject,
        html: template.html,
        text: template.text
      });

      logger.info(`Team invitation email sent to: ${email}`);
      return true;
    } catch (error) {
      logger.error('Error sending team invitation email:', error);
      throw error;
    }
  }

  /**
   * Send invoice email
   */
  async sendInvoiceEmail(
    email: string,
    invoiceNumber: string,
    amount: number,
    dueDate: Date,
    downloadUrl: string
  ): Promise<boolean> {
    try {
      const template = this.getInvoiceEmailTemplate(invoiceNumber, amount, dueDate, downloadUrl);

      await this.send({
        to: email,
        subject: template.subject,
        html: template.html,
        text: template.text
      });

      logger.info(`Invoice email sent to: ${email}`);
      return true;
    } catch (error) {
      logger.error('Error sending invoice email:', error);
      throw error;
    }
  }

  /**
   * Send payment confirmation email
   */
  async sendPaymentConfirmationEmail(
    email: string,
    amount: number,
    paymentMethod: string,
    receiptUrl: string
  ): Promise<boolean> {
    try {
      const template = this.getPaymentConfirmationTemplate(amount, paymentMethod, receiptUrl);

      await this.send({
        to: email,
        subject: template.subject,
        html: template.html,
        text: template.text
      });

      logger.info(`Payment confirmation email sent to: ${email}`);
      return true;
    } catch (error) {
      logger.error('Error sending payment confirmation email:', error);
      throw error;
    }
  }

  /**
   * Core send method
   */
  private async send(options: SendEmailOptions): Promise<void> {
    switch (this.provider) {
      case 'sendgrid':
        await this.sendViaSendGrid(options);
        break;
      case 'ses':
        await this.sendViaSES(options);
        break;
      case 'smtp':
        await this.sendViaSMTP(options);
        break;
      case 'console':
      default:
        await this.logToConsole(options);
        break;
    }
  }

  /**
   * SendGrid implementation (placeholder)
   */
  private async sendViaSendGrid(options: SendEmailOptions): Promise<void> {
    // TODO: Implement SendGrid
    // const sgMail = require('@sendgrid/mail');
    // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    // await sgMail.send({...});
    logger.warn('SendGrid not implemented, logging to console instead');
    await this.logToConsole(options);
  }

  /**
   * AWS SES implementation (placeholder)
   */
  private async sendViaSES(options: SendEmailOptions): Promise<void> {
    // TODO: Implement AWS SES
    // const AWS = require('aws-sdk');
    // const ses = new AWS.SES({...});
    // await ses.sendEmail({...}).promise();
    logger.warn('AWS SES not implemented, logging to console instead');
    await this.logToConsole(options);
  }

  /**
   * SMTP implementation (placeholder)
   */
  private async sendViaSMTP(options: SendEmailOptions): Promise<void> {
    // TODO: Implement SMTP with nodemailer
    // const nodemailer = require('nodemailer');
    // const transporter = nodemailer.createTransport({...});
    // await transporter.sendMail({...});
    logger.warn('SMTP not implemented, logging to console instead');
    await this.logToConsole(options);
  }

  /**
   * Console logger (for development)
   */
  private async logToConsole(options: SendEmailOptions): Promise<void> {
    logger.info('=== EMAIL (Console Mode) ===');
    logger.info(`To: ${options.to}`);
    logger.info(`Subject: ${options.subject}`);
    logger.info(`HTML: ${options.html.substring(0, 200)}...`);
    logger.info(`Text: ${options.text.substring(0, 200)}...`);
    logger.info('===========================');
  }

  // ============================================================================
  // EMAIL TEMPLATES
  // ============================================================================

  private getVerificationEmailTemplate(firstName: string, verificationUrl: string): EmailTemplate {
    const subject = 'Verify your email - AutoLumiku';
    const subjectId = 'Verifikasi email Anda - AutoLumiku';

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .button { display: inline-block; padding: 12px 24px; background-color: #1a56db; color: white; text-decoration: none; border-radius: 6px; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Verifikasi Email Anda</h1>
            <p>Halo ${firstName},</p>
            <p>Terima kasih telah mendaftar di AutoLumiku! Silakan klik tombol di bawah ini untuk memverifikasi alamat email Anda:</p>
            <p><a href="${verificationUrl}" class="button">Verifikasi Email</a></p>
            <p>Atau copy dan paste link ini ke browser Anda:</p>
            <p><a href="${verificationUrl}">${verificationUrl}</a></p>
            <p>Link verifikasi ini akan kadaluarsa dalam 24 jam.</p>
            <p>Jika Anda tidak membuat akun ini, Anda dapat mengabaikan email ini.</p>
            <div class="footer">
              <p>AutoLumiku - Platform Manajemen Showroom Otomotif</p>
              <p>Email ini dikirim secara otomatis, mohon tidak membalas.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
Verifikasi Email Anda

Halo ${firstName},

Terima kasih telah mendaftar di AutoLumiku! Silakan klik link di bawah ini untuk memverifikasi alamat email Anda:

${verificationUrl}

Link verifikasi ini akan kadaluarsa dalam 24 jam.

Jika Anda tidak membuat akun ini, Anda dapat mengabaikan email ini.

---
AutoLumiku - Platform Manajemen Showroom Otomotif
Email ini dikirim secara otomatis, mohon tidak membalas.
    `.trim();

    return { subject, subjectId, html, text };
  }

  private getPasswordResetTemplate(firstName: string, resetUrl: string): EmailTemplate {
    const subject = 'Reset your password - AutoLumiku';
    const subjectId = 'Reset password Anda - AutoLumiku';

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .button { display: inline-block; padding: 12px 24px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 6px; }
            .warning { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Reset Password Anda</h1>
            <p>Halo ${firstName},</p>
            <p>Kami menerima permintaan untuk reset password akun AutoLumiku Anda. Klik tombol di bawah ini untuk membuat password baru:</p>
            <p><a href="${resetUrl}" class="button">Reset Password</a></p>
            <p>Atau copy dan paste link ini ke browser Anda:</p>
            <p><a href="${resetUrl}">${resetUrl}</a></p>
            <div class="warning">
              <strong>Perhatian:</strong> Link reset password ini hanya berlaku selama 1 jam dan hanya dapat digunakan sekali.
            </div>
            <p>Jika Anda tidak meminta reset password, abaikan email ini. Password Anda tidak akan berubah.</p>
            <div class="footer">
              <p>AutoLumiku - Platform Manajemen Showroom Otomotif</p>
              <p>Email ini dikirim secara otomatis, mohon tidak membalas.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
Reset Password Anda

Halo ${firstName},

Kami menerima permintaan untuk reset password akun AutoLumiku Anda. Klik link di bawah ini untuk membuat password baru:

${resetUrl}

PERHATIAN: Link reset password ini hanya berlaku selama 1 jam dan hanya dapat digunakan sekali.

Jika Anda tidak meminta reset password, abaikan email ini. Password Anda tidak akan berubah.

---
AutoLumiku - Platform Manajemen Showroom Otomotif
Email ini dikirim secara otomatis, mohon tidak membalas.
    `.trim();

    return { subject, subjectId, html, text };
  }

  private getTeamInvitationTemplate(inviterName: string, tenantName: string, invitationUrl: string): EmailTemplate {
    const subject = `You're invited to join ${tenantName} on AutoLumiku`;
    const subjectId = `Anda diundang bergabung dengan ${tenantName} di AutoLumiku`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .button { display: inline-block; padding: 12px 24px; background-color: #059669; color: white; text-decoration: none; border-radius: 6px; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Undangan Tim</h1>
            <p><strong>${inviterName}</strong> mengundang Anda untuk bergabung dengan tim <strong>${tenantName}</strong> di AutoLumiku.</p>
            <p>AutoLumiku adalah platform manajemen showroom otomotif yang membantu Anda mengelola inventori kendaraan, customer leads, dan operasional showroom dengan lebih efisien.</p>
            <p>Klik tombol di bawah ini untuk menerima undangan dan membuat akun Anda:</p>
            <p><a href="${invitationUrl}" class="button">Terima Undangan</a></p>
            <p>Atau copy dan paste link ini ke browser Anda:</p>
            <p><a href="${invitationUrl}">${invitationUrl}</a></p>
            <div class="footer">
              <p>AutoLumiku - Platform Manajemen Showroom Otomotif</p>
              <p>Email ini dikirim secara otomatis, mohon tidak membalas.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
Undangan Tim

${inviterName} mengundang Anda untuk bergabung dengan tim ${tenantName} di AutoLumiku.

AutoLumiku adalah platform manajemen showroom otomotif yang membantu Anda mengelola inventori kendaraan, customer leads, dan operasional showroom dengan lebih efisien.

Klik link di bawah ini untuk menerima undangan dan membuat akun Anda:

${invitationUrl}

---
AutoLumiku - Platform Manajemen Showroom Otomotif
Email ini dikirim secara otomatis, mohon tidak membalas.
    `.trim();

    return { subject, subjectId, html, text };
  }

  private getInvoiceEmailTemplate(
    invoiceNumber: string,
    amount: number,
    dueDate: Date,
    downloadUrl: string
  ): EmailTemplate {
    const formattedAmount = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR'
    }).format(amount / 100); // Convert from cents

    const formattedDueDate = dueDate.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const subject = `Invoice ${invoiceNumber} - AutoLumiku`;
    const subjectId = `Faktur ${invoiceNumber} - AutoLumiku`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .invoice-box { background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .button { display: inline-block; padding: 12px 24px; background-color: #1a56db; color: white; text-decoration: none; border-radius: 6px; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Faktur Pembayaran</h1>
            <div class="invoice-box">
              <p><strong>Nomor Faktur:</strong> ${invoiceNumber}</p>
              <p><strong>Jumlah:</strong> ${formattedAmount}</p>
              <p><strong>Jatuh Tempo:</strong> ${formattedDueDate}</p>
            </div>
            <p>Terima kasih telah menggunakan AutoLumiku. Berikut adalah faktur pembayaran untuk langganan Anda.</p>
            <p><a href="${downloadUrl}" class="button">Download Faktur (PDF)</a></p>
            <p>Silakan lakukan pembayaran sebelum tanggal jatuh tempo untuk menghindari gangguan layanan.</p>
            <div class="footer">
              <p>AutoLumiku - Platform Manajemen Showroom Otomotif</p>
              <p>Email ini dikirim secara otomatis, mohon tidak membalas.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
Faktur Pembayaran

Nomor Faktur: ${invoiceNumber}
Jumlah: ${formattedAmount}
Jatuh Tempo: ${formattedDueDate}

Terima kasih telah menggunakan AutoLumiku. Berikut adalah faktur pembayaran untuk langganan Anda.

Download Faktur: ${downloadUrl}

Silakan lakukan pembayaran sebelum tanggal jatuh tempo untuk menghindari gangguan layanan.

---
AutoLumiku - Platform Manajemen Showroom Otomotif
Email ini dikirim secara otomatis, mohon tidak membalas.
    `.trim();

    return { subject, subjectId, html, text };
  }

  private getPaymentConfirmationTemplate(
    amount: number,
    paymentMethod: string,
    receiptUrl: string
  ): EmailTemplate {
    const formattedAmount = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR'
    }).format(amount / 100);

    const subject = 'Payment Confirmed - AutoLumiku';
    const subjectId = 'Pembayaran Berhasil - AutoLumiku';

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .success-box { background-color: #d1fae5; border-left: 4px solid #059669; padding: 16px; margin: 20px 0; }
            .button { display: inline-block; padding: 12px 24px; background-color: #1a56db; color: white; text-decoration: none; border-radius: 6px; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Pembayaran Berhasil!</h1>
            <div class="success-box">
              <p><strong>✓ Pembayaran Anda telah dikonfirmasi</strong></p>
            </div>
            <p><strong>Jumlah:</strong> ${formattedAmount}</p>
            <p><strong>Metode Pembayaran:</strong> ${paymentMethod}</p>
            <p>Terima kasih atas pembayaran Anda. Langganan AutoLumiku Anda telah diperpanjang.</p>
            <p><a href="${receiptUrl}" class="button">Download Receipt</a></p>
            <div class="footer">
              <p>AutoLumiku - Platform Manajemen Showroom Otomotif</p>
              <p>Email ini dikirim secara otomatis, mohon tidak membalas.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
Pembayaran Berhasil!

✓ Pembayaran Anda telah dikonfirmasi

Jumlah: ${formattedAmount}
Metode Pembayaran: ${paymentMethod}

Terima kasih atas pembayaran Anda. Langganan AutoLumiku Anda telah diperpanjang.

Download Receipt: ${receiptUrl}

---
AutoLumiku - Platform Manajemen Showroom Otomotif
Email ini dikirim secara otomatis, mohon tidak membalas.
    `.trim();

    return { subject, subjectId, html, text };
  }
}

// Singleton instance
export const emailService = new EmailService();
