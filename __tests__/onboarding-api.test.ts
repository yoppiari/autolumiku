/**
 * Onboarding API Tests
 *
 * Tests for the onboarding API endpoints
 */

import { createMocks } from 'node-mocks-http';
import { NextRequest } from 'next/server';

// Mock the onboarding service
jest.mock('../../src/services/onboarding-service', () => ({
  onboardingService: {
    initializeOnboarding: jest.fn(),
    getOnboardingState: jest.fn(),
    nextStep: jest.fn(),
    previousStep: jest.fn(),
    goToStep: jest.fn(),
    saveProgress: jest.fn(),
    getStepHelp: jest.fn(),
    getSuggestions: jest.fn()
  }
}));

import { POST, GET } from '../../src/app/api/onboarding/route';
import { POST as NavigatePOST } from '../../src/app/api/onboarding/navigate/route';
import { POST as ProgressPOST, GET as ProgressGET } from '../../src/app/api/onboarding/progress/route';
import { POST as HelpPOST } from '../../src/app/api/onboarding/help/route';
import { POST as SuggestionsPOST } from '../../src/app/api/onboarding/suggestions/route';

describe('Onboarding API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('/api/onboarding', () => {
    describe('POST', () => {
      it('should initialize onboarding successfully', async () => {
        const { onboardingService } = require('../../src/services/onboarding-service');

        const mockState = {
          id: 'onb_123',
          tenantId: 'tenant-123',
          userId: 'user-123',
          currentStep: 'welcome',
          completedSteps: [],
          progress: 0,
          isCompleted: false
        };

        onboardingService.initializeOnboarding.mockResolvedValue(mockState);

        const { req } = createMocks({
          method: 'POST',
          body: {
            tenantId: 'tenant-123',
            userId: 'user-123',
            config: { language: 'id' }
          }
        });

        const request = new NextRequest(req.url, {
          method: req.method,
          body: JSON.stringify(req.body),
          headers: {
            'Content-Type': 'application/json'
          }
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toEqual(mockState);
        expect(onboardingService.initializeOnboarding).toHaveBeenCalledWith('tenant-123', 'user-123', { language: 'id' });
      });

      it('should return error for missing required fields', async () => {
        const { req } = createMocks({
          method: 'POST',
          body: {
            tenantId: 'tenant-123'
            // Missing userId
          }
        });

        const request = new NextRequest(req.url, {
          method: req.method,
          body: JSON.stringify(req.body),
          headers: {
            'Content-Type': 'application/json'
          }
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('Missing required fields');
      });

      it('should handle service errors gracefully', async () => {
        const { onboardingService } = require('../../src/services/onboarding-service');

        onboardingService.initializeOnboarding.mockRejectedValue(new Error('Service error'));

        const { req } = createMocks({
          method: 'POST',
          body: {
            tenantId: 'tenant-123',
            userId: 'user-123'
          }
        });

        const request = new NextRequest(req.url, {
          method: req.method,
          body: JSON.stringify(req.body),
          headers: {
            'Content-Type': 'application/json'
          }
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Internal server error');
      });
    });

    describe('GET', () => {
      it('should retrieve onboarding state successfully', async () => {
        const { onboardingService } = require('../../src/services/onboarding-service');

        const mockState = {
          id: 'onb_123',
          tenantId: 'tenant-123',
          userId: 'user-123',
          currentStep: 'basic-info',
          completedSteps: ['welcome'],
          progress: 25,
          isCompleted: false
        };

        onboardingService.getOnboardingState.mockResolvedValue(mockState);

        const { req } = createMocks({
          method: 'GET',
          query: {
            id: 'onb_123',
            tenantId: 'tenant-123'
          }
        });

        const request = new NextRequest(`${req.url}?id=onb_123&tenantId=tenant-123`);
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toEqual(mockState);
        expect(onboardingService.getOnboardingState).toHaveBeenCalledWith('onb_123', 'tenant-123');
      });

      it('should return 404 for non-existent onboarding', async () => {
        const { onboardingService } = require('../../src/services/onboarding-service');

        onboardingService.getOnboardingState.mockResolvedValue(null);

        const { req } = createMocks({
          method: 'GET',
          query: {
            id: 'non-existent',
            tenantId: 'tenant-123'
          }
        });

        const request = new NextRequest(`${req.url}?id=non-existent&tenantId=tenant-123`);
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.error).toBe('Onboarding not found');
      });
    });
  });

  describe('/api/onboarding/navigate', () => {
    describe('POST', () => {
      it('should navigate to next step successfully', async () => {
        const { onboardingService } = require('../../src/services/onboarding-service');

        const mockState = {
          id: 'onb_123',
          tenantId: 'tenant-123',
          userId: 'user-123',
          currentStep: 'basic-info',
          completedSteps: ['welcome'],
          progress: 25,
          isCompleted: false
        };

        onboardingService.getOnboardingState.mockResolvedValue(mockState);
        onboardingService.nextStep.mockResolvedValue(mockState);

        const { req } = createMocks({
          method: 'POST',
          body: {
            onboardingId: 'onb_123',
            direction: 'next',
            stepData: { showroomName: 'Test Showroom' }
          }
        });

        const request = new NextRequest(req.url, {
          method: req.method,
          body: JSON.stringify(req.body),
          headers: {
            'Content-Type': 'application/json'
          }
        });

        const response = await NavigatePOST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toEqual(mockState);
      });

      it('should navigate to specific step', async () => {
        const { onboardingService } = require('../../src/services/onboarding-service');

        const mockState = {
          id: 'onb_123',
          tenantId: 'tenant-123',
          userId: 'user-123',
          currentStep: 'branding',
          completedSteps: ['welcome', 'basic-info'],
          progress: 50,
          isCompleted: false
        };

        onboardingService.getOnboardingState.mockResolvedValue(mockState);
        onboardingService.goToStep.mockResolvedValue(mockState);

        const { req } = createMocks({
          method: 'POST',
          body: {
            onboardingId: 'onb_123',
            targetStep: 'branding'
          }
        });

        const request = new NextRequest(req.url, {
          method: req.method,
          body: JSON.stringify(req.body),
          headers: {
            'Content-Type': 'application/json'
          }
        });

        const response = await NavigatePOST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(onboardingService.goToStep).toHaveBeenCalledWith('onb_123', 'tenant-123', 'branding');
      });

      it('should return error for missing navigation parameters', async () => {
        const { req } = createMocks({
          method: 'POST',
          body: {
            onboardingId: 'onb_123'
            // Missing direction or targetStep
          }
        });

        const request = new NextRequest(req.url, {
          method: req.method,
          body: JSON.stringify(req.body),
          headers: {
            'Content-Type': 'application/json'
          }
        });

        const response = await NavigatePOST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('Missing navigation direction');
      });
    });
  });

  describe('/api/onboarding/progress', () => {
    describe('GET', () => {
      it('should retrieve progress state successfully', async () => {
        const { progressTracker } = require('../../src/services/onboarding-service/progress/tracker');

        const mockProgress = {
          onboardingId: 'onb_123',
          tenantId: 'tenant-123',
          userId: 'user-123',
          currentStep: 'basic-info',
          completedSteps: ['welcome'],
          overallProgress: 25,
          totalEstimatedTime: 30,
          totalActualTime: 5,
          lastActivity: new Date()
        };

        progressTracker.getProgress.mockResolvedValue(mockProgress);

        const { req } = createMocks({
          method: 'GET',
          query: {
            id: 'onb_123'
          }
        });

        const request = new NextRequest(`${req.url}?id=onb_123`);
        const response = await ProgressGET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toEqual(mockProgress);
      });

      it('should return 404 for progress not found', async () => {
        const { progressTracker } = require('../../src/services/onboarding-service/progress/tracker');

        progressTracker.getProgress.mockResolvedValue(null);

        const { req } = createMocks({
          method: 'GET',
          query: {
            id: 'non-existent'
          }
        });

        const request = new NextRequest(`${req.url}?id=non-existent`);
        const response = await ProgressGET(request);
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.error).toBe('Progress not found');
      });
    });

    describe('POST', () => {
      it('should save progress successfully', async () => {
        const { progressTracker } = require('../../src/services/onboarding-service/progress/tracker');

        progressTracker.updateStepProgress.mockResolvedValue();

        const { req } = createMocks({
          method: 'POST',
          body: {
            onboardingId: 'onb_123',
            step: 'basic-info',
            data: { showroomName: 'Test Showroom' }
          }
        });

        const request = new NextRequest(req.url, {
          method: req.method,
          body: JSON.stringify(req.body),
          headers: {
            'Content-Type': 'application/json'
          }
        });

        const response = await ProgressPOST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.message).toBe('Progress saved successfully');
        expect(progressTracker.updateStepProgress).toHaveBeenCalledWith(
          'onb_123',
          'basic-info',
          { showroomName: 'Test Showroom' }
        );
      });
    });
  });

  describe('/api/onboarding/help', () => {
    describe('POST', () => {
      it('should return help content successfully', async () => {
        const { onboardingService } = require('../../src/services/onboarding-service');

        const mockHelpContent = {
          title: { id: 'Bantuan Info Dasar', en: 'Basic Info Help' },
          sections: [
            {
              title: { id: 'Judul', en: 'Title' },
              content: { id: 'Konten', en: 'Content' },
              type: 'text'
            }
          ],
          tips: ['Tip 1', 'Tip 2'],
          relatedDocs: ['doc1', 'doc2']
        };

        onboardingService.getStepHelp.mockResolvedValue(mockHelpContent);

        const { req } = createMocks({
          method: 'POST',
          body: {
            step: 'basic-info',
            context: { showroomType: 'used_car' },
            language: 'id'
          }
        });

        const request = new NextRequest(req.url, {
          method: req.method,
          body: JSON.stringify(req.body),
          headers: {
            'Content-Type': 'application/json'
          }
        });

        const response = await HelpPOST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.title).toBe('Bantuan Info Dasar');
        expect(data.data.sections).toHaveLength(1);
        expect(onboardingService.getStepHelp).toHaveBeenCalledWith('basic-info', { showroomType: 'used_car' });
      });

      it('should return 404 for help content not found', async () => {
        const { onboardingService } = require('../../src/services/onboarding-service');

        onboardingService.getStepHelp.mockResolvedValue(null);

        const { req } = createMocks({
          method: 'POST',
          body: {
            step: 'non-existent-step'
          }
        });

        const request = new NextRequest(req.url, {
          method: req.method,
          body: JSON.stringify(req.body),
          headers: {
            'Content-Type': 'application/json'
          }
        });

        const response = await HelpPOST(request);
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.error).toBe('Help content not found for step');
      });
    });
  });

  describe('/api/onboarding/suggestions', () => {
    describe('POST', () => {
      it('should return suggestions successfully', async () => {
        const { onboardingService } = require('../../src/services/onboarding-service');

        const mockSuggestions = [
          {
            step: 'basic-info',
            field: 'website',
            suggestions: [{
              type: 'tip',
              title: 'Website Suggestion',
              content: 'Consider using: testshowroom.com',
              priority: 'low'
            }]
          }
        ];

        onboardingService.getSuggestions.mockResolvedValue(mockSuggestions);

        const { req } = createMocks({
          method: 'POST',
          body: {
            step: 'basic-info',
            input: { showroomName: 'Test Showroom' },
            context: {}
          }
        });

        const request = new NextRequest(req.url, {
          method: req.method,
          body: JSON.stringify(req.body),
          headers: {
            'Content-Type': 'application/json'
          }
        });

        const response = await SuggestionsPOST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toEqual(mockSuggestions);
        expect(onboardingService.getSuggestions).toHaveBeenCalledWith(
          'basic-info',
          { showroomName: 'Test Showroom' }
        );
      });
    });
  });
});