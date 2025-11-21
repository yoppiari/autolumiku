import { OnboardingManager } from './wizard/manager';
import { ProgressTracker } from './progress/tracker';
import { TemplateManager } from './templates/manager';
import { OnboardingState, OnboardingStep, OnboardingConfig } from '../../types/onboarding';

/**
 * Main Onboarding Service
 *
 * Orchestrates the complete tenant onboarding process including:
 * - Step-by-step wizard management
 * - Progress tracking and persistence
 * - Template-based configuration
 * - Contextual help and suggestions
 */
export class OnboardingService {
  private onboardingManager: OnboardingManager;
  private progressTracker: ProgressTracker;
  private templateManager: TemplateManager;

  constructor() {
    this.onboardingManager = new OnboardingManager();
    this.progressTracker = new ProgressTracker();
    this.templateManager = new TemplateManager();
  }

  /**
   * Initialize onboarding for a new tenant
   */
  async initializeOnboarding(tenantId: string, userId: string, config?: Partial<OnboardingConfig>): Promise<OnboardingState> {
    console.log(`Initializing onboarding for tenant: ${tenantId}, user: ${userId}`);

    // Create default configuration with tenant-specific customizations
    const defaultConfig: OnboardingConfig = {
      tenantId,
      userId,
      currentStep: OnboardingStep.WELCOME,
      completedSteps: [],
      progress: 0,
      startTime: new Date(),
      estimatedCompletionTime: 30, // minutes
      skipOptional: false,
      language: 'id', // Default to Bahasa Indonesia
      region: 'id', // Default to Indonesia
      ...config
    };

    // Initialize onboarding state
    const onboardingState = await this.onboardingManager.createState(defaultConfig);

    // Start progress tracking
    await this.progressTracker.startTracking(onboardingState.id, tenantId, userId);

    // Apply tenant template if available
    await this.templateManager.applyTemplate(tenantId, onboardingState);

    return onboardingState;
  }

  /**
   * Get current onboarding state
   */
  async getOnboardingState(onboardingId: string, tenantId: string): Promise<OnboardingState | null> {
    return await this.onboardingManager.getState(onboardingId, tenantId);
  }

  /**
   * Get current step details
   */
  async getCurrentStep(onboardingId: string, tenantId: string): Promise<OnboardingStep | null> {
    const state = await this.getOnboardingState(onboardingId, tenantId);
    return state?.currentStep || null;
  }

  /**
   * Navigate to next step
   */
  async nextStep(onboardingId: string, tenantId: string, stepData?: any): Promise<OnboardingState> {
    const state = await this.onboardingManager.getState(onboardingId, tenantId);
    if (!state) {
      throw new Error('Onboarding state not found');
    }

    // Validate current step before proceeding
    await this.validateCurrentStep(state, stepData);

    // Save step data
    if (stepData) {
      await this.onboardingManager.saveStepData(onboardingId, state.currentStep, stepData);
    }

    // Mark current step as completed
    await this.progressTracker.completeStep(onboardingId, state.currentStep);

    // Move to next step
    const nextStep = this.getNextStep(state.currentStep);
    const updatedState = await this.onboardingManager.updateStep(onboardingId, nextStep);

    // Update progress percentage
    const progress = this.calculateProgress(updatedState);
    await this.progressTracker.updateProgress(onboardingId, progress);

    return updatedState;
  }

  /**
   * Navigate to previous step
   */
  async previousStep(onboardingId: string, tenantId: string): Promise<OnboardingState> {
    const state = await this.onboardingManager.getState(onboardingId, tenantId);
    if (!state) {
      throw new Error('Onboarding state not found');
    }

    const previousStep = this.getPreviousStep(state.currentStep);
    return await this.onboardingManager.updateStep(onboardingId, previousStep);
  }

  /**
   * Jump to specific step
   */
  async goToStep(onboardingId: string, tenantId: string, targetStep: OnboardingStep): Promise<OnboardingState> {
    const state = await this.onboardingManager.getState(onboardingId, tenantId);
    if (!state) {
      throw new Error('Onboarding state not found');
    }

    // Validate that target step is accessible
    if (!this.isStepAccessible(targetStep, state.completedSteps)) {
      throw new Error(`Cannot jump to step: ${targetStep}. Prerequisites not completed.`);
    }

    return await this.onboardingManager.updateStep(onboardingId, targetStep);
  }

  /**
   * Complete onboarding process
   */
  async completeOnboarding(onboardingId: string, tenantId: string): Promise<void> {
    const state = await this.onboardingManager.getState(onboardingId, tenantId);
    if (!state) {
      throw new Error('Onboarding state not found');
    }

    // Mark all steps as completed
    await this.progressTracker.completeOnboarding(onboardingId);

    // Apply final configurations
    await this.templateManager.finalizeConfiguration(tenantId, state);

    // Update tenant status to active
    await this.updateTenantStatus(tenantId, 'active');

    // Generate completion report
    await this.generateCompletionReport(tenantId, state);

    console.log(`Onboarding completed for tenant: ${tenantId}`);
  }

  /**
   * Save onboarding progress
   */
  async saveProgress(onboardingId: string, stepData: any): Promise<void> {
    const state = await this.onboardingManager.getState(onboardingId, '');
    if (!state) {
      throw new Error('Onboarding state not found');
    }

    await this.onboardingManager.saveStepData(onboardingId, state.currentStep, stepData);
  }

  /**
   * Get step-specific help content
   */
  async getStepHelp(step: OnboardingStep, context: any): Promise<any> {
    return await this.onboardingManager.getHelpContent(step, context);
  }

  /**
   * Get suggestions based on current input
   */
  async getSuggestions(step: OnboardingStep, input: any): Promise<any[]> {
    return await this.onboardingManager.getSuggestions(step, input);
  }

  /**
   * Validate current step data
   */
  private async validateCurrentStep(state: OnboardingState, stepData: any): Promise<void> {
    // Step-specific validation logic
    switch (state.currentStep) {
      case OnboardingStep.BASIC_INFO:
        await this.validateBasicInfo(stepData);
        break;
      case OnboardingStep.BRANDING:
        await this.validateBranding(stepData);
        break;
      case OnboardingStep.TEAM:
        await this.validateTeam(stepData);
        break;
      case OnboardingStep.PREFERENCES:
        await this.validatePreferences(stepData);
        break;
      default:
        // No validation required for other steps
        break;
    }
  }

  private async validateBasicInfo(data: any): Promise<void> {
    const required = ['showroomName', 'contactEmail', 'phoneNumber', 'address'];
    for (const field of required) {
      if (!data[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
  }

  private async validateBranding(data: any): Promise<void> {
    // Logo validation (optional)
    if (data.logo && !this.isValidImage(data.logo)) {
      throw new Error('Invalid logo format');
    }

    // Color validation (optional)
    if (data.primaryColor && !this.isValidColor(data.primaryColor)) {
      throw new Error('Invalid primary color format');
    }
  }

  private async validateTeam(data: any): Promise<void> {
    // Validate team member invitations
    if (data.invitations && Array.isArray(data.invitations)) {
      for (const invitation of data.invitations) {
        if (!this.isValidEmail(invitation.email)) {
          throw new Error(`Invalid email: ${invitation.email}`);
        }
      }
    }
  }

  private async validatePreferences(data: any): Promise<void> {
    // Validate communication preferences
    if (data.notificationFrequency && !['daily', 'weekly', 'monthly'].includes(data.notificationFrequency)) {
      throw new Error('Invalid notification frequency');
    }
  }

  private getNextStep(currentStep: OnboardingStep): OnboardingStep {
    const steps = Object.values(OnboardingStep);
    const currentIndex = steps.indexOf(currentStep);
    return steps[Math.min(currentIndex + 1, steps.length - 1)];
  }

  private getPreviousStep(currentStep: OnboardingStep): OnboardingStep {
    const steps = Object.values(OnboardingStep);
    const currentIndex = steps.indexOf(currentStep);
    return steps[Math.max(currentIndex - 1, 0)];
  }

  private isStepAccessible(targetStep: OnboardingStep, completedSteps: OnboardingStep[]): boolean {
    const steps = Object.values(OnboardingStep);
    const targetIndex = steps.indexOf(targetStep);

    // Can access current step and any completed steps
    return completedSteps.includes(targetStep) || targetIndex === 0;
  }

  private calculateProgress(state: OnboardingState): number {
    const totalSteps = Object.values(OnboardingStep).length;
    const completedSteps = state.completedSteps.length;
    return Math.round((completedSteps / totalSteps) * 100);
  }

  private isValidImage(imageData: any): boolean {
    // Basic image validation
    return imageData && (imageData.type?.startsWith('image/') || imageData.url?.match(/\.(jpg|jpeg|png|gif)$/i));
  }

  private isValidColor(color: string): boolean {
    // Hex color validation
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private async updateTenantStatus(tenantId: string, status: string): Promise<void> {
    // Implementation would update tenant status in database
    console.log(`Updating tenant ${tenantId} status to ${status}`);
  }

  private async generateCompletionReport(tenantId: string, state: OnboardingState): Promise<void> {
    // Implementation would generate completion report
    console.log(`Generating completion report for tenant: ${tenantId}`);
  }
}

// Export singleton instance
export const onboardingService = new OnboardingService();