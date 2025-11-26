/**
 * Theme Service
 * Epic 5: Story 5.8 - Multiple Themes
 */

import { PrismaClient } from '@prisma/client';
import { getTheme, getAllThemes, generateCSSVariables, ThemeDefinition } from '@/lib/themes/theme-definitions';

const prisma = new PrismaClient();

export class ThemeService {
  /**
   * Get selected theme for a tenant
   */
  static async getSelectedTheme(tenantId: string): Promise<string> {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { selectedTheme: true },
      });

      return tenant?.selectedTheme || 'modern';
    } catch (error) {
      console.error('Failed to get selected theme:', error);
      return 'modern';
    }
  }

  /**
   * Set theme for a tenant
   */
  static async setTheme(tenantId: string, themeId: string): Promise<void> {
    try {
      // Validate theme exists
      const theme = getTheme(themeId);
      if (!theme) {
        throw new Error(`Theme ${themeId} not found`);
      }

      await prisma.tenant.update({
        where: { id: tenantId },
        data: { selectedTheme: themeId },
      });
    } catch (error) {
      console.error('Failed to set theme:', error);
      throw error;
    }
  }

  /**
   * Get theme definition by ID
   */
  static getThemeDefinition(themeId: string): ThemeDefinition {
    return getTheme(themeId);
  }

  /**
   * Get all available themes
   */
  static getAllThemes(): ThemeDefinition[] {
    return getAllThemes();
  }

  /**
   * Generate CSS variables for a theme
   */
  static generateThemeCSS(themeId: string, mode: 'light' | 'dark' = 'light'): string {
    const theme = getTheme(themeId);
    return generateCSSVariables(theme, mode);
  }

  /**
   * Get theme CSS variables for a tenant
   */
  static async getTenantThemeCSS(tenantId: string, mode: 'light' | 'dark' = 'light'): Promise<string> {
    try {
      const themeId = await this.getSelectedTheme(tenantId);
      return this.generateThemeCSS(themeId, mode);
    } catch (error) {
      console.error('Failed to get tenant theme CSS:', error);
      return this.generateThemeCSS('modern', mode);
    }
  }

  /**
   * Preview theme (without saving)
   */
  static previewTheme(themeId: string): {
    theme: ThemeDefinition;
    cssLight: string;
    cssDark?: string;
  } {
    const theme = getTheme(themeId);
    const cssLight = generateCSSVariables(theme, 'light');
    const cssDark = theme.colors.dark ? generateCSSVariables(theme, 'dark') : undefined;

    return {
      theme,
      cssLight,
      cssDark,
    };
  }
}
