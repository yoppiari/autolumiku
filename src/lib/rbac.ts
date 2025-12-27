/**
 * Role-Based Access Control (RBAC) Utility
 * Centralized permission constants and helper functions for Prima Mobil dashboard
 *
 * OFFICIAL ACCESS MATRIX (from Excel criteria table):
 * ┌─────────────┬───────┬─────────┬─────────┬───────┬───────┬─────────────┐
 * │ Feature     │ Staff │ Finance │ Manager │ Admin │ Owner │ Super Admin │
 * ├─────────────┼───────┼─────────┼─────────┼───────┼───────┼─────────────┤
 * │ Kendaraan   │   Y   │    N    │    N    │   Y   │   Y   │      Y      │
 * │ Invoice     │   N   │    Y    │    Y    │   Y   │   Y   │      Y      │
 * │ Analytics   │   N   │    N    │    Y    │   Y   │   Y   │      Y      │
 * │ Tim         │   N   │    N    │    N    │   Y   │   Y   │      Y      │
 * │ WhatsApp AI │   N   │    N    │    N    │   Y   │   Y   │      Y      │
 * │ Blog (view) │   Y   │    Y    │    Y    │   Y   │   Y   │      Y      │
 * │ Blog (mgmt) │   N   │    N    │    N    │   Y   │   Y   │      Y      │
 * │ Settings    │   N   │    N    │    N    │   Y   │   Y   │      Y      │
 * └─────────────┴───────┴─────────┴─────────┴───────┴───────┴─────────────┘
 *
 * Role Levels: Staff=30, Finance=60, Manager=70, Admin=90, Owner=100, Super Admin=110
 */

// Role levels - higher number = more access
export const ROLE_LEVELS = {
  SALES: 30, // Staff - vehicle operations
  FINANCE: 60, // Finance Accounting - invoice operations
  MANAGER: 70, // Manager - analytics, oversight
  ADMIN: 90, // Admin - team, whatsapp, blog management
  OWNER: 100, // Owner - full tenant access
  SUPER_ADMIN: 110, // Super Admin - platform access
} as const;

export type RoleLevel = (typeof ROLE_LEVELS)[keyof typeof ROLE_LEVELS];

// Navigation item interface
export interface NavItem {
  name: string;
  href: string;
  icon?: string; // Icon name or component
  minRole: number;
  excludeRoles?: number[]; // Specific roles to exclude (e.g., FINANCE from Kendaraan)
}

// Page access requirements based on Excel access matrix
export const PAGE_ACCESS: Record<string, { minRole: number; excludeRoles?: number[] }> = {
  // Dashboard - all roles can access
  '/dashboard': { minRole: ROLE_LEVELS.SALES },

  // Tim/Users - Admin+ only
  '/dashboard/users': { minRole: ROLE_LEVELS.ADMIN },

  // Kendaraan/Vehicles - Staff, Admin+; Manager and Finance excluded
  '/dashboard/vehicles': {
    minRole: ROLE_LEVELS.SALES,
    excludeRoles: [ROLE_LEVELS.MANAGER, ROLE_LEVELS.FINANCE],
  },

  // Invoice - Finance+ (Staff excluded via minRole)
  '/dashboard/invoices': { minRole: ROLE_LEVELS.FINANCE },
  '/dashboard/invoices/create': { minRole: ROLE_LEVELS.FINANCE },
  '/dashboard/invoices/ledger': { minRole: ROLE_LEVELS.FINANCE },
  // Invoice report review - Manager+ only, Finance excluded
  '/dashboard/invoices/report': { minRole: ROLE_LEVELS.MANAGER, excludeRoles: [ROLE_LEVELS.FINANCE] },

  // WhatsApp AI - Admin+ only (not Manager)
  '/dashboard/whatsapp-ai': { minRole: ROLE_LEVELS.ADMIN },
  '/dashboard/whatsapp-ai/analytics': { minRole: ROLE_LEVELS.MANAGER }, // Analytics visible to Manager+
  '/dashboard/whatsapp-ai/config': { minRole: ROLE_LEVELS.ADMIN },

  // Settings - Admin+ only
  '/dashboard/settings': { minRole: ROLE_LEVELS.ADMIN },

  // Blog - visible to all, but actions require different levels
  '/dashboard/blog': { minRole: ROLE_LEVELS.SALES }, // All can view
  '/dashboard/blog/create': { minRole: ROLE_LEVELS.ADMIN }, // Only Admin+ can create
  '/dashboard/blog/edit': { minRole: ROLE_LEVELS.ADMIN }, // Only Admin+ can edit
};

/**
 * Check if a user can access a specific page
 */
export function canAccessPage(roleLevel: number, path: string): boolean {
  // Find the most specific matching path
  const matchingPath = Object.keys(PAGE_ACCESS)
    .filter((p) => path.startsWith(p))
    .sort((a, b) => b.length - a.length)[0];

  if (!matchingPath) {
    // Default: allow access if path not in list
    return true;
  }

  const access = PAGE_ACCESS[matchingPath];

  // Check if role is excluded
  if (access.excludeRoles?.includes(roleLevel)) {
    return false;
  }

  // Check minimum role level
  return roleLevel >= access.minRole;
}

/**
 * Check if user can access a feature based on role level
 */
export function canAccess(roleLevel: number, requiredLevel: number): boolean {
  return roleLevel >= requiredLevel;
}

/**
 * Check if a specific role is excluded from a page
 */
export function isRoleExcluded(roleLevel: number, path: string): boolean {
  const matchingPath = Object.keys(PAGE_ACCESS)
    .filter((p) => path.startsWith(p))
    .sort((a, b) => b.length - a.length)[0];

  if (!matchingPath) return false;

  const access = PAGE_ACCESS[matchingPath];
  return access.excludeRoles?.includes(roleLevel) ?? false;
}

// Feature-specific permission checks based on Excel access matrix
export const permissions = {
  // Dashboard - all roles
  canViewDashboard: (roleLevel: number) => roleLevel >= ROLE_LEVELS.SALES,

  // Vehicles - Staff, Admin+ (exclude Manager and Finance)
  canViewVehicles: (roleLevel: number) =>
    roleLevel >= ROLE_LEVELS.SALES &&
    roleLevel !== ROLE_LEVELS.FINANCE &&
    roleLevel !== ROLE_LEVELS.MANAGER,
  canCreateVehicle: (roleLevel: number) =>
    roleLevel >= ROLE_LEVELS.SALES &&
    roleLevel !== ROLE_LEVELS.FINANCE &&
    roleLevel !== ROLE_LEVELS.MANAGER,
  canEditVehicle: (roleLevel: number) =>
    roleLevel >= ROLE_LEVELS.SALES &&
    roleLevel !== ROLE_LEVELS.FINANCE &&
    roleLevel !== ROLE_LEVELS.MANAGER,
  canChangeVehicleStatus: (roleLevel: number) =>
    roleLevel >= ROLE_LEVELS.SALES &&
    roleLevel !== ROLE_LEVELS.FINANCE &&
    roleLevel !== ROLE_LEVELS.MANAGER,

  // Invoice - Finance+ (Staff excluded)
  canViewInvoice: (roleLevel: number) => roleLevel >= ROLE_LEVELS.FINANCE,
  canCreateInvoice: (roleLevel: number) => roleLevel >= ROLE_LEVELS.FINANCE,
  canEditInvoice: (roleLevel: number) => roleLevel >= ROLE_LEVELS.FINANCE,
  canRecordPayment: (roleLevel: number) => roleLevel >= ROLE_LEVELS.FINANCE,
  canExportInvoicePDF: (roleLevel: number) => roleLevel >= ROLE_LEVELS.FINANCE,
  canVoidInvoice: (roleLevel: number) => roleLevel >= ROLE_LEVELS.ADMIN,
  // Invoice Report - Manager+ but not Finance
  canViewInvoiceReport: (roleLevel: number) =>
    roleLevel >= ROLE_LEVELS.MANAGER && roleLevel !== ROLE_LEVELS.FINANCE,

  // Analytics - Manager+ (Finance excluded)
  canViewAnalytics: (roleLevel: number) =>
    roleLevel >= ROLE_LEVELS.MANAGER && roleLevel !== ROLE_LEVELS.FINANCE,
  canExportAnalytics: (roleLevel: number) =>
    roleLevel >= ROLE_LEVELS.MANAGER && roleLevel !== ROLE_LEVELS.FINANCE,

  // Team/Users - Admin+ only
  canViewTeam: (roleLevel: number) => roleLevel >= ROLE_LEVELS.ADMIN,
  canManageTeam: (roleLevel: number) => roleLevel >= ROLE_LEVELS.ADMIN,
  canAddStaff: (roleLevel: number) => roleLevel >= ROLE_LEVELS.ADMIN,
  canEditStaff: (roleLevel: number) => roleLevel >= ROLE_LEVELS.ADMIN,
  canDeleteStaff: (roleLevel: number) => roleLevel >= ROLE_LEVELS.ADMIN,

  // Settings - Admin+ only
  canViewSettings: (roleLevel: number) => roleLevel >= ROLE_LEVELS.ADMIN,
  canManageSettings: (roleLevel: number) => roleLevel >= ROLE_LEVELS.ADMIN,

  // WhatsApp AI - Admin+ only (Manager cannot access)
  canViewWhatsAppAI: (roleLevel: number) => roleLevel >= ROLE_LEVELS.ADMIN,
  canViewWhatsAppAnalytics: (roleLevel: number) =>
    roleLevel >= ROLE_LEVELS.MANAGER && roleLevel !== ROLE_LEVELS.FINANCE,
  canConfigureWhatsAppAI: (roleLevel: number) => roleLevel >= ROLE_LEVELS.ADMIN,

  // Blog - visible to all, manage by Admin+
  canViewBlog: (roleLevel: number) => roleLevel >= ROLE_LEVELS.SALES,
  canCreateBlog: (roleLevel: number) => roleLevel >= ROLE_LEVELS.ADMIN,
  canEditBlog: (roleLevel: number) => roleLevel >= ROLE_LEVELS.ADMIN,
  canDeleteBlog: (roleLevel: number) => roleLevel >= ROLE_LEVELS.ADMIN,
  canManageBlog: (roleLevel: number) => roleLevel >= ROLE_LEVELS.ADMIN,
};

/**
 * Get role name from role level
 */
export function getRoleName(roleLevel: number): string {
  if (roleLevel >= ROLE_LEVELS.SUPER_ADMIN) return 'Super Admin';
  if (roleLevel >= ROLE_LEVELS.OWNER) return 'Owner';
  if (roleLevel >= ROLE_LEVELS.ADMIN) return 'Admin';
  if (roleLevel >= ROLE_LEVELS.MANAGER) return 'Manager';
  if (roleLevel >= ROLE_LEVELS.FINANCE) return 'Finance';
  return 'Staff';
}

/**
 * Dashboard card visibility based on role (Excel access matrix)
 *
 * Total Kendaraan: Staff √, Finance ×, Manager ×, Admin+ √
 * Analytics: Staff ×, Finance ×, Manager √, Admin+ √
 * Tim Showroom: Staff ×, Finance ×, Manager ×, Admin+ √
 * Invoice: Staff ×, Finance √, Manager √, Admin+ √
 */
export function getVisibleDashboardCards(roleLevel: number): string[] {
  const cards: string[] = ['overview']; // Everyone can see overview

  // Kendaraan - Staff and Admin+ only (not Manager, not Finance)
  if (roleLevel !== ROLE_LEVELS.FINANCE && roleLevel !== ROLE_LEVELS.MANAGER) {
    cards.push('kendaraan');
  }

  // Invoice - Finance and above (not Staff)
  if (roleLevel >= ROLE_LEVELS.FINANCE) {
    cards.push('invoice');
  }

  // Tim - Admin+ only
  if (roleLevel >= ROLE_LEVELS.ADMIN) {
    cards.push('tim');
  }

  // Analytics - Manager+ only (not Finance)
  if (roleLevel >= ROLE_LEVELS.MANAGER && roleLevel !== ROLE_LEVELS.FINANCE) {
    cards.push('analytics');
  }

  // Blog card - visible to all
  cards.push('blog');

  return cards;
}
