'use client';

import React, { useState, useEffect } from 'react';
import { OnboardingState, OnboardingStep, OnboardingConfig } from '@/types/onboarding';
import { WelcomeStep } from '../steps/welcome-step';
import { BasicInfoStep } from '../steps/basic-info-step';
import { BrandingStep } from '../steps/branding-step';
import { TeamStep } from '../steps/team-step';
import { PreferencesStep } from '../steps/preferences-step';
import { CompletionStep } from '../steps/completion-step';
import { ProgressBar } from './progress-bar';
import { StepNavigation } from './step-navigation';
import { HelpTooltip } from '../shared/help-tooltip';
import { SuggestionBox } from '../shared/suggestion-box';

interface OnboardingWizardProps {
  tenantId: string;
  userId: string;
  initialConfig?: Partial<OnboardingConfig>;
  onComplete?: (state: OnboardingState) => void;
  onExit?: () => void;
  language?: 'id' | 'en';
}

/**
 * Main Onboarding Wizard Component
 *
 * Orchestrates the complete onboarding experience with:
 * - Step navigation and progress tracking
 * - Contextual help and suggestions
 * - Responsive design for mobile and desktop
 * - Auto-save and resume functionality
 */
export function OnboardingWizard({
  tenantId,
  userId,
  initialConfig,
  onComplete,
  onExit,
  language = 'id'
}: OnboardingWizardProps) {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showHelp, setShowHelp] = useState(false);

  // Initialize onboarding
  useEffect(() => {
    initializeOnboarding();
  }, [tenantId, userId]);

  // Auto-save progress
  useEffect(() => {
    if (state && !loading) {
      const timer = setTimeout(() => {
        saveProgress();
      }, 2000); // Auto-save after 2 seconds of inactivity

      return () => clearTimeout(timer);
    }
  }, [state?.stepData, state?.currentStep]);

  const initializeOnboarding = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          userId,
          config: { language, ...initialConfig }
        })
      });

      const result = await response.json();

      if (result.success) {
        setState(result.data);
      } else {
        setError(result.error || 'Failed to initialize onboarding');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Error initializing onboarding:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveProgress = async () => {
    if (!state || saving) return;

    try {
      setSaving(true);

      const response = await fetch('/api/onboarding/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          onboardingId: state.id,
          step: state.currentStep,
          data: state.stepData[state.currentStep]
        })
      });

      const result = await response.json();

      if (!result.success) {
        console.error('Failed to save progress:', result.error);
      }
    } catch (err) {
      console.error('Error saving progress:', err);
    } finally {
      setSaving(false);
    }
  };

  const navigateToStep = async (direction: 'next' | 'previous', stepData?: any, targetStep?: OnboardingStep) => {
    if (!state) return;

    try {
      setSaving(true);

      // Update local state with new data
      if (stepData) {
        setState(prev => prev ? {
          ...prev,
          stepData: {
            ...prev.stepData,
            [prev.currentStep]: {
              ...prev.stepData[prev.currentStep],
              ...stepData
            }
          }
        } : null);
      }

      const response = await fetch('/api/onboarding/navigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          onboardingId: state.id,
          stepData,
          direction,
          targetStep
        })
      });

      const result = await response.json();

      if (result.success) {
        setState(result.data);
        setSuggestions([]); // Clear suggestions when navigating

        // Check if onboarding is complete
        if (result.data.isCompleted && onComplete) {
          onComplete(result.data);
        }
      } else {
        setError(result.error || 'Failed to navigate');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Error navigating:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleStepDataChange = async (stepData: any) => {
    if (!state) return;

    // Update local state immediately for responsive UI
    setState(prev => prev ? {
      ...prev,
      stepData: {
        ...prev.stepData,
        [prev.currentStep]: {
          ...prev.stepData[prev.currentStep],
          ...stepData
        }
      }
    } : null);

    // Get suggestions for the input
    try {
      const response = await fetch('/api/onboarding/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: state.currentStep,
          input: stepData,
          context: state.stepData
        })
      });

      const result = await response.json();

      if (result.success) {
        setSuggestions(result.data);
      }
    } catch (err) {
      console.error('Error getting suggestions:', err);
    }
  };

  const handleHelpRequest = async () => {
    if (!state) return;

    try {
      const response = await fetch('/api/onboarding/help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: state.currentStep,
          context: state.stepData,
          language
        })
      });

      const result = await response.json();

      if (result.success) {
        // In a real implementation, you would show this in a modal or sidebar
        console.log('Help content:', result.data);
        setShowHelp(true);
      }
    } catch (err) {
      console.error('Error getting help:', err);
    }
  };

  const handleComplete = async () => {
    if (!state) return;

    try {
      const response = await fetch('/api/onboarding/navigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          onboardingId: state.id,
          direction: 'next'
        })
      });

      const result = await response.json();

      if (result.success && onComplete) {
        onComplete(result.data);
      } else {
        setError(result.error || 'Failed to complete onboarding');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Error completing onboarding:', err);
    }
  };

  const renderCurrentStep = () => {
    if (!state) return null;

    const commonProps = {
      data: state.stepData[state.currentStep],
      onChange: handleStepDataChange,
      onNext: (data?: any) => navigateToStep('next', data),
      onPrevious: () => navigateToStep('previous'),
      onSave: saveProgress,
      language,
      suggestions
    };

    switch (state.currentStep) {
      case OnboardingStep.WELCOME:
        return <WelcomeStep {...commonProps} />;
      case OnboardingStep.BASIC_INFO:
        return <BasicInfoStep {...commonProps} />;
      case OnboardingStep.BRANDING:
        return <BrandingStep {...commonProps} />;
      case OnboardingStep.TEAM:
        return <TeamStep {...commonProps} />;
      case OnboardingStep.PREFERENCES:
        return <PreferencesStep {...commonProps} />;
      case OnboardingStep.COMPLETE:
        return (
          <CompletionStep
            {...commonProps}
            state={state}
            onComplete={handleComplete}
            onExit={onExit}
          />
        );
      default:
        return <div>Step not found</div>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">❌ {error}</div>
          <button
            onClick={initializeOnboarding}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!state) {
    return <div>No onboarding state</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                {language === 'id' ? 'Setup Showroom' : 'Showroom Setup'}
              </h1>
              {saving && (
                <span className="ml-3 text-sm text-gray-500">
                  {language === 'id' ? 'Menyimpan...' : 'Saving...'}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleHelpRequest}
                className="p-2 text-gray-500 hover:text-gray-700"
                title={language === 'id' ? 'Bantuan' : 'Help'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              {onExit && (
                <button
                  onClick={onExit}
                  className="text-gray-500 hover:text-gray-700"
                >
                  {language === 'id' ? 'Keluar' : 'Exit'}
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <ProgressBar
        currentStep={state.currentStep}
        completedSteps={state.completedSteps}
        progress={state.progress}
        language={language}
      />

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm p-6">
          {/* Step Navigation */}
          <StepNavigation
            currentStep={state.currentStep}
            completedSteps={state.completedSteps}
            onNavigate={navigateToStep}
            language={language}
          />

          {/* Current Step Content */}
          <div className="mt-6">
            {renderCurrentStep()}
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <SuggestionBox
              suggestions={suggestions}
              language={language}
              onDismiss={() => setSuggestions([])}
            />
          )}
        </div>
      </main>

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">
                {language === 'id' ? 'Bantuan' : 'Help'}
              </h2>
              <button
                onClick={() => setShowHelp(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Help content would be rendered here */}
            <div className="text-gray-600">
              {language === 'id'
                ? 'Konten bantuan akan ditampilkan di sini.'
                : 'Help content will be displayed here.'
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
}