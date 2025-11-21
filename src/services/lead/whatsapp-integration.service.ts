/**
 * WhatsApp Integration Service
 * Epic 6: Story 6.2 - WhatsApp Integration for Instant Lead Response
 *
 * WhatsApp Business API integration
 */

import { leadActivityService } from './lead-activity.service';

export interface WhatsAppMessage {
  to: string;
  message: string;
  mediaUrl?: string;
}

export interface WhatsAppTemplate {
  name: string;
  language: string;
  components: any[];
}

export class WhatsAppIntegrationService {
  /**
   * Send WhatsApp message
   * Note: This is a placeholder for actual WhatsApp Business API integration
   */
  async sendMessage(
    leadId: string,
    tenantId: string,
    to: string,
    message: string,
    userId: string,
    userName?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // TODO: Integrate with actual WhatsApp Business API
      // For now, just log the activity

      // Clean phone number
      const cleanNumber = this.formatPhoneNumber(to);

      // Record activity
      await leadActivityService.recordWhatsAppMessage(
        leadId,
        tenantId,
        message,
        'outbound',
        userId,
        userName
      );

      // Simulate API call
      console.log(`[WhatsApp] Sending message to ${cleanNumber}:`, message);

      return {
        success: true,
        messageId: `wa_${Date.now()}`,
      };
    } catch (error: any) {
      console.error('WhatsApp send error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send WhatsApp message with media
   */
  async sendMessageWithMedia(
    leadId: string,
    tenantId: string,
    to: string,
    message: string,
    mediaUrl: string,
    userId: string,
    userName?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const cleanNumber = this.formatPhoneNumber(to);

      // Record activity with media
      await leadActivityService.recordActivity(leadId, tenantId, {
        type: 'WHATSAPP',
        channel: 'WHATSAPP',
        direction: 'outbound',
        message,
        metadata: { mediaUrl },
        performedBy: userId,
        performedByName: userName,
      });

      console.log(`[WhatsApp] Sending message with media to ${cleanNumber}`);

      return {
        success: true,
        messageId: `wa_${Date.now()}`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send template message (for WhatsApp approved templates)
   */
  async sendTemplateMessage(
    leadId: string,
    tenantId: string,
    to: string,
    template: WhatsAppTemplate,
    userId: string,
    userName?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const cleanNumber = this.formatPhoneNumber(to);

      // Record activity
      await leadActivityService.recordActivity(leadId, tenantId, {
        type: 'WHATSAPP',
        channel: 'WHATSAPP',
        direction: 'outbound',
        subject: `Template: ${template.name}`,
        message: JSON.stringify(template),
        metadata: { templateName: template.name },
        performedBy: userId,
        performedByName: userName,
      });

      console.log(`[WhatsApp] Sending template ${template.name} to ${cleanNumber}`);

      return {
        success: true,
        messageId: `wa_${Date.now()}`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Handle incoming WhatsApp message
   */
  async handleIncomingMessage(
    leadId: string,
    tenantId: string,
    from: string,
    message: string
  ): Promise<void> {
    // Record incoming message
    await leadActivityService.recordWhatsAppMessage(
      leadId,
      tenantId,
      message,
      'inbound'
    );
  }

  /**
   * Generate vehicle inquiry message
   */
  generateVehicleInquiryMessage(
    vehicleInfo: { make: string; model: string; year: number; price: number },
    dealerName: string
  ): string {
    const priceFormatted = `Rp ${(vehicleInfo.price / 100).toLocaleString('id-ID')}`;

    return `Halo, saya tertarik dengan ${vehicleInfo.make} ${vehicleInfo.model} ${vehicleInfo.year} yang ditawarkan di ${dealerName}.

Harga: ${priceFormatted}

Apakah unit ini masih tersedia? Mohon informasi lebih lanjut.

Terima kasih.`;
  }

  /**
   * Generate follow-up message
   */
  generateFollowUpMessage(customerName: string, dealerName: string): string {
    return `Halo ${customerName},

Terima kasih atas minat Anda pada kendaraan kami di ${dealerName}.

Apakah Anda memiliki pertanyaan lebih lanjut? Saya siap membantu.

Salam,
${dealerName}`;
  }

  /**
   * Generate test drive confirmation
   */
  generateTestDriveConfirmation(
    customerName: string,
    vehicleName: string,
    date: Date,
    dealerName: string
  ): string {
    const dateFormatted = date.toLocaleString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return `Halo ${customerName},

Test drive Anda untuk ${vehicleName} telah dikonfirmasi!

Tanggal & Waktu: ${dateFormatted}

Lokasi: ${dealerName}

Kami tunggu kedatangan Anda. Jika ada perubahan, mohon hubungi kami.

Salam,
${dealerName}`;
  }

  /**
   * Format phone number for WhatsApp (Indonesian format)
   */
  formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digits
    let cleanNumber = phoneNumber.replace(/\D/g, '');

    // Add Indonesia country code if not present
    if (!cleanNumber.startsWith('62')) {
      if (cleanNumber.startsWith('0')) {
        cleanNumber = '62' + cleanNumber.slice(1);
      } else {
        cleanNumber = '62' + cleanNumber;
      }
    }

    return cleanNumber;
  }

  /**
   * Generate WhatsApp URL (wa.me link)
   */
  generateWhatsAppURL(phoneNumber: string, message?: string): string {
    const cleanNumber = this.formatPhoneNumber(phoneNumber);
    const encodedMessage = message ? encodeURIComponent(message) : '';

    return `https://wa.me/${cleanNumber}${encodedMessage ? `?text=${encodedMessage}` : ''}`;
  }

  /**
   * Validate WhatsApp number format
   */
  validateWhatsAppNumber(phoneNumber: string): boolean {
    const cleanNumber = this.formatPhoneNumber(phoneNumber);

    // Indonesian WhatsApp numbers should be 11-13 digits (62 + 9-11 digits)
    return /^62[0-9]{9,11}$/.test(cleanNumber);
  }
}

export const whatsappIntegrationService = new WhatsAppIntegrationService();
