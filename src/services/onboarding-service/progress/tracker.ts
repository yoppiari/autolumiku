import { OnboardingStep, ProgressState, StepProgress } from '../../../types/onboarding';

/**
 * Progress Tracking Service
 *
 * Tracks and manages onboarding progress including:
 * - Step completion status
 * - Time spent on each step
 * - Overall progress calculation
 * - Progress persistence
 */
export class ProgressTracker {
  private progressStates: Map<string, ProgressState> = new Map();

  /**
   * Start tracking onboarding progress
   */
  async startTracking(onboardingId: string, tenantId: string, userId: string): Promise<void> {
    const progressState: ProgressState = {
      onboardingId,
      tenantId,
      userId,
      currentStep: OnboardingStep.WELCOME,
      completedSteps: [],
      stepProgress: this.initializeStepProgress(),
      overallProgress: 0,
      timeSpent: {} as Record<OnboardingStep, number>,
      totalEstimatedTime: this.getTotalEstimatedTime(),
      totalActualTime: 0,
      lastActivity: new Date()
    };

    this.progressStates.set(onboardingId, progressState);
  }

  /**
   * Start tracking a specific step
   */
  async startStep(onboardingId: string, step: OnboardingStep): Promise<void> {
    const progress = this.progressStates.get(onboardingId);
    if (!progress) {
      throw new Error('Progress state not found');
    }

    const stepProgress: StepProgress = {
      step,
      status: 'in_progress',
      startTime: new Date(),
      timeSpent: 0
    };

    progress.stepProgress[step] = stepProgress;
    progress.currentStep = step;
    progress.lastActivity = new Date();
  }

  /**
   * Complete a step
   */
  async completeStep(onboardingId: string, step: OnboardingStep): Promise<void> {
    const progress = this.progressStates.get(onboardingId);
    if (!progress) {
      throw new Error('Progress state not found');
    }

    const stepProgress = progress.stepProgress[step];
    if (!stepProgress) {
      throw new Error('Step progress not found');
    }

    // Calculate time spent on this step
    const endTime = new Date();
    const timeSpent = stepProgress.startTime ?
      endTime.getTime() - stepProgress.startTime.getTime() : 0;

    // Update step progress
    stepProgress.status = 'completed';
    stepProgress.endTime = endTime;
    stepProgress.timeSpent = timeSpent;

    // Add to completed steps
    if (!progress.completedSteps.includes(step)) {
      progress.completedSteps.push(step);
    }

    // Update time tracking
    progress.timeSpent[step] = timeSpent;
    progress.totalActualTime += timeSpent;

    // Recalculate overall progress
    progress.overallProgress = this.calculateOverallProgress(progress);
    progress.lastActivity = new Date();

    this.progressStates.set(onboardingId, progress);
  }

  /**
   * Skip a step
   */
  async skipStep(onboardingId: string, step: OnboardingStep): Promise<void> {
    const progress = this.progressStates.get(onboardingId);
    if (!progress) {
      throw new Error('Progress state not found');
    }

    const stepProgress = progress.stepProgress[step];
    if (!stepProgress) {
      throw new Error('Step progress not found');
    }

    stepProgress.status = 'skipped';
    stepProgress.endTime = new Date();

    // Recalculate overall progress (skipped steps don't count toward completion)
    progress.overallProgress = this.calculateOverallProgress(progress);
    progress.lastActivity = new Date();

    this.progressStates.set(onboardingId, progress);
  }

  /**
   * Update step progress
   */
  async updateStepProgress(onboardingId: string, step: OnboardingStep, data: any, errors?: string[]): Promise<void> {
    const progress = this.progressStates.get(onboardingId);
    if (!progress) {
      throw new Error('Progress state not found');
    }

    const stepProgress = progress.stepProgress[step];
    if (!stepProgress) {
      throw new Error('Step progress not found');
    }

    stepProgress.savedData = data;
    if (errors && errors.length > 0) {
      stepProgress.validationErrors = errors;
    } else {
      stepProgress.validationErrors = [];
    }

    progress.lastActivity = new Date();
    this.progressStates.set(onboardingId, progress);
  }

  /**
   * Update overall progress
   */
  async updateProgress(onboardingId: string, progressPercentage: number): Promise<void> {
    const progress = this.progressStates.get(onboardingId);
    if (!progress) {
      throw new Error('Progress state not found');
    }

    progress.overallProgress = Math.min(100, Math.max(0, progressPercentage));
    progress.lastActivity = new Date();
    this.progressStates.set(onboardingId, progress);
  }

  /**
   * Complete onboarding
   */
  async completeOnboarding(onboardingId: string): Promise<void> {
    const progress = this.progressStates.get(onboardingId);
    if (!progress) {
      throw new Error('Progress state not found');
    }

    // Mark any in-progress steps as completed
    Object.values(progress.stepProgress).forEach(stepProgress => {
      if (stepProgress.status === 'in_progress') {
        stepProgress.status = 'completed';
        stepProgress.endTime = new Date();
      }
    });

    progress.overallProgress = 100;
    progress.lastActivity = new Date();

    this.progressStates.set(onboardingId, progress);
  }

  /**
   * Get progress state
   */
  async getProgress(onboardingId: string): Promise<ProgressState | null> {
    return this.progressStates.get(onboardingId) || null;
  }

  /**
   * Get step progress
   */
  async getStepProgress(onboardingId: string, step: OnboardingStep): Promise<StepProgress | null> {
    const progress = this.progressStates.get(onboardingId);
    if (!progress) {
      return null;
    }

    return progress.stepProgress[step] || null;
  }

  /**
   * Get analytics data
   */
  async getAnalytics(onboardingId: string): Promise<any> {
    const progress = this.progressStates.get(onboardingId);
    if (!progress) {
      throw new Error('Progress state not found');
    }

    const requiredSteps = this.getRequiredSteps();
    const completedRequiredSteps = progress.completedSteps.filter(step => requiredSteps.includes(step));

    return {
      tenantId: progress.tenantId,
      onboardingId: progress.onboardingId,
      metrics: {
        totalSteps: Object.values(OnboardingStep).length,
        completedSteps: progress.completedSteps.length,
        timeSpent: progress.totalActualTime,
        averageStepTime: progress.completedSteps.length > 0 ?
          progress.totalActualTime / progress.completedSteps.length : 0,
        requiredStepsCompleted: completedRequiredSteps.length,
        requiredStepsTotal: requiredSteps.length
      },
      stepMetrics: Object.values(OnboardingStep).reduce((acc, step) => {
        const stepProgress = progress.stepProgress[step];
        acc[step] = {
          timeSpent: stepProgress?.timeSpent || 0,
          status: stepProgress?.status || 'not_started',
          validationErrors: stepProgress?.validationErrors?.length || 0
        };
        return acc;
      }, {} as Record<OnboardingStep, any>)
    };
  }

  /**
   * Check if step is accessible
   */
  isStepAccessible(onboardingId: string, targetStep: OnboardingStep): boolean {
    const progress = this.progressStates.get(onboardingId);
    if (!progress) {
      return false;
    }

    // Welcome step is always accessible
    if (targetStep === OnboardingStep.WELCOME) {
      return true;
    }

    // Check if previous required steps are completed
    const steps = Object.values(OnboardingStep);
    const targetIndex = steps.indexOf(targetStep);

    for (let i = 0; i < targetIndex; i++) {
      const step = steps[i];
      const stepProgress = progress.stepProgress[step];

      if (this.isRequiredStep(step) && (!stepProgress || stepProgress.status !== 'completed')) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get next accessible step
   */
  getNextAccessibleStep(onboardingId: string): OnboardingStep | null {
    const progress = this.progressStates.get(onboardingId);
    if (!progress) {
      return OnboardingStep.WELCOME;
    }

    const steps = Object.values(OnboardingStep);
    const currentIndex = steps.indexOf(progress.currentStep);

    // Find next uncompleted step
    for (let i = currentIndex + 1; i < steps.length; i++) {
      const step = steps[i];
      const stepProgress = progress.stepProgress[step];

      if (!stepProgress || stepProgress.status !== 'completed') {
        if (this.isStepAccessible(onboardingId, step)) {
          return step;
        }
      }
    }

    return null; // All steps completed
  }

  /**
   * Resume onboarding from saved progress
   */
  async resumeOnboarding(onboardingId: string): Promise<OnboardingStep> {
    const progress = this.progressStates.get(onboardingId);
    if (!progress) {
      throw new Error('Progress state not found');
    }

    // Find the last incomplete step
    const steps = Object.values(OnboardingStep);
    for (let i = steps.length - 1; i >= 0; i--) {
      const step = steps[i];
      const stepProgress = progress.stepProgress[step];

      if (!stepProgress || stepProgress.status === 'in_progress' || stepProgress.status === 'not_started') {
        return step;
      }
    }

    return OnboardingStep.COMPLETE; // All steps completed
  }

  /**
   * Initialize step progress for all steps
   */
  private initializeStepProgress(): Record<OnboardingStep, StepProgress> {
    const progress = {} as Record<OnboardingStep, StepProgress>;

    Object.values(OnboardingStep).forEach(step => {
      progress[step] = {
        step,
        status: 'not_started',
        timeSpent: 0
      };
    });

    return progress;
  }

  /**
   * Calculate overall progress
   */
  private calculateOverallProgress(progress: ProgressState): number {
    const requiredSteps = this.getRequiredSteps();
    const totalSteps = Object.values(OnboardingStep).length;

    if (totalSteps === 0) return 0;

    // Weight required steps more heavily
    const requiredWeight = 0.7;
    const optionalWeight = 0.3;

    const requiredProgress = requiredSteps.length > 0 ?
      (progress.completedSteps.filter(step => requiredSteps.includes(step)).length / requiredSteps.length) * 100 : 0;

    const optionalSteps = this.getOptionalSteps();
    const optionalProgress = optionalSteps.length > 0 ?
      (progress.completedSteps.filter(step => optionalSteps.includes(step)).length / optionalSteps.length) * 100 : 0;

    return Math.round((requiredProgress * requiredWeight) + (optionalProgress * optionalWeight));
  }

  /**
   * Get total estimated time
   */
  private getTotalEstimatedTime(): number {
    // Estimated times in minutes (can be made configurable)
    const stepTimes = {
      [OnboardingStep.WELCOME]: 2,
      [OnboardingStep.BASIC_INFO]: 8,
      [OnboardingStep.BRANDING]: 10,
      [OnboardingStep.TEAM]: 7,
      [OnboardingStep.PREFERENCES]: 5,
      [OnboardingStep.COMPLETE]: 3
    };

    return Object.values(stepTimes).reduce((total, time) => total + time, 0);
  }

  /**
   * Check if step is required
   */
  private isRequiredStep(step: OnboardingStep): boolean {
    const requiredSteps = [OnboardingStep.WELCOME, OnboardingStep.BASIC_INFO, OnboardingStep.COMPLETE];
    return requiredSteps.includes(step);
  }

  /**
   * Get required steps
   */
  private getRequiredSteps(): OnboardingStep[] {
    return [OnboardingStep.WELCOME, OnboardingStep.BASIC_INFO, OnboardingStep.COMPLETE];
  }

  /**
   * Get optional steps
   */
  private getOptionalSteps(): OnboardingStep[] {
    return [OnboardingStep.BRANDING, OnboardingStep.TEAM, OnboardingStep.PREFERENCES];
  }

  /**
   * Clean up old progress data
   */
  async cleanupOldProgress(maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<void> { // 30 days
    const cutoffTime = new Date(Date.now() - maxAge);

    for (const [onboardingId, progress] of this.progressStates) {
      if (progress.lastActivity < cutoffTime) {
        this.progressStates.delete(onboardingId);
      }
    }
  }
}

// Export singleton instance
export const progressTracker = new ProgressTracker();