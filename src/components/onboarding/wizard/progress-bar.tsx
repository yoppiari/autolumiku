'use client';

import React from 'react';
import { OnboardingStep } from '@/types/onboarding';

interface ProgressBarProps {
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  progress: number;
  language: 'id' | 'en';
}

/**
 * Progress Bar Component
 *
 * Shows overall onboarding progress and step indicators
 */
export function ProgressBar({
  currentStep,
  completedSteps,
  progress,
  language
}: ProgressBarProps) {
  const steps = [
    { key: OnboardingStep.WELCOME, label: language === 'id' ? 'Selamat Datang' : 'Welcome' },
    { key: OnboardingStep.BASIC_INFO, label: language === 'id' ? 'Info Dasar' : 'Basic Info' },
    { key: OnboardingStep.BRANDING, label: language === 'id' ? 'Branding' : 'Branding' },
    { key: OnboardingStep.TEAM, label: language === 'id' ? 'Tim' : 'Team' },
    { key: OnboardingStep.PREFERENCES, label: language === 'id' ? 'Preferensi' : 'Preferences' },
    { key: OnboardingStep.COMPLETE, label: language === 'id' ? 'Selesai' : 'Complete' }
  ];

  const getStepStatus = (step: OnboardingStep) => {
    if (completedSteps.includes(step)) return 'completed';
    if (currentStep === step) return 'current';
    return 'pending';
  };

  return (
    <div className="bg-white border-b">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Overall Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              {language === 'id' ? 'Progress Onboarding' : 'Onboarding Progress'}
            </span>
            <span className="text-sm text-gray-500">{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        {/* Step Indicators */}
        <nav className="flex items-center justify-between" aria-label="Progress">
          {steps.map((step, index) => {
            const status = getStepStatus(step.key);
            const isCompleted = status === 'completed';
            const isCurrent = status === 'current';

            return (
              <div key={step.key} className="flex items-center">
                {/* Step Circle */}
                <div className="flex items-center">
                  <div
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors duration-200
                      ${isCompleted
                        ? 'bg-blue-600 text-white'
                        : isCurrent
                        ? 'bg-blue-100 text-blue-600 border-2 border-blue-600'
                        : 'bg-gray-200 text-gray-500'
                      }
                    `}
                  >
                    {isCompleted ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span
                    className={`
                      ml-3 text-sm font-medium transition-colors duration-200
                      ${isCompleted ? 'text-blue-600' : isCurrent ? 'text-blue-600' : 'text-gray-500'}
                    `}
                  >
                    {step.label}
                  </span>
                </div>

                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div className="flex-1 mx-4">
                    <div
                      className={`
                        h-0.5 transition-colors duration-200
                        ${isCompleted ? 'bg-blue-600' : 'bg-gray-200'}
                      `}
                    ></div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Current Step Info */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-blue-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-blue-800">
              {language === 'id'
                ? `Langkah ${steps.findIndex(s => s.key === currentStep) + 1} dari ${steps.length}: ${steps.find(s => s.key === currentStep)?.label}`
                : `Step ${steps.findIndex(s => s.key === currentStep) + 1} of ${steps.length}: ${steps.find(s => s.key === currentStep)?.label}`
              }
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}