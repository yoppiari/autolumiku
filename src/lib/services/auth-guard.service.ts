/**
 * Auth Guard Service
 * Checks eligibility for WhatsApp-based password reset
 */

import { prisma } from '@/lib/prisma';
import type { WhatsAppResetEligibility } from '@/types/auth.types';

export class AuthGuardService {
  /**
   * Check if user can use WhatsApp-based password reset
   * Criteria:
   * 1. User must be a showroom admin (not super admin)
   * 2. User must have a tenantId
   * 3. Tenant must have an active WhatsApp connection
   */
  static async canUseWhatsAppReset(
    userId: string
  ): Promise<WhatsAppResetEligibility> {
    try {
      // Get user with tenant and WhatsApp account info
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          role: true,
          tenantId: true,
          tenant: {
            select: {
              id: true,
              name: true,
              aimeowAccount: {
                select: {
                  isActive: true,
                  connectionStatus: true,
                  phoneNumber: true,
                },
              },
            },
          },
        },
      });

      if (!user) {
        return {
          eligible: false,
          reason: 'User tidak ditemukan',
        };
      }

      // Check if super admin
      if (user.role === 'super_admin') {
        return {
          eligible: false,
          reason:
            'Super admin tidak dapat menggunakan reset via WhatsApp. Silakan hubungi administrator sistem.',
        };
      }

      // Check if user has tenant
      if (!user.tenantId || !user.tenant) {
        return {
          eligible: false,
          reason:
            'Akun Anda tidak terhubung dengan showroom. Silakan hubungi administrator.',
        };
      }

      // Check if tenant has WhatsApp account
      if (!user.tenant.aimeowAccount) {
        return {
          eligible: false,
          reason:
            'Showroom Anda belum terhubung dengan WhatsApp. Silakan hubungi administrator untuk setup WhatsApp terlebih dahulu.',
          tenantId: user.tenantId,
          whatsappConnected: false,
        };
      }

      // Check if WhatsApp is connected
      if (
        !user.tenant.aimeowAccount.isActive ||
        user.tenant.aimeowAccount.connectionStatus !== 'connected'
      ) {
        return {
          eligible: false,
          reason:
            'WhatsApp showroom Anda sedang tidak aktif. Silakan hubungi administrator untuk mengaktifkan WhatsApp.',
          tenantId: user.tenantId,
          whatsappConnected: false,
        };
      }

      // All checks passed
      return {
        eligible: true,
        tenantId: user.tenantId,
        whatsappConnected: true,
      };
    } catch (error) {
      console.error('Error checking WhatsApp reset eligibility:', error);
      return {
        eligible: false,
        reason: 'Terjadi kesalahan sistem. Silakan coba lagi.',
      };
    }
  }

  /**
   * Check if user is showroom admin (not super admin)
   */
  static isShowroomAdmin(role: string): boolean {
    return ['admin', 'manager', 'staff'].includes(role.toLowerCase());
  }

  /**
   * Check if user is super admin
   */
  static isSuperAdmin(role: string): boolean {
    return role.toLowerCase() === 'super_admin';
  }
}
