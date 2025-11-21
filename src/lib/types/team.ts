/**
 * Team Management Types
 * Story 1.5: Showroom Team Management
 * TypeScript interfaces for team management system with Indonesian automotive dealership roles
 */

// Base entity interface
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// Team member information
export interface TeamMember extends BaseEntity {
  tenantId: string;
  userId: string;

  // Dealership-specific information
  employeeId?: string;
  position: string;
  department?: string;
  hireDate?: Date;
  phoneNumber?: string;
  extension?: string;
  deskLocation?: string;

  // Status information
  isActive: boolean;
  isOnLeave: boolean;
  employmentType: EmploymentType;
  reportsTo?: string;

  // Associated user information
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };

  // Current roles
  roles?: TeamMemberRole[];
  primaryRole?: DealershipRole;
}

// Employment types
export type EmploymentType = 'full-time' | 'part-time' | 'contract' | 'intern';

// Dealership role definitions
export interface DealershipRole extends BaseEntity {
  tenantId: string;
  name: string;
  displayName: string;
  description?: string;
  roleLevel: number;

  // Indonesian localization
  indonesianTitle?: string;
  department?: string;
  isCustom: boolean;

  // Status
  isActive: boolean;
  isSystemRole: boolean;

  // Associated permissions
  permissions?: Permission[];
}

// Team member role assignments
export interface TeamMemberRole extends BaseEntity {
  tenantId: string;
  teamMemberId: string;
  roleId: string;

  assignedAt: Date;
  assignedBy: string;
  isPrimary: boolean;
  effectiveFrom: Date;
  effectiveUntil?: Date;

  // Role details
  role?: DealershipRole;
}

// Permission definitions
export interface Permission extends BaseEntity {
  code: string;
  name: string;
  description?: string;
  category: PermissionCategory;
  isSystem: boolean;
}

// Permission categories
export type PermissionCategory =
  | 'team'
  | 'inventory'
  | 'customers'
  | 'billing'
  | 'analytics'
  | 'settings'
  | 'system';

// Team invitation
export interface TeamInvitation extends BaseEntity {
  tenantId: string;

  // Invitation details
  email: string;
  firstName: string;
  lastName: string;
  position?: string;
  department?: string;
  roleId?: string;

  // Invitation workflow
  invitationToken: string;
  tokenExpiresAt: Date;
  invitedBy: string;
  acceptedAt?: Date;
  acceptedBy?: string;

  // Status tracking
  status: InvitationStatus;
  rejectionReason?: string;
  resendCount: number;
  lastSentAt: Date;

  // Associated role
  role?: DealershipRole;
}

// Invitation statuses
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

// Team activity log
export interface TeamActivityLog extends BaseEntity {
  tenantId: string;

  // Activity information
  action: ActivityAction;
  entityType: EntityType;
  entityId: string;

  // User and context
  performedBy?: string;
  performedAt: Date;

  // Change details
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  changesSummary?: string;

  // Request context
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;

  // Metadata
  batchId?: string;
  correlationId?: string;
  sourceSystem: string;
}

// Activity actions
export type ActivityAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'invite'
  | 'accept'
  | 'reject'
  | 'activate'
  | 'deactivate'
  | 'assign_role'
  | 'remove_role';

// Entity types
export type EntityType =
  | 'team_member'
  | 'role'
  | 'invitation'
  | 'permission'
  | 'role_assignment';

// Team performance metrics
export interface TeamPerformanceMetric extends BaseEntity {
  tenantId: string;
  teamMemberId: string;

  // Metric information
  metricType: string;
  metricValue: number;
  metricUnit?: string;

  // Period information
  periodStart: Date;
  periodEnd: Date;
  periodType: PeriodType;

  // Additional context
  additionalData?: Record<string, any>;
}

// Period types
export type PeriodType = 'daily' | 'weekly' | 'monthly' | 'yearly';

// Team analytics data
export interface TeamAnalytics {
  teamMetrics: TeamMetrics;
  memberMetrics: MemberMetrics[];
  roleDistribution: RoleDistribution[];
  performanceMetrics: PerformanceMetrics[];
  dateRange: {
    start: Date;
    end: Date;
  };
}

// Team-level metrics
export interface TeamMetrics {
  totalMembers: number;
  activeMembers: number;
  onLeaveMembers: number;
  averageTenure: number; // in months
  departmentBreakdown: Record<string, number>;
  recentHires: number; // last 30 days
  turnoverRate: number; // monthly
}

// Individual member metrics
export interface MemberMetrics {
  memberId: string;
  memberName: string;
  role: string;
  department: string;
  activities: {
    invitationsSent: number;
    teamChanges: number;
    lastActivity: Date;
  };
  performance: {
    responseTime?: number; // average in minutes
    customerInteractions?: number;
    taskCompletion?: number; // percentage
  };
}

// Role distribution
export interface RoleDistribution {
  roleId: string;
  roleName: string;
  count: number;
  percentage: number;
}

// Performance metrics
export interface PerformanceMetrics {
  metricType: string;
  totalValue: number;
  averageValue: number;
  trend: 'up' | 'down' | 'stable';
  periodOverPeriodChange: number; // percentage
}

// Request/Response DTOs
export interface CreateTeamMemberRequest {
  userId: string;
  position: string;
  department?: string;
  employeeId?: string;
  hireDate?: Date;
  phoneNumber?: string;
  extension?: string;
  deskLocation?: string;
  employmentType: EmploymentType;
  reportsTo?: string;
  roleIds: string[];
}

export interface UpdateTeamMemberRequest {
  position?: string;
  department?: string;
  employeeId?: string;
  hireDate?: Date;
  phoneNumber?: string;
  extension?: string;
  deskLocation?: string;
  employmentType?: EmploymentType;
  reportsTo?: string;
  isActive?: boolean;
  isOnLeave?: boolean;
}

export interface CreateInvitationRequest {
  email: string;
  firstName: string;
  lastName: string;
  position?: string;
  department?: string;
  roleId?: string;
  customMessage?: string;
}

export interface RoleAssignmentRequest {
  teamMemberId: string;
  roleId: string;
  isPrimary: boolean;
  effectiveFrom?: Date;
  effectiveUntil?: Date;
}

export interface TeamAnalyticsRequest {
  dateRange: {
    start: Date;
    end: Date;
  };
  department?: string;
  role?: string;
  metricTypes?: string[];
}

// Query parameters and filters
export interface TeamMembersQuery {
  page?: number;
  limit?: number;
  search?: string;
  department?: string;
  role?: string;
  isActive?: boolean;
  sortBy?: 'name' | 'createdAt' | 'role' | 'department';
  sortOrder?: 'asc' | 'desc';
}

export interface ActivityLogsQuery {
  page?: number;
  limit?: number;
  entityType?: EntityType;
  entityId?: string;
  performedBy?: string;
  action?: ActivityAction;
  dateFrom?: Date;
  dateTo?: Date;
}

// API Response types
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface TeamManagementResponse {
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    requestId: string;
  };
}

// Indonesian dealership role presets
export const INDONESIAN_DEALERSHIP_ROLES = {
  SHOWROOM_MANAGER: {
    name: 'showroom_manager',
    displayName: 'Showroom Manager',
    indonesianTitle: 'Pemilik/Kepala Showroom',
    department: 'Management',
    roleLevel: 1,
    description: 'Complete access to all showroom operations including team management, billing, inventory, and customer engagement'
  },
  SALES_MANAGER: {
    name: 'sales_manager',
    displayName: 'Sales Manager',
    indonesianTitle: 'Manager Penjualan',
    department: 'Sales',
    roleLevel: 2,
    description: 'Team oversight, inventory management, sales analytics, and customer relationship management'
  },
  SALES_EXECUTIVE: {
    name: 'sales_executive',
    displayName: 'Sales Executive',
    indonesianTitle: 'Sales Executive',
    department: 'Sales',
    roleLevel: 3,
    description: 'Customer interactions, inventory management, lead follow-up, and sales reporting'
  },
  FINANCE_MANAGER: {
    name: 'finance_manager',
    displayName: 'Finance Manager',
    indonesianTitle: 'Manager Keuangan',
    department: 'Finance',
    roleLevel: 2,
    description: 'Billing management, financial reporting, subscription oversight, and payment processing'
  },
  SERVICE_ADVISOR: {
    name: 'service_advisor',
    displayName: 'Service Advisor',
    indonesianTitle: 'Konsultan Layanan',
    department: 'Service',
    roleLevel: 3,
    description: 'After-sales service coordination, customer service, and service scheduling'
  },
  MARKETING_COORDINATOR: {
    name: 'marketing_coordinator',
    displayName: 'Marketing Coordinator',
    indonesianTitle: 'Koordinator Pemasaran',
    department: 'Marketing',
    roleLevel: 3,
    description: 'Marketing campaigns, promotional activities, customer engagement, and lead generation'
  },
  INVENTORY_MANAGER: {
    name: 'inventory_manager',
    displayName: 'Inventory Manager',
    indonesianTitle: 'Manager Inventaris',
    department: 'Inventory',
    roleLevel: 3,
    description: 'Stock management, vehicle listings, pricing updates, and inventory reporting'
  },
  READONLY_STAFF: {
    name: 'readonly_staff',
    displayName: 'Read-only Staff',
    indonesianTitle: 'Staf View-only',
    department: 'General',
    roleLevel: 4,
    description: 'Limited access for viewing reports and basic information without modification capabilities'
  }
} as const;

// Permission codes for role management
export const PERMISSION_CODES = {
  // Team Management
  TEAM_VIEW: 'team.view',
  TEAM_CREATE: 'team.create',
  TEAM_UPDATE: 'team.update',
  TEAM_DELETE: 'team.delete',
  TEAM_ROLES_MANAGE: 'team.roles.manage',
  TEAM_INVITE: 'team.invite',
  TEAM_ANALYTICS: 'team.analytics',

  // Inventory Management
  INVENTORY_VIEW: 'inventory.view',
  INVENTORY_CREATE: 'inventory.create',
  INVENTORY_UPDATE: 'inventory.update',
  INVENTORY_DELETE: 'inventory.delete',
  INVENTORY_STATUS: 'inventory.status',

  // Customer Management
  CUSTOMERS_VIEW: 'customers.view',
  CUSTOMERS_RESPOND: 'customers.respond',
  CUSTOMERS_EXPORT: 'customers.export',

  // Billing and Finance
  BILLING_VIEW: 'billing.view',
  BILLING_MANAGE: 'billing.manage',
  BILLING_PAY: 'billing.pay',
  BILLING_REPORTS: 'billing.reports',

  // Analytics
  ANALYTICS_VIEW: 'analytics.view',
  ANALYTICS_EXPORT: 'analytics.export',
  ANALYTICS_ADVANCED: 'analytics.advanced',

  // Settings
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_MANAGE: 'settings.manage',
  SETTINGS_API: 'settings.api',

  // System
  SYSTEM_AUDIT: 'system.audit',
  SYSTEM_BACKUP: 'system.backup',
  SYSTEM_MAINTENANCE: 'system.maintenance'
} as const;

// Error codes for team management
export const TEAM_ERROR_CODES = {
  MEMBER_NOT_FOUND: 'TEAM_MEMBER_NOT_FOUND',
  ROLE_NOT_FOUND: 'ROLE_NOT_FOUND',
  INVITATION_NOT_FOUND: 'INVITATION_NOT_FOUND',
  INVITATION_EXPIRED: 'INVITATION_EXPIRED',
  ALREADY_MEMBER: 'ALREADY_MEMBER',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  INVALID_ROLE_ASSIGNMENT: 'INVALID_ROLE_ASSIGNMENT',
  DUPLICATE_ROLE_ASSIGNMENT: 'DUPLICATE_ROLE_ASSIGNMENT',
  CANNOT_DELETE_PRIMARY_ROLE: 'CANNOT_DELETE_PRIMARY_ROLE',
  INVITATION_LIMIT_EXCEEDED: 'INVITATION_LIMIT_EXCEEDED',
  INVALID_EMAIL: 'INVALID_EMAIL',
  TEAM_SIZE_LIMIT_EXCEEDED: 'TEAM_SIZE_LIMIT_EXCEEDED'
} as const;