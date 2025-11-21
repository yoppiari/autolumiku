import {
  OnboardingTemplate,
  TemplateSuggestion,
  OnboardingState,
  BasicInfoData,
  BrandingData,
  PreferencesData
} from '../../../types/onboarding';

/**
 * Template Manager for Onboarding
 *
 * Manages templates and provides smart suggestions based on:
 * - Industry type
 * - Business size
 * - User preferences
 */
export class TemplateManager {
  private templates: Map<string, OnboardingTemplate> = new Map();

  constructor() {
    this.initializeTemplates();
  }

  /**
   * Apply template to onboarding state
   */
  async applyTemplate(tenantId: string, state: OnboardingState): Promise<void> {
    // Get tenant-specific template suggestions
    const suggestions = await this.getTemplateSuggestions(tenantId, state);

    if (suggestions.length > 0 && suggestions[0].confidence > 0.7) {
      const template = suggestions[0].template;

      // Apply template prefill data
      await this.applyTemplateData(template, state);

      console.log(`Applied template "${template.name}" to tenant ${tenantId}`);
    }
  }

  /**
   * Finalize configuration based on template
   */
  async finalizeConfiguration(tenantId: string, state: OnboardingState): Promise<void> {
    // Apply any final configurations based on the template used
    const basicInfo = state.stepData[OnboardingStep.BASIC_INFO] as BasicInfoData;
    const branding = state.stepData[OnboardingStep.BRANDING] as BrandingData;
    const preferences = state.stepData[OnboardingStep.PREFERENCES] as PreferencesData;

    // Apply smart defaults based on collected data
    const finalConfig = {
      tenantId,
      showroomName: basicInfo?.showroomName,
      branding: branding || this.getDefaultBranding(basicInfo),
      preferences: preferences || this.getDefaultPreferences(basicInfo),
      features: this.getRecommendedFeatures(basicInfo),
      integrations: this.getRecommendedIntegrations(basicInfo)
    };

    // In a real implementation, this would save to the tenant configuration
    console.log(`Finalized configuration for tenant ${tenantId}:`, finalConfig);
  }

  /**
   * Get template suggestions for tenant
   */
  async getTemplateSuggestions(tenantId: string, state: OnboardingState): Promise<TemplateSuggestion[]> {
    const suggestions: TemplateSuggestion[] = [];

    // Analyze current data to find best matching templates
    const basicInfo = state.stepData[OnboardingStep.BASIC_INFO] as BasicInfoData;

    if (basicInfo) {
      // Suggest automotive templates
      if (basicInfo.showroomType) {
        const automotiveTemplates = Array.from(this.templates.values())
          .filter(t => t.industry === 'automotive');

        automotiveTemplates.forEach(template => {
          const confidence = this.calculateTemplateConfidence(template, basicInfo);
          if (confidence > 0.3) {
            suggestions.push({
              template,
              confidence,
              reasons: this.getTemplateReasons(template, basicInfo)
            });
          }
        });
      }
    }

    // Sort by confidence (highest first)
    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Get all available templates
   */
  getAllTemplates(): OnboardingTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get template by ID
   */
  getTemplate(id: string): OnboardingTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Apply template data to onboarding state
   */
  private async applyTemplateData(template: OnboardingTemplate, state: OnboardingState): Promise<void> {
    const prefillData = template.prefillData;

    // Apply basic info prefill
    if (prefillData.showroomName) {
      state.stepData[OnboardingStep.BASIC_INFO] = {
        ...state.stepData[OnboardingStep.BASIC_INFO],
        ...prefillData
      };
    }

    // Apply branding prefill
    if (prefillData.primaryColor || prefillData.theme) {
      state.stepData[OnboardingStep.BRANDING] = {
        ...state.stepData[OnboardingStep.BRANDING],
        ...prefillData
      };
    }

    // Apply preferences prefill
    if (prefillData.language || prefillData.timezone) {
      state.stepData[OnboardingStep.PREFERENCES] = {
        ...state.stepData[OnboardingStep.PREFERENCES],
        ...prefillData
      };
    }
  }

  /**
   * Calculate template confidence score
   */
  private calculateTemplateConfidence(template: OnboardingTemplate, basicInfo: BasicInfoData): number {
    let confidence = 0.5; // Base confidence

    // Industry match
    if (template.industry === 'automotive') {
      confidence += 0.3;
    }

    // Size match
    const estimatedSize = this.estimateBusinessSize(basicInfo);
    if (template.size === estimatedSize) {
      confidence += 0.2;
    }

    // Category match
    if (template.category === 'automotive' && basicInfo.showroomType) {
      confidence += 0.1;
    }

    return Math.min(1.0, confidence);
  }

  /**
   * Get reasons for template suggestion
   */
  private getTemplateReasons(template: OnboardingTemplate, basicInfo: BasicInfoData): string[] {
    const reasons: string[] = [];

    if (template.industry === 'automotive') {
      reasons.push('Template dirancang khusus untuk industri otomotif');
    }

    const estimatedSize = this.estimateBusinessSize(basicInfo);
    if (template.size === estimatedSize) {
      const sizeMap = {
        'small': 'Cocok untuk showroom kecil',
        'medium': 'Cocok untuk showroom menengah',
        'large': 'Cocok untuk showroom besar'
      };
      reasons.push(sizeMap[template.size]);
    }

    if (template.category === 'automotive' && basicInfo.showroomType) {
      reasons.push(`Konfigurasi optimal untuk showroom ${basicInfo.showroomType}`);
    }

    return reasons;
  }

  /**
   * Estimate business size based on basic info
   */
  private estimateBusinessSize(basicInfo: BasicInfoData): 'small' | 'medium' | 'large' {
    // Simple heuristic based on showroom type and business details
    if (basicInfo.showroomType === 'both') {
      return 'large';
    } else if (basicInfo.businessLicense || basicInfo.taxId) {
      return 'medium';
    } else {
      return 'small';
    }
  }

  /**
   * Get default branding based on business info
   */
  private getDefaultBranding(basicInfo?: BasicInfoData): Partial<BrandingData> {
    const defaults: Partial<BrandingData> = {
      theme: 'modern',
      primaryColor: '#1e40af', // Professional blue
      secondaryColor: '#64748b', // Neutral gray
      accentColor: '#dc2626' // Attention red
    };

    // Customize based on showroom type
    if (basicInfo?.showroomType) {
      switch (basicInfo.showroomType) {
        case 'new_car':
          defaults.theme = 'corporate';
          defaults.primaryColor = '#1e40af';
          break;
        case 'used_car':
          defaults.theme = 'classic';
          defaults.primaryColor = '#059669';
          break;
        case 'both':
          defaults.theme = 'modern';
          defaults.primaryColor = '#7c3aed';
          break;
      }
    }

    return defaults;
  }

  /**
   * Get default preferences based on business info
   */
  private getDefaultPreferences(basicInfo?: BasicInfoData): Partial<PreferencesData> {
    const defaults: Partial<PreferencesData> = {
      language: 'id',
      timezone: 'Asia/Jakarta',
      currency: 'IDR',
      notificationFrequency: 'weekly',
      emailNotifications: true,
      smsNotifications: false,
      whatsappNotifications: true,
      features: {
        inventoryManagement: true,
        customerManagement: true,
        reporting: true,
        websiteGeneration: true,
        aiTools: true
      },
      integrations: {}
    };

    // Customize notification frequency based on estimated business size
    const estimatedSize = basicInfo ? this.estimateBusinessSize(basicInfo) : 'small';
    if (estimatedSize === 'large') {
      defaults.notificationFrequency = 'daily';
      defaults.smsNotifications = true;
    }

    return defaults;
  }

  /**
   * Get recommended features based on business type
   */
  private getRecommendedFeatures(basicInfo?: BasicInfoData): Record<string, boolean> {
    const baseFeatures = {
      inventoryManagement: true,
      customerManagement: true,
      reporting: true,
      websiteGeneration: true,
      aiTools: true
    };

    // Customize based on showroom type
    if (basicInfo?.showroomType) {
      switch (basicInfo.showroomType) {
        case 'new_car':
          return {
            ...baseFeatures,
            customerManagement: true,
            reporting: true
          };
        case 'used_car':
          return {
            ...baseFeatures,
            inventoryManagement: true,
            aiTools: true
          };
        case 'both':
          return baseFeatures;
      }
    }

    return baseFeatures;
  }

  /**
   * Get recommended integrations based on business type
   */
  private getRecommendedIntegrations(basicInfo?: BasicInfoData): Record<string, string> {
    const integrations: Record<string, string> = {};

    // Suggest integrations based on business size and type
    const estimatedSize = basicInfo ? this.estimateBusinessSize(basicInfo) : 'small';

    if (estimatedSize === 'medium' || estimatedSize === 'large') {
      integrations.accounting = 'quickbooks'; // Suggest accounting software
    }

    if (basicInfo?.showroomType === 'new_car') {
      integrations.crm = 'hubspot'; // Suggest CRM for new car dealerships
    }

    if (basicInfo?.showroomType === 'used_car') {
      integrations.marketing = 'facebook'; // Suggest marketing for used car dealerships
    }

    return integrations;
  }

  /**
   * Initialize built-in templates
   */
  private initializeTemplates(): void {
    // Automotive Small Business Template
    this.templates.set('automotive-small', {
      id: 'automotive-small',
      name: 'Showroom Mobil Kecil',
      description: 'Template optimal untuk showroom mobil kecil dengan tim terbatas',
      category: 'automotive',
      prefillData: {
        showroomType: 'used_car',
        language: 'id',
        timezone: 'Asia/Jakarta',
        currency: 'IDR',
        notificationFrequency: 'weekly',
        theme: 'classic',
        features: {
          inventoryManagement: true,
          customerManagement: true,
          reporting: false,
          websiteGeneration: true,
          aiTools: true
        }
      },
      suggestedSteps: [
        OnboardingStep.WELCOME,
        OnboardingStep.BASIC_INFO,
        OnboardingStep.BRANDING,
        OnboardingStep.PREFERENCES,
        OnboardingStep.COMPLETE
      ],
      industry: 'automotive',
      size: 'small'
    });

    // Automotive Medium Business Template
    this.templates.set('automotive-medium', {
      id: 'automotive-medium',
      name: 'Showroom Mobil Menengah',
      description: 'Template untuk showroom mobil menengah dengan beberapa staf',
      category: 'automotive',
      prefillData: {
        language: 'id',
        timezone: 'Asia/Jakarta',
        currency: 'IDR',
        notificationFrequency: 'daily',
        theme: 'modern',
        features: {
          inventoryManagement: true,
          customerManagement: true,
          reporting: true,
          websiteGeneration: true,
          aiTools: true
        },
        integrations: {
          accounting: 'quickbooks'
        }
      },
      suggestedSteps: [
        OnboardingStep.WELCOME,
        OnboardingStep.BASIC_INFO,
        OnboardingStep.BRANDING,
        OnboardingStep.TEAM,
        OnboardingStep.PREFERENCES,
        OnboardingStep.COMPLETE
      ],
      industry: 'automotive',
      size: 'medium'
    });

    // Automotive Large Business Template
    this.templates.set('automotive-large', {
      id: 'automotive-large',
      name: 'Showroom Mobil Besar',
      description: 'Template komprehensif untuk showroom mobil besar dengan tim lengkap',
      category: 'automotive',
      prefillData: {
        language: 'id',
        timezone: 'Asia/Jakarta',
        currency: 'IDR',
        notificationFrequency: 'daily',
        theme: 'corporate',
        features: {
          inventoryManagement: true,
          customerManagement: true,
          reporting: true,
          websiteGeneration: true,
          aiTools: true
        },
        integrations: {
          accounting: 'quickbooks',
          crm: 'hubspot',
          marketing: 'facebook'
        }
      },
      suggestedSteps: [
        OnboardingStep.WELCOME,
        OnboardingStep.BASIC_INFO,
        OnboardingStep.BRANDING,
        OnboardingStep.TEAM,
        OnboardingStep.PREFERENCES,
        OnboardingStep.COMPLETE
      ],
      industry: 'automotive',
      size: 'large'
    });

    // New Car Dealer Template
    this.templates.set('new-car-dealer', {
      id: 'new-car-dealer',
      name: 'Dealer Mobil Baru',
      description: 'Template khusus untuk dealer mobil baru resmi',
      category: 'automotive',
      prefillData: {
        showroomType: 'new_car',
        language: 'id',
        timezone: 'Asia/Jakarta',
        currency: 'IDR',
        notificationFrequency: 'daily',
        theme: 'corporate',
        primaryColor: '#1e40af',
        features: {
          inventoryManagement: true,
          customerManagement: true,
          reporting: true,
          websiteGeneration: true,
          aiTools: true
        },
        integrations: {
          crm: 'hubspot'
        }
      },
      suggestedSteps: [
        OnboardingStep.WELCOME,
        OnboardingStep.BASIC_INFO,
        OnboardingStep.BRANDING,
        OnboardingStep.TEAM,
        OnboardingStep.PREFERENCES,
        OnboardingStep.COMPLETE
      ],
      industry: 'automotive',
      size: 'medium'
    });

    // Used Car Dealer Template
    this.templates.set('used-car-dealer', {
      id: 'used-car-dealer',
      name: 'Dealer Mobil Bekas',
      description: 'Template optimal untuk dealer mobil bekas',
      category: 'automotive',
      prefillData: {
        showroomType: 'used_car',
        language: 'id',
        timezone: 'Asia/Jakarta',
        currency: 'IDR',
        notificationFrequency: 'weekly',
        theme: 'classic',
        primaryColor: '#059669',
        features: {
          inventoryManagement: true,
          customerManagement: true,
          reporting: false,
          websiteGeneration: true,
          aiTools: true
        },
        integrations: {
          marketing: 'facebook'
        }
      },
      suggestedSteps: [
        OnboardingStep.WELCOME,
        OnboardingStep.BASIC_INFO,
        OnboardingStep.BRANDING,
        OnboardingStep.TEAM,
        OnboardingStep.PREFERENCES,
        OnboardingStep.COMPLETE
      ],
      industry: 'automotive',
      size: 'small'
    });
  }
}

// Export singleton instance
export const templateManager = new TemplateManager();