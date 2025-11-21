/**
 * Global Platform Settings Service
 * Manages platform-wide configurations and settings hierarchy
 * Part of Story 1.11: Global Platform Settings Management
 */

import { createLogger, format, transports } from 'winston';
import { z } from 'zod';

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
    new transports.File({ filename: 'logs/settings-error.log', level: 'error' }),
    new transports.File({ filename: 'logs/settings-combined.log' })
  ]
});

/**
 * Setting types for the platform
 */
export enum SettingCategory {
  PLATFORM = 'platform',
  INDONESIAN_REGIONAL = 'indonesian_regional',
  SECURITY = 'security',
  BILLING = 'billing',
  COMPLIANCE = 'compliance',
  FEATURES = 'features',
  INTEGRATIONS = 'integrations',
  UI_UX = 'ui_ux'
}

export enum SettingScope {
  GLOBAL = 'global',
  TENANT = 'tenant',
  USER = 'user'
}

export interface PlatformSetting {
  id: string;
  key: string;
  value: any;
  category: SettingCategory;
  scope: SettingScope;
  description?: string;
  dataType: 'string' | 'number' | 'boolean' | 'json' | 'array';
  isSecret?: boolean;
  validation?: z.ZodSchema;
  defaultValue?: any;
  tenantId?: string;
  userId?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

export interface SettingChange {
  id: string;
  settingId: string;
  settingKey: string;
  oldValue: any;
  newValue: any;
  changedBy: string;
  changedAt: Date;
  reason?: string;
  tenantId?: string;
}

export interface MaintenanceMode {
  enabled: boolean;
  message: string;
  messageIndonesian: string;
  scheduledStart?: Date;
  scheduledEnd?: Date;
  allowedUsers?: string[];
  reason: string;
}

/**
 * Indonesian Regional Settings
 */
export interface IndonesianRegionalSettings {
  defaultTimezone: string; // 'Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'
  defaultCurrency: string; // 'IDR'
  defaultLanguage: string; // 'id'
  supportedLanguages: string[]; // ['id', 'en']
  dateFormat: string; // 'DD/MM/YYYY'
  timeFormat: string; // '24h'
  numberFormat: {
    decimalSeparator: string; // ','
    thousandsSeparator: string; // '.'
  };
  taxSettings: {
    ppnRate: number; // 11% (PPN - Pajak Pertambahan Nilai)
    pph23Rate: number; // 2% (PPh 23 for services)
    includeTaxInPrice: boolean;
  };
  businessSettings: {
    workingDays: number[]; // [1,2,3,4,5] (Monday-Friday)
    workingHours: {
      start: string; // '08:00'
      end: string; // '17:00'
    };
    holidays: Array<{
      date: string;
      name: string;
    }>;
  };
}

export class GlobalSettingsService {
  private settingsCache: Map<string, PlatformSetting> = new Map();
  private maintenanceMode: MaintenanceMode = {
    enabled: false,
    message: 'System is under maintenance',
    messageIndonesian: 'Sistem sedang dalam pemeliharaan',
    reason: ''
  };

  constructor() {
    this.loadDefaultSettings();
  }

  /**
   * Load default platform settings
   */
  private loadDefaultSettings(): void {
    logger.info('Loading default platform settings');

    // Default Indonesian Regional Settings
    this.setDefaultSetting('indonesian.timezone', 'Asia/Jakarta', SettingCategory.INDONESIAN_REGIONAL);
    this.setDefaultSetting('indonesian.currency', 'IDR', SettingCategory.INDONESIAN_REGIONAL);
    this.setDefaultSetting('indonesian.language', 'id', SettingCategory.INDONESIAN_REGIONAL);
    this.setDefaultSetting('indonesian.ppn_rate', 11, SettingCategory.INDONESIAN_REGIONAL);
    this.setDefaultSetting('indonesian.pph23_rate', 2, SettingCategory.INDONESIAN_REGIONAL);

    // Platform Features
    this.setDefaultSetting('features.ai_suggestions', true, SettingCategory.FEATURES);
    this.setDefaultSetting('features.auto_backup', true, SettingCategory.FEATURES);
    this.setDefaultSetting('features.two_factor_auth', false, SettingCategory.FEATURES);

    // Security Settings
    this.setDefaultSetting('security.session_timeout', 1800, SettingCategory.SECURITY); // 30 minutes
    this.setDefaultSetting('security.max_login_attempts', 5, SettingCategory.SECURITY);
    this.setDefaultSetting('security.password_min_length', 8, SettingCategory.SECURITY);
    this.setDefaultSetting('security.require_email_verification', true, SettingCategory.SECURITY);

    // Platform Settings
    this.setDefaultSetting('platform.max_tenants', 1000, SettingCategory.PLATFORM);
    this.setDefaultSetting('platform.max_users_per_tenant', 50, SettingCategory.PLATFORM);
    this.setDefaultSetting('platform.default_plan', 'basic', SettingCategory.PLATFORM);
  }

  private setDefaultSetting(key: string, value: any, category: SettingCategory): void {
    const setting: PlatformSetting = {
      id: `default_${key}`,
      key,
      value,
      category,
      scope: SettingScope.GLOBAL,
      dataType: typeof value as any,
      defaultValue: value,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'system',
      updatedBy: 'system'
    };

    this.settingsCache.set(key, setting);
  }

  /**
   * Get setting value with hierarchy fallback (user > tenant > global)
   */
  async getSetting(
    key: string,
    options?: {
      tenantId?: string;
      userId?: string;
      scope?: SettingScope;
    }
  ): Promise<any> {
    try {
      // Try user-specific setting first
      if (options?.userId) {
        const userSetting = await this.getUserSetting(key, options.userId);
        if (userSetting !== null) return userSetting;
      }

      // Try tenant-specific setting
      if (options?.tenantId) {
        const tenantSetting = await this.getTenantSetting(key, options.tenantId);
        if (tenantSetting !== null) return tenantSetting;
      }

      // Fallback to global setting
      const globalSetting = this.settingsCache.get(key);
      return globalSetting?.value ?? null;
    } catch (error) {
      logger.error(`Error getting setting ${key}:`, error);
      throw error;
    }
  }

  /**
   * Set global setting value
   */
  async setGlobalSetting(
    key: string,
    value: any,
    options: {
      category: SettingCategory;
      description?: string;
      updatedBy: string;
      reason?: string;
    }
  ): Promise<PlatformSetting> {
    try {
      const existingSetting = this.settingsCache.get(key);

      // Track change
      if (existingSetting) {
        await this.trackSettingChange({
          settingKey: key,
          oldValue: existingSetting.value,
          newValue: value,
          changedBy: options.updatedBy,
          reason: options.reason
        });
      }

      const setting: PlatformSetting = {
        id: existingSetting?.id || `global_${key}_${Date.now()}`,
        key,
        value,
        category: options.category,
        scope: SettingScope.GLOBAL,
        description: options.description,
        dataType: typeof value as any,
        defaultValue: existingSetting?.defaultValue,
        createdAt: existingSetting?.createdAt || new Date(),
        updatedAt: new Date(),
        createdBy: existingSetting?.createdBy || options.updatedBy,
        updatedBy: options.updatedBy
      };

      this.settingsCache.set(key, setting);

      logger.info(`Global setting ${key} updated by ${options.updatedBy}`);

      return setting;
    } catch (error) {
      logger.error(`Error setting global setting ${key}:`, error);
      throw error;
    }
  }

  /**
   * Set tenant-specific setting
   */
  async setTenantSetting(
    key: string,
    value: any,
    tenantId: string,
    updatedBy: string
  ): Promise<PlatformSetting> {
    // In production, this would save to database with tenant_id
    logger.info(`Tenant setting ${key} updated for tenant ${tenantId} by ${updatedBy}`);

    return {
      id: `tenant_${tenantId}_${key}`,
      key,
      value,
      category: SettingCategory.PLATFORM,
      scope: SettingScope.TENANT,
      dataType: typeof value as any,
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: updatedBy,
      updatedBy
    };
  }

  /**
   * Get tenant-specific setting
   */
  private async getTenantSetting(key: string, tenantId: string): Promise<any> {
    // In production, this would query database
    return null;
  }

  /**
   * Get user-specific setting
   */
  private async getUserSetting(key: string, userId: string): Promise<any> {
    // In production, this would query database
    return null;
  }

  /**
   * Get all settings by category
   */
  async getSettingsByCategory(category: SettingCategory): Promise<PlatformSetting[]> {
    return Array.from(this.settingsCache.values())
      .filter(setting => setting.category === category);
  }

  /**
   * Get Indonesian regional settings
   */
  async getIndonesianRegionalSettings(): Promise<IndonesianRegionalSettings> {
    const timezone = await this.getSetting('indonesian.timezone');
    const currency = await this.getSetting('indonesian.currency');
    const language = await this.getSetting('indonesian.language');
    const ppnRate = await this.getSetting('indonesian.ppn_rate');
    const pph23Rate = await this.getSetting('indonesian.pph23_rate');

    return {
      defaultTimezone: timezone || 'Asia/Jakarta',
      defaultCurrency: currency || 'IDR',
      defaultLanguage: language || 'id',
      supportedLanguages: ['id', 'en'],
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '24h',
      numberFormat: {
        decimalSeparator: ',',
        thousandsSeparator: '.'
      },
      taxSettings: {
        ppnRate: ppnRate || 11,
        pph23Rate: pph23Rate || 2,
        includeTaxInPrice: true
      },
      businessSettings: {
        workingDays: [1, 2, 3, 4, 5],
        workingHours: {
          start: '08:00',
          end: '17:00'
        },
        holidays: []
      }
    };
  }

  /**
   * Enable maintenance mode
   */
  async enableMaintenanceMode(
    config: {
      message: string;
      messageIndonesian: string;
      scheduledStart?: Date;
      scheduledEnd?: Date;
      allowedUsers?: string[];
      reason: string;
      enabledBy: string;
    }
  ): Promise<MaintenanceMode> {
    this.maintenanceMode = {
      enabled: true,
      message: config.message,
      messageIndonesian: config.messageIndonesian,
      scheduledStart: config.scheduledStart,
      scheduledEnd: config.scheduledEnd,
      allowedUsers: config.allowedUsers,
      reason: config.reason
    };

    logger.warn(`Maintenance mode enabled by ${config.enabledBy}: ${config.reason}`);

    return this.maintenanceMode;
  }

  /**
   * Disable maintenance mode
   */
  async disableMaintenanceMode(disabledBy: string): Promise<void> {
    this.maintenanceMode.enabled = false;
    logger.info(`Maintenance mode disabled by ${disabledBy}`);
  }

  /**
   * Check if maintenance mode is active
   */
  isMaintenanceModeActive(userId?: string): boolean {
    if (!this.maintenanceMode.enabled) return false;

    // Allow specific users during maintenance
    if (userId && this.maintenanceMode.allowedUsers?.includes(userId)) {
      return false;
    }

    // Check scheduled time window
    if (this.maintenanceMode.scheduledStart && this.maintenanceMode.scheduledEnd) {
      const now = new Date();
      return now >= this.maintenanceMode.scheduledStart && now <= this.maintenanceMode.scheduledEnd;
    }

    return true;
  }

  /**
   * Get maintenance mode config
   */
  getMaintenanceModeConfig(): MaintenanceMode {
    return this.maintenanceMode;
  }

  /**
   * Track setting change for audit
   */
  private async trackSettingChange(change: {
    settingKey: string;
    oldValue: any;
    newValue: any;
    changedBy: string;
    tenantId?: string;
    reason?: string;
  }): Promise<void> {
    const changeRecord: SettingChange = {
      id: `change_${Date.now()}`,
      settingId: `setting_${change.settingKey}`,
      settingKey: change.settingKey,
      oldValue: change.oldValue,
      newValue: change.newValue,
      changedBy: change.changedBy,
      changedAt: new Date(),
      reason: change.reason,
      tenantId: change.tenantId
    };

    logger.info('Setting change tracked:', changeRecord);
    // In production, save to database
  }

  /**
   * Get setting change history
   */
  async getSettingChangeHistory(settingKey: string): Promise<SettingChange[]> {
    // In production, query from database
    return [];
  }

  /**
   * Validate setting value
   */
  validateSetting(setting: PlatformSetting, value: any): boolean {
    if (setting.validation) {
      try {
        setting.validation.parse(value);
        return true;
      } catch (error) {
        logger.error(`Validation failed for setting ${setting.key}:`, error);
        return false;
      }
    }

    // Basic type checking
    return typeof value === setting.dataType;
  }

  /**
   * Reset setting to default value
   */
  async resetToDefault(key: string, updatedBy: string): Promise<PlatformSetting | null> {
    const setting = this.settingsCache.get(key);
    if (!setting || !setting.defaultValue) {
      return null;
    }

    return await this.setGlobalSetting(key, setting.defaultValue, {
      category: setting.category,
      description: setting.description,
      updatedBy,
      reason: 'Reset to default value'
    });
  }

  /**
   * Bulk update settings
   */
  async bulkUpdateSettings(
    settings: Array<{ key: string; value: any; category: SettingCategory }>,
    updatedBy: string
  ): Promise<PlatformSetting[]> {
    const results: PlatformSetting[] = [];

    for (const setting of settings) {
      const result = await this.setGlobalSetting(setting.key, setting.value, {
        category: setting.category,
        updatedBy,
        reason: 'Bulk update'
      });
      results.push(result);
    }

    return results;
  }

  /**
   * Export all settings
   */
  async exportSettings(scope?: SettingScope): Promise<PlatformSetting[]> {
    const allSettings = Array.from(this.settingsCache.values());

    if (scope) {
      return allSettings.filter(s => s.scope === scope);
    }

    return allSettings;
  }
}

// Singleton instance
export const globalSettingsService = new GlobalSettingsService();
