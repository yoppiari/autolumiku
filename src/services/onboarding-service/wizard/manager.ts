import {
  OnboardingState,
  OnboardingStep,
  OnboardingConfig,
  StepDefinition,
  HelpContent,
  StepDataMap,
  SmartSuggestion
} from '../../../types/onboarding';
import { stepDefinitions } from './steps';
import { validationService } from '../validation';

/**
 * Onboarding Wizard Manager
 *
 * Manages the step-by-step onboarding wizard including:
 * - Step definitions and navigation
 * - Data validation and persistence
 * - Help content management
 * - Smart suggestions
 */
export class OnboardingManager {
  private states: Map<string, OnboardingState> = new Map();
  private stepDefinitions: Map<OnboardingStep, StepDefinition> = new Map();

  constructor() {
    this.initializeStepDefinitions();
  }

  /**
   * Create new onboarding state
   */
  async createState(config: OnboardingConfig): Promise<OnboardingState> {
    const id = this.generateOnboardingId();

    const state: OnboardingState = {
      id,
      ...config,
      stepData: {} as StepDataMap,
      lastActivity: new Date(),
      isCompleted: false
    };

    // Initialize step data with empty objects
    Object.values(OnboardingStep).forEach(step => {
      state.stepData[step] = {};
    });

    this.states.set(id, state);
    return state;
  }

  /**
   * Get onboarding state by ID
   */
  async getState(onboardingId: string, tenantId: string): Promise<OnboardingState | null> {
    const state = this.states.get(onboardingId);
    if (!state || state.tenantId !== tenantId) {
      return null;
    }
    return state;
  }

  /**
   * Update current step
   */
  async updateStep(onboardingId: string, newStep: OnboardingStep): Promise<OnboardingState> {
    const state = this.states.get(onboardingId);
    if (!state) {
      throw new Error('Onboarding state not found');
    }

    // Add current step to completed if not already there
    if (!state.completedSteps.includes(state.currentStep)) {
      state.completedSteps.push(state.currentStep);
    }

    // Update current step
    state.currentStep = newStep;
    state.lastActivity = new Date();

    // Check if onboarding is complete
    if (newStep === OnboardingStep.COMPLETE) {
      state.isCompleted = true;
      state.completionTime = new Date();
    }

    this.states.set(onboardingId, state);
    return state;
  }

  /**
   * Save step data
   */
  async saveStepData(onboardingId: string, step: OnboardingStep, data: any): Promise<void> {
    const state = this.states.get(onboardingId);
    if (!state) {
      throw new Error('Onboarding state not found');
    }

    state.stepData[step] = { ...state.stepData[step], ...data };
    state.lastActivity = new Date();
    this.states.set(onboardingId, state);
  }

  /**
   * Get step data
   */
  async getStepData(onboardingId: string, step: OnboardingStep): Promise<any> {
    const state = this.states.get(onboardingId);
    if (!state) {
      throw new Error('Onboarding state not found');
    }

    return state.stepData[step];
  }

  /**
   * Get step definition
   */
  getStepDefinition(step: OnboardingStep): StepDefinition | undefined {
    return this.stepDefinitions.get(step);
  }

  /**
   * Get all step definitions
   */
  getAllStepDefinitions(): StepDefinition[] {
    return Array.from(this.stepDefinitions.values());
  }

  /**
   * Validate step data
   */
  async validateStepData(step: OnboardingStep, data: any): Promise<{ isValid: boolean; errors: string[] }> {
    const stepDef = this.stepDefinitions.get(step);
    if (!stepDef || !stepDef.validation) {
      return { isValid: true, errors: [] };
    }

    return await validationService.validate(data, stepDef.validation);
  }

  /**
   * Get help content for step
   */
  async getHelpContent(step: OnboardingStep, context: any): Promise<HelpContent | null> {
    const stepDef = this.stepDefinitions.get(step);
    if (!stepDef?.helpContent) {
      return null;
    }

    return stepDef.helpContent;
  }

  /**
   * Get smart suggestions for step
   */
  async getSuggestions(step: OnboardingStep, input: any): Promise<SmartSuggestion[]> {
    const suggestions: SmartSuggestion[] = [];

    switch (step) {
      case OnboardingStep.BASIC_INFO:
        suggestions.push(...this.getBasicInfoSuggestions(input));
        break;
      case OnboardingStep.BRANDING:
        suggestions.push(...this.getBrandingSuggestions(input));
        break;
      case OnboardingStep.TEAM:
        suggestions.push(...this.getTeamSuggestions(input));
        break;
      case OnboardingStep.PREFERENCES:
        suggestions.push(...this.getPreferencesSuggestions(input));
        break;
    }

    return suggestions;
  }

  /**
   * Check if step can be skipped
   */
  canSkipStep(step: OnboardingStep): boolean {
    const stepDef = this.stepDefinitions.get(step);
    return stepDef ? !stepDef.required : true;
  }

  /**
   * Get estimated time for step
   */
  getStepEstimatedTime(step: OnboardingStep): number {
    const stepDef = this.stepDefinitions.get(step);
    return stepDef?.estimatedTime || 5;
  }

  /**
   * Get total estimated time for onboarding
   */
  getTotalEstimatedTime(skipOptional: boolean = false): number {
    let totalTime = 0;

    for (const [step, stepDef] of this.stepDefinitions) {
      if (skipOptional && !stepDef.required) {
        continue;
      }
      totalTime += stepDef.estimatedTime;
    }

    return totalTime;
  }

  /**
   * Initialize step definitions
   */
  private initializeStepDefinitions(): void {
    stepDefinitions.forEach(stepDef => {
      this.stepDefinitions.set(stepDef.id, stepDef);
    });
  }

  /**
   * Generate unique onboarding ID
   */
  private generateOnboardingId(): string {
    return `onb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get suggestions for basic info step
   */
  private getBasicInfoSuggestions(input: any): SmartSuggestion[] {
    const suggestions: SmartSuggestion[] = [];

    // Suggest showroom type based on input
    if (input.showroomName && !input.showroomType) {
      suggestions.push({
        step: OnboardingStep.BASIC_INFO,
        field: 'showroomType',
        suggestions: [{
          type: 'tip',
          title: 'Pilih Jenis Showroom',
          content: 'Berdasarkan nama showroom Anda, kami sarankan untuk memilih jenis showroom yang sesuai dengan bisnis Anda.',
          priority: 'medium'
        }],
        context: input
      });
    }

    // Suggest website format
    if (input.showroomName && !input.website) {
      const websiteSuggestion = `${input.showroomName.toLowerCase().replace(/\s+/g, '')}.com`;
      suggestions.push({
        step: OnboardingStep.BASIC_INFO,
        field: 'website',
        suggestions: [{
          type: 'tip',
          title: 'Saran Website',
          content: `Pertimbangkan untuk menggunakan: ${websiteSuggestion}`,
          priority: 'low'
        }],
        context: input
      });
    }

    return suggestions;
  }

  /**
   * Get suggestions for branding step
   */
  private getBrandingSuggestions(input: any): SmartSuggestion[] {
    const suggestions: SmartSuggestion[] = [];

    // Suggest colors based on industry
    if (!input.primaryColor) {
      suggestions.push({
        step: OnboardingStep.BRANDING,
        field: 'primaryColor',
        suggestions: [{
          type: 'tip',
          title: 'Warna Utama untuk Showroom Mobil',
          content: 'Pertimbangkan warna biru profesional (#1e40af) atau merah berani (#dc2626) yang sering digunakan dalam industri otomotif.',
          priority: 'medium'
        }],
        context: input
      });
    }

    // Suggest theme based on showroom type
    const basicInfo = this.getPreviousStepData(OnboardingStep.BRANDING);
    if (basicInfo?.showroomType && !input.theme) {
      let themeSuggestion = '';
      if (basicInfo.showroomType === 'new_car') {
        themeSuggestion = 'modern';
      } else if (basicInfo.showroomType === 'used_car') {
        themeSuggestion = 'classic';
      } else {
        themeSuggestion = 'corporate';
      }

      suggestions.push({
        step: OnboardingStep.BRANDING,
        field: 'theme',
        suggestions: [{
          type: 'tip',
          title: 'Tema yang Direkomendasikan',
          content: `Berdasarkan jenis showroom Anda, kami sarankan tema "${themeSuggestion}".`,
          priority: 'medium'
        }],
        context: input
      });
    }

    return suggestions;
  }

  /**
   * Get suggestions for team step
   */
  private getTeamSuggestions(input: any): SmartSuggestion[] {
    const suggestions: SmartSuggestion[] = [];

    // Suggest team structure based on showroom type
    const basicInfo = this.getPreviousStepData(OnboardingStep.TEAM);
    if (basicInfo?.showroomType && (!input.invitations || input.invitations.length === 0)) {
      const suggestions_map = {
        'new_car': ['sales', 'manager'],
        'used_car': ['sales', 'admin'],
        'both': ['sales', 'manager', 'admin']
      };

      const suggestedRoles = suggestions_map[basicInfo.showroomType as keyof typeof suggestions_map] || ['sales'];

      suggestions.push({
        step: OnboardingStep.TEAM,
        field: 'invitations',
        suggestions: [{
          type: 'tip',
          title: 'Struktur Tim yang Direkomendasikan',
          content: `Untuk showroom ${basicInfo.showroomType}, pertimbangkan untuk menambahkan peran: ${suggestedRoles.join(', ')}`,
          priority: 'medium'
        }],
        context: input
      });
    }

    return suggestions;
  }

  /**
   * Get suggestions for preferences step
   */
  private getPreferencesSuggestions(input: any): SmartSuggestion[] {
    const suggestions: SmartSuggestion[] = [];

    // Suggest notification frequency based on team size
    const teamData = this.getPreviousStepData(OnboardingStep.PREFERENCES);
    const teamSize = teamData?.invitations?.length || 1;

    if (!input.notificationFrequency) {
      let frequencySuggestion = 'weekly';
      if (teamSize > 5) {
        frequencySuggestion = 'daily';
      } else if (teamSize <= 2) {
        frequencySuggestion = 'monthly';
      }

      suggestions.push({
        step: OnboardingStep.PREFERENCES,
        field: 'notificationFrequency',
        suggestions: [{
          type: 'tip',
          title: 'Frekuensi Notifikasi',
          content: `Berdasarkan ukuran tim Anda (${teamSize} orang), kami sarankan notifikasi ${frequencySuggestion}.`,
          priority: 'medium'
        }],
        context: input
      });
    }

    // Suggest features based on showroom type
    const basicInfo = this.getPreviousStepData(OnboardingStep.PREFERENCES);
    if (basicInfo?.showroomType && !input.features) {
      const featureSuggestions = {
        'new_car': ['inventoryManagement', 'customerManagement', 'websiteGeneration', 'aiTools'],
        'used_car': ['inventoryManagement', 'customerManagement', 'reporting', 'aiTools'],
        'both': ['inventoryManagement', 'customerManagement', 'reporting', 'websiteGeneration', 'aiTools']
      };

      const suggestedFeatures = featureSuggestions[basicInfo.showroomType as keyof typeof featureSuggestions] || [];

      suggestions.push({
        step: OnboardingStep.PREFERENCES,
        field: 'features',
        suggestions: [{
          type: 'tip',
          title: 'Fitur yang Direkomendasikan',
          content: `Berdasarkan jenis showroom Anda, kami sarankan untuk mengaktifkan fitur: ${suggestedFeatures.join(', ')}`,
          priority: 'high'
        }],
        context: input
      });
    }

    return suggestions;
  }

  /**
   * Get data from previous step (helper method)
   */
  private getPreviousStepData(currentStep: OnboardingStep): any {
    // In a real implementation, this would fetch from the actual state
    // For now, returning empty object as placeholder
    return {};
  }
}

// Export singleton instance
export const onboardingManager = new OnboardingManager();