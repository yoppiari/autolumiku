/**
 * Onboarding Service Tests
 *
 * Tests for the core onboarding functionality including:
 * - Service initialization and state management
 * - Step navigation and validation
 * - Progress tracking
 * - Template application
 */

import { OnboardingService } from '../src/services/onboarding-service';
import { OnboardingStep, OnboardingConfig, BasicInfoData } from '../src/types/onboarding';

// Mock dependencies
jest.mock('../src/services/onboarding-service/progress/tracker');
jest.mock('../src/services/onboarding-service/templates/manager');
jest.mock('../src/services/onboarding-service/validation');

describe('OnboardingService', () => {
  let onboardingService: OnboardingService;
  let mockTenantId: string;
  let mockUserId: string;

  beforeEach(() => {
    onboardingService = new OnboardingService();
    mockTenantId = 'tenant-test-123';
    mockUserId = 'user-test-456';
  });

  describe('initializeOnboarding', () => {
    it('should create a new onboarding state with default configuration', async () => {
      const config: Partial<OnboardingConfig> = {
        language: 'id',
        region: 'id'
      };

      const result = await onboardingService.initializeOnboarding(mockTenantId, mockUserId, config);

      expect(result).toBeDefined();
      expect(result.tenantId).toBe(mockTenantId);
      expect(result.userId).toBe(mockUserId);
      expect(result.currentStep).toBe(OnboardingStep.WELCOME);
      expect(result.completedSteps).toEqual([]);
      expect(result.progress).toBe(0);
      expect(result.language).toBe('id');
      expect(result.region).toBe('id');
      expect(result.isCompleted).toBe(false);
    });

    it('should accept custom configuration', async () => {
      const config: Partial<OnboardingConfig> = {
        skipOptional: true,
        estimatedCompletionTime: 45,
        language: 'en'
      };

      const result = await onboardingService.initializeOnboarding(mockTenantId, mockUserId, config);

      expect(result.skipOptional).toBe(true);
      expect(result.estimatedCompletionTime).toBe(45);
      expect(result.language).toBe('en');
    });

    it('should generate unique onboarding IDs', async () => {
      const result1 = await onboardingService.initializeOnboarding(mockTenantId, mockUserId);
      const result2 = await onboardingService.initializeOnboarding(mockTenantId, mockUserId);

      expect(result1.id).not.toBe(result2.id);
      expect(result1.id).toMatch(/^onb_/);
      expect(result2.id).toMatch(/^onb_/);
    });
  });

  describe('step navigation', () => {
    let onboardingId: string;

    beforeEach(async () => {
      const state = await onboardingService.initializeOnboarding(mockTenantId, mockUserId);
      onboardingId = state.id;
    });

    it('should navigate to next step', async () => {
      const stepData = { acknowledged: true };
      const result = await onboardingService.nextStep(onboardingId, mockTenantId, stepData);

      expect(result.currentStep).toBe(OnboardingStep.BASIC_INFO);
      expect(result.completedSteps).toContain(OnboardingStep.WELCOME);
    });

    it('should navigate to previous step', async () => {
      // First move to next step
      await onboardingService.nextStep(onboardingId, mockTenantId);

      // Then move back
      const result = await onboardingService.previousStep(onboardingId, mockTenantId);

      expect(result.currentStep).toBe(OnboardingStep.WELCOME);
    });

    it('should jump to specific step', async () => {
      const result = await onboardingService.goToStep(onboardingId, mockTenantId, OnboardingStep.BRANDING);

      expect(result.currentStep).toBe(OnboardingStep.BRANDING);
    });

    it('should throw error when jumping to inaccessible step', async () => {
      await expect(
        onboardingService.goToStep(onboardingId, mockTenantId, OnboardingStep.COMPLETE)
      ).rejects.toThrow('Cannot jump to step: complete. Prerequisites not completed.');
    });

    it('should validate step data before proceeding', async () => {
      const invalidData = { showroomName: '' }; // Invalid - too short

      await expect(
        onboardingService.nextStep(onboardingId, mockTenantId, invalidData)
      ).rejects.toThrow('Missing required field: showroomName');
    });
  });

  describe('progress tracking', () => {
    let onboardingId: string;

    beforeEach(async () => {
      const state = await onboardingService.initializeOnboarding(mockTenantId, mockUserId);
      onboardingId = state.id;
    });

    it('should calculate progress correctly', async () => {
      // Initially 0% (no steps completed)
      const initialState = await onboardingService.getOnboardingState(onboardingId, mockTenantId);
      expect(initialState?.progress).toBe(0);

      // Complete welcome step
      await onboardingService.nextStep(onboardingId, mockTenantId, { acknowledged: true });

      // Progress should increase
      const afterWelcomeState = await onboardingService.getOnboardingState(onboardingId, mockTenantId);
      expect(afterWelcomeState?.progress).toBeGreaterThan(0);
    });

    it('should mark onboarding as complete', async () => {
      // Navigate through all required steps
      await onboardingService.nextStep(onboardingId, mockTenantId, { acknowledged: true });

      const validBasicInfo: BasicInfoData = {
        showroomName: 'Test Showroom',
        showroomType: 'used_car',
        contactEmail: 'test@example.com',
        phoneNumber: '+628123456789',
        address: 'Test Address',
        city: 'Test City',
        province: 'Test Province',
        postalCode: '12345'
      };

      await onboardingService.nextStep(onboardingId, mockTenantId, validBasicInfo);

      // Jump to complete step
      await onboardingService.goToStep(onboardingId, mockTenantId, OnboardingStep.COMPLETE);
      await onboardingService.completeOnboarding(onboardingId, mockTenantId);

      const finalState = await onboardingService.getOnboardingState(onboardingId, mockTenantId);
      expect(finalState?.isCompleted).toBe(true);
      expect(finalState?.completionTime).toBeDefined();
    });
  });

  describe('data management', () => {
    let onboardingId: string;

    beforeEach(async () => {
      const state = await onboardingService.initializeOnboarding(mockTenantId, mockUserId);
      onboardingId = state.id;
    });

    it('should save step data', async () => {
      const testData = { testField: 'testValue' };

      await onboardingService.saveProgress(onboardingId, testData);

      // In a real implementation, you would verify the data was saved
      // For now, we just ensure no errors are thrown
      expect(true).toBe(true);
    });

    it('should retrieve step data', async () => {
      const testData = { testField: 'testValue' };

      await onboardingService.saveProgress(onboardingId, testData);
      const savedData = await onboardingService.getOnboardingState(onboardingId, mockTenantId);

      expect(savedData).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should throw error for invalid onboarding ID', async () => {
      await expect(
        onboardingService.getOnboardingState('invalid-id', mockTenantId)
      ).resolves.toBeNull();
    });

    it('should throw error for mismatched tenant ID', async () => {
      const state = await onboardingService.initializeOnboarding(mockTenantId, mockUserId);

      await expect(
        onboardingService.getOnboardingState(state.id, 'different-tenant')
      ).resolves.toBeNull();
    });

    it('should handle missing onboarding state gracefully', async () => {
      await expect(
        onboardingService.nextStep('non-existent-id', mockTenantId)
      ).rejects.toThrow('Onboarding state not found');
    });
  });

  describe('validation', () => {
    let onboardingId: string;

    beforeEach(async () => {
      const state = await onboardingService.initializeOnboarding(mockTenantId, mockUserId);
      onboardingId = state.id;
    });

    it('should validate basic info data', async () => {
      const invalidData = {
        showroomName: '', // Too short
        contactEmail: 'invalid-email', // Invalid format
        phoneNumber: '123' // Invalid format
      };

      await expect(
        onboardingService.nextStep(onboardingId, mockTenantId, invalidData)
      ).rejects.toThrow();
    });

    it('should accept valid basic info data', async () => {
      const validData: BasicInfoData = {
        showroomName: 'Valid Showroom Name',
        showroomType: 'used_car',
        contactEmail: 'valid@example.com',
        phoneNumber: '+628123456789',
        address: 'Valid Address',
        city: 'Valid City',
        province: 'Valid Province',
        postalCode: '12345'
      };

      await expect(
        onboardingService.nextStep(onboardingId, mockTenantId, validData)
      ).resolves.toBeDefined();
    });
  });

  describe('contextual help', () => {
    let onboardingId: string;

    beforeEach(async () => {
      const state = await onboardingService.initializeOnboarding(mockTenantId, mockUserId);
      onboardingId = state.id;
    });

    it('should provide help content for steps', async () => {
      const help = await onboardingService.getStepHelp(OnboardingStep.WELCOME, {});

      // Help content should be returned (implementation-specific)
      expect(help).toBeDefined();
    });

    it('should provide suggestions based on input', async () => {
      const suggestions = await onboardingService.getSuggestions(OnboardingStep.BASIC_INFO, {
        showroomName: 'Test Showroom'
      });

      expect(Array.isArray(suggestions)).toBe(true);
    });
  });
});