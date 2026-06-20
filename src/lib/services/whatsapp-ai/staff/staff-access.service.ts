/**
 * Staff Access Service
 * -------------------------------------------------------------
 * Single source of truth for "who is an active staff member of a tenant" and
 * the canonical revoke path used when a member is removed from the team.
 *
 * Why this exists (security): a member removed from the team (deleted, demoted,
 * or with WhatsApp registration revoked) must immediately STOP being treated as
 * staff and STOP receiving any project updates (upload confirmations, monitoring
 * alerts, broadcasts). This service centralizes:
 *   - the canonical active-staff query (used by notification senders), and
 *   - `revokeStaffAccess()`, which clears the staff registration, resets the
 *     person's WhatsApp conversation back to "customer", and invalidates the
 *     in-memory staff cache (event-driven, no TTL reliance).
 */

import { prisma } from '@/lib/prisma';
import { IntentClassifierService } from '@/lib/services/whatsapp-ai/core/intent-classifier.service';

/** Roles that count as staff for WhatsApp identification & notifications. */
export const STAFF_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'FINANCE', 'SALES', 'STAFF'] as const;

export interface ActiveStaff {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  role: string;
}

/**
 * Canonical query for ACTIVE staff members of a tenant who have a phone.
 * Notification senders MUST use this so removed/demoted members are excluded.
 */
export async function getActiveStaffWithPhone(tenantId: string): Promise<ActiveStaff[]> {
  return prisma.user.findMany({
    where: {
      tenantId,
      role: { in: STAFF_ROLES as unknown as string[] },
      phone: { not: null },
    },
    select: { id: true, firstName: true, lastName: true, phone: true, role: true },
  });
}

/**
 * Canonical recipients for proactive WhatsApp notifications (upload/monitor/lead/etc).
 *
 * A user receives WhatsApp notifications ONLY if they are an actively-REGISTERED
 * staff member: they have an active `StaffWhatsAppAuth` row AND the underlying
 * User still exists in this tenant. This guarantees that:
 *   - DELETED users get nothing (their User row is gone, and revokeStaffAccess
 *     also deletes their StaffWhatsAppAuth), and
 *   - UNREGISTERED users (no/inactive StaffWhatsAppAuth) get nothing, even if
 *     they happen to have a phone number on their User record.
 *
 * The phone used is the REGISTERED phoneNumber from StaffWhatsAppAuth.
 */
export async function getNotifiableStaff(
  tenantId: string
): Promise<Array<{ id: string; firstName: string | null; lastName: string | null; phone: string; role: string }>> {
  const regs = await prisma.staffWhatsAppAuth.findMany({
    where: { tenantId, isActive: true },
    select: { phoneNumber: true, userId: true, role: true },
  });
  if (regs.length === 0) return [];

  const userIds = Array.from(new Set(regs.map((r) => r.userId).filter(Boolean)));
  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, tenantId },
    select: { id: true, firstName: true, lastName: true, role: true },
  });
  const userById = new Map(users.map((u) => [u.id, u]));

  const out: Array<{ id: string; firstName: string | null; lastName: string | null; phone: string; role: string }> = [];
  for (const r of regs) {
    const u = userById.get(r.userId);
    if (!u) continue; // user deleted/not in tenant -> orphan registration, skip
    if (!r.phoneNumber) continue;
    out.push({ id: u.id, firstName: u.firstName, lastName: u.lastName, phone: r.phoneNumber, role: u.role });
  }
  return out;
}

/**
 * Revoke a (former) staff member's WhatsApp access and updates for a tenant.
 * Safe to call before OR after the underlying User row is deleted — pass the
 * phone explicitly when the user may already be gone.
 *
 * Performs (best-effort, never throws):
 *   1. Delete StaffWhatsAppAuth registration rows (by userId and/or phone).
 *   2. Reset that phone's WhatsApp conversations back to "customer"
 *      (isStaff=false) so staff-only logic & staff broadcasts no longer apply.
 *   3. Invalidate the in-memory staff cache for the tenant.
 */
export async function revokeStaffAccess(
  tenantId: string,
  opts: { userId?: string; phone?: string | null }
): Promise<void> {
  const { userId } = opts;
  let phone = opts.phone ?? null;

  try {
    // If phone not provided, try to resolve it from the user (while it still exists).
    if (!phone && userId) {
      const u = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
      phone = u?.phone ?? null;
    }

    // 1. Remove WhatsApp staff registration(s).
    const authOr: any[] = [];
    if (userId) authOr.push({ userId });
    if (phone) authOr.push({ phoneNumber: phone });
    if (authOr.length > 0) {
      await prisma.staffWhatsAppAuth.deleteMany({ where: { tenantId, OR: authOr } }).catch(() => {});
    }

    // 2. Reset this phone's conversations from staff -> customer.
    if (phone) {
      const variants = phoneVariants(phone);
      await prisma.whatsAppConversation
        .updateMany({
          where: { tenantId, isStaff: true, customerPhone: { in: variants } },
          data: { isStaff: false, conversationType: 'customer' },
        })
        .catch(() => {});
    }

    // 3. Invalidate the staff cache so the person is no longer treated as staff.
    IntentClassifierService.clearStaffCache(tenantId);

    console.log(`[StaffAccess] Revoked staff access in tenant ${tenantId} (userId=${userId || '-'}, phone=${phone || '-'})`);
  } catch (err: any) {
    // Never let revoke failures break the calling delete/update flow.
    console.error('[StaffAccess] revokeStaffAccess error:', err?.message);
    // Still attempt cache invalidation as a last resort.
    IntentClassifierService.clearStaffCache(tenantId);
  }
}

/**
 * Build common stored variants of a phone number so the conversation reset
 * matches regardless of formatting (+62 / 62 / 0 prefixes, spaces/dashes).
 */
function phoneVariants(phone: string): string[] {
  const set = new Set<string>();
  const raw = phone.trim();
  set.add(raw);
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits) {
    set.add(digits);
    // normalize to 62xxxxxxxxxx
    let n = digits;
    if (n.startsWith('0')) n = '62' + n.slice(1);
    else if (n.startsWith('620')) n = '62' + n.slice(3);
    if (!n.startsWith('62')) n = '62' + n;
    set.add(n);
    set.add('+' + n);
  }
  return Array.from(set);
}
