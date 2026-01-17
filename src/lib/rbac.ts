/**
 * Role-Based Access Control (RBAC) Utility
 * Centralized permission constants and helper functions for Prima Mobil dashboard
 *
 * OFFICIAL ACCESS MATRIX:
 * ┌─────────────┬───────┬───────┬───────┬─────────────┐
 * │ Feature     │ Sales │ Admin │ Owner │ Super Admin │
 * ├─────────────┼───────┼───────┼───────┼─────────────┤
 * │ Kendaraan   │   Y   │   Y   │   Y   │      Y      │
 * │ Tim         │   N   │   Y   │   Y   │      Y      │
 * │ Analytics   │   N   │   Y   │   Y   │      Y      │
 * │ WhatsApp AI │   N   │   Y   │   Y   │      Y      │
 * │ Blog (view) │   Y   │   Y   │   Y   │      Y      │
 * │ Blog (mgmt) │   N   │   Y   │   Y   │      Y      │
 * │ Settings    │   N   │   Y   │   Y   │      Y      │
 * └─────────────┴───────┴───────┴───────┴─────────────┘
 *
 * Role Levels: Sales=30, Admin=90, Owner=100, Super Admin=110
 */

// Role levels - higher number = more access
export const ROLE_LEVELS = {
  STAFF: 30, // Staff/Sales - limited tenant access
  SALES: 30, // Legacy support for Sales
  ADMIN: 90, // Admin - multi-tenant access & admin features
  OWNER: 100, // Owner - full single tenant access
  SUPER_ADMIN: 110, // Super Admin - full platform access
} as const;

export type RoleLevel = (typeof ROLE_LEVELS)[keyof typeof ROLE_LEVELS];

// Navigation item interface
export interface NavItem {
  name: string;
  href: string;
  icon?: string; // Icon name or component
  minRole: number;
  excludeRoles?: number[]; // Specific roles to exclude
}

// Page access requirements - ALL roles can see all pages in navigation
export const PAGE_ACCESS: Record<string, { minRole: number; excludeRoles?: number[] }> = {
  // Dashboard - all roles can access
  '/dashboard': { minRole: ROLE_LEVELS.SALES },

  // Tim/Users - visible to Admin+
  '/dashboard/users': { minRole: ROLE_LEVELS.ADMIN },

  // Kendaraan/Vehicles - visible to all
  '/dashboard/vehicles': { minRole: ROLE_LEVELS.SALES },

  // WhatsApp AI - ALL pages ADMIN only
  '/dashboard/whatsapp-ai': { minRole: ROLE_LEVELS.ADMIN }, // ADMIN only
  '/dashboard/whatsapp-ai/analytics': { minRole: ROLE_LEVELS.ADMIN }, // ADMIN only
  '/dashboard/whatsapp-ai/config': { minRole: ROLE_LEVELS.ADMIN }, // ADMIN+ only
  '/dashboard/whatsapp-ai/conversations': { minRole: ROLE_LEVELS.ADMIN }, // ADMIN+ only

  // Leads - ADMIN+ only
  '/dashboard/leads': { minRole: ROLE_LEVELS.ADMIN },

  // Settings - ADMIN+ only
  '/dashboard/settings': { minRole: ROLE_LEVELS.ADMIN },
  '/dashboard/settings/business': { minRole: ROLE_LEVELS.ADMIN },

  // Blog - visible to all
  '/dashboard/blog': { minRole: ROLE_LEVELS.SALES },
  '/dashboard/blog/create': { minRole: ROLE_LEVELS.SALES },
  '/dashboard/blog/edit': { minRole: ROLE_LEVELS.SALES },
  // Invoices - HIDDEN
  '/dashboard/invoices': { minRole: ROLE_LEVELS.SUPER_ADMIN, excludeRoles: [30, 90, 100] },
  // Reports - Admin+
  '/dashboard/reports': { minRole: ROLE_LEVELS.ADMIN },
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

// Feature-specific permission checks
export const permissions = {
  // Dashboard - all roles
  canViewDashboard: (roleLevel: number) => roleLevel >= ROLE_LEVELS.SALES,

  // Vehicles - Sales and Admin+
  canViewVehicles: (roleLevel: number) => roleLevel >= ROLE_LEVELS.SALES,
  canCreateVehicle: (roleLevel: number) => roleLevel >= ROLE_LEVELS.SALES,
  canEditVehicle: (roleLevel: number) => roleLevel >= ROLE_LEVELS.SALES,
  canChangeVehicleStatus: (roleLevel: number) => roleLevel >= ROLE_LEVELS.SALES,

  // Invoice - HIDDEN for all showroom roles
  canViewInvoice: (roleLevel: number) => false,
  canCreateInvoice: (roleLevel: number) => false,
  canEditInvoice: (roleLevel: number) => false,
  canRecordPayment: (roleLevel: number) => false,
  canExportInvoicePDF: (roleLevel: number) => false,
  canVoidInvoice: (roleLevel: number) => false,
  canViewInvoiceReport: (roleLevel: number) => false,

  // Analytics - Visible to all, but actions restricted
  canViewAnalytics: (roleLevel: number) => roleLevel >= ROLE_LEVELS.SALES,
  canExportAnalytics: (roleLevel: number) => roleLevel >= ROLE_LEVELS.ADMIN,

  // Team/Users - Visible to Admin+, but actions restricted
  canViewTeam: (roleLevel: number) => roleLevel >= ROLE_LEVELS.ADMIN,
  canManageTeam: (roleLevel: number) => roleLevel >= ROLE_LEVELS.ADMIN,
  canAddStaff: (roleLevel: number) => roleLevel >= ROLE_LEVELS.ADMIN,
  canEditStaff: (roleLevel: number) => roleLevel >= ROLE_LEVELS.ADMIN,
  canDeleteStaff: (roleLevel: number) => roleLevel >= ROLE_LEVELS.ADMIN,

  // Settings - Visible to all
  canViewSettings: (roleLevel: number) => roleLevel >= ROLE_LEVELS.SALES,
  canManageSettings: (roleLevel: number) => roleLevel >= ROLE_LEVELS.ADMIN,

  // WhatsApp AI - Visible to all
  canViewWhatsAppAI: (roleLevel: number) => roleLevel >= ROLE_LEVELS.SALES,
  canViewWhatsAppAnalytics: (roleLevel: number) => roleLevel >= ROLE_LEVELS.SALES,
  canConfigureWhatsAppAI: (roleLevel: number) => roleLevel >= ROLE_LEVELS.ADMIN,

  // Blog - visible to all, manage by Admin+
  canViewBlog: (roleLevel: number) => roleLevel >= ROLE_LEVELS.SALES,
  canCreateBlog: (roleLevel: number) => roleLevel >= ROLE_LEVELS.ADMIN,
  canEditBlog: (roleLevel: number) => roleLevel >= ROLE_LEVELS.ADMIN,
  canDeleteBlog: (roleLevel: number) => roleLevel >= ROLE_LEVELS.ADMIN,
  canManageBlog: (roleLevel: number) => roleLevel >= ROLE_LEVELS.ADMIN,
};

/**
 * Compute roleLevel from role string
 * SUPER_ADMIN(110), OWNER(100), ADMIN(90), SALES(30)
 */
export function getRoleLevelFromRole(role: string): number {
  const normalizedRole = (role || "").toUpperCase();
  switch (normalizedRole) {
    case "SUPER_ADMIN":
      return ROLE_LEVELS.SUPER_ADMIN;
    case "OWNER":
      return ROLE_LEVELS.OWNER;
    case "ADMIN":
      return ROLE_LEVELS.ADMIN;
    case "SALES":
    case "STAFF":
      return ROLE_LEVELS.STAFF;
    default:
      return ROLE_LEVELS.STAFF;
  }
}

/**
 * Get role name from role level
 */
export function getRoleName(roleLevel: number): string {
  if (roleLevel >= ROLE_LEVELS.SUPER_ADMIN) return 'Super Admin';
  if (roleLevel >= ROLE_LEVELS.OWNER) return 'Owner';
  if (roleLevel >= ROLE_LEVELS.ADMIN) return 'Admin';
  return 'Staff';
}

/**
 * Dashboard card visibility based on role (Excel access matrix)
 *
 * Total Kendaraan: Sales √, Admin+ √
 * Analytics: Sales ×, Admin+ √
 * Tim Showroom: Sales ×, Admin+ √
 * Invoice: HIDDEN for all roles
 */
export function getVisibleDashboardCards(roleLevel: number): string[] {
  // Everyone can see overview, kendaraan, blog
  // Tim and Analytics restricted to Admin+
  if (roleLevel < ROLE_LEVELS.ADMIN) {
    return ['overview', 'kendaraan', 'blog'];
  }
  return ['overview', 'kendaraan', 'tim', 'analytics', 'blog'];
}
