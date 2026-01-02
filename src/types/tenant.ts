export type TenantStatus = 'setup_required' | 'active' | 'suspended' | 'deactivated';

export interface CreateTenantRequest {
  name: string;
  domain: string; // Main domain or custom domain
  subdomain?: string; // Manual subdomain entry (optional)
  status?: TenantStatus; // Status selection (optional)
  adminEmail: string;
  adminFirstName: string;
  adminLastName: string;
  adminPassword?: string; // Optional - if not provided, auto-generate
  autoGeneratePassword?: boolean; // Flag to auto-generate password
}

export interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  customDomain?: string; // Custom domain (optional)
  dbName: string;
  status: TenantStatus;
  adminUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantListResponse {
  tenants: Tenant[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TenantHealth {
  tenantId: string;
  database: {
    exists: boolean;
    tables: number;
    lastHealthCheck: Date;
  };
  configuration: {
    exists: boolean;
    lastHealthCheck: Date;
  };
  lastHealthCheck: Date;
}

export interface TenantConfiguration {
  tenantName: string;
  tenantSubdomain: string;
  tenantStatus: TenantStatus;
  tenantLanguage: string;
  tenantTimezone: string;
  branding: {
    primaryColor?: string;
    logo?: string;
    customDomain?: string;
  };
  features: {
    enableCustomDomain: boolean;
    enableBranding: boolean;
    enableAdvancedAnalytics: boolean;
  };
}

export interface TenantUser {
  id: string;
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'manager' | 'staff' | 'viewer';
  isActive: boolean;
  emailVerified: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantActivityLog {
  id: string;
  tenantId: string;
  userId: string;
  action: string;
  entity?: string;
  entityId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export interface TenantMetrics {
  tenantId: string;
  userCount: number;
  storageUsed: number;
  apiCalls: number;
  lastActivity: Date;
  createdAt: Date;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
  maxConnections: number;
}