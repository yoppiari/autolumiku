/**
 * Onboarding System Type Definitions
 */

export enum OnboardingStep {
  WELCOME = 'welcome',
  BASIC_INFO = 'basic-info',
  BRANDING = 'branding',
  TEAM = 'team',
  PREFERENCES = 'preferences',
  COMPLETE = 'complete'
}

export interface OnboardingConfig {
  tenantId: string;
  userId: string;
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  progress: number;
  startTime: Date;
  estimatedCompletionTime: number; // minutes
  skipOptional: boolean;
  language: 'id' | 'en';
  region: string;
}

export interface OnboardingState extends OnboardingConfig {
  id: string;
  stepData: Record<OnboardingStep, any>;
  lastActivity: Date;
  isCompleted: boolean;
  completionTime?: Date;
}

export interface StepDefinition {
  id: OnboardingStep;
  title: Record<'id' | 'en', string>;
  description: Record<'id' | 'en', string>;
  required: boolean;
  estimatedTime: number; // minutes
  validation?: ValidationSchema;
  helpContent?: HelpContent;
  template?: string;
}

export interface ValidationSchema {
  fields: Record<string, FieldValidation>;
}

export interface FieldValidation {
  required: boolean;
  type: 'string' | 'email' | 'phone' | 'url' | 'file' | 'color' | 'array';
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  options?: string[];
  custom?: (value: any) => boolean | string;
}

export interface HelpContent {
  title: Record<'id' | 'en', string>;
  sections: HelpSection[];
  tips: string[];
  relatedDocs?: string[];
}

export interface HelpSection {
  title: Record<'id' | 'en', string>;
  content: Record<'id' | 'en', string>;
  type: 'text' | 'video' | 'interactive';
  mediaUrl?: string;
}

// Basic Information Step Types
export interface BasicInfoData {
  showroomName: string;
  showroomType: 'new_car' | 'used_car' | 'both';
  contactEmail: string;
  phoneNumber: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  website?: string;
  businessLicense?: string;
  taxId?: string;
}

// Branding Step Types
export interface BrandingData {
  logo?: {
    url: string;
    type: string;
    size: number;
  };
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  theme: 'modern' | 'classic' | 'minimal' | 'corporate';
  customCSS?: string;
  favicon?: {
    url: string;
    type: string;
  };
}

// Team Setup Step Types
export interface TeamInvitation {
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'manager' | 'sales' | 'viewer';
  permissions: string[];
}

export interface TeamData {
  invitations: TeamInvitation[];
  teamStructure: {
    departments: string[];
    roles: Record<string, string[]>;
  };
}

// Preferences Step Types
export interface PreferencesData {
  language: 'id' | 'en';
  timezone: string;
  currency: 'IDR' | 'USD' | 'EUR';
  notificationFrequency: 'daily' | 'weekly' | 'monthly' | 'never';
  emailNotifications: boolean;
  smsNotifications: boolean;
  whatsappNotifications: boolean;
  features: {
    inventoryManagement: boolean;
    customerManagement: boolean;
    reporting: boolean;
    websiteGeneration: boolean;
    aiTools: boolean;
  };
  integrations: {
    accounting?: string;
    crm?: string;
    marketing?: string;
  };
}

// Progress Tracking Types
export interface ProgressState {
  onboardingId: string;
  tenantId: string;
  userId: string;
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  stepProgress: Record<OnboardingStep, StepProgress>;
  overallProgress: number;
  timeSpent: Record<OnboardingStep, number>;
  totalEstimatedTime: number;
  totalActualTime: number;
  lastActivity: Date;
}

export interface StepProgress {
  step: OnboardingStep;
  status: 'not_started' | 'in_progress' | 'completed' | 'skipped';
  startTime?: Date;
  endTime?: Date;
  timeSpent: number;
  validationErrors?: string[];
  savedData?: any;
}

// Template Types
export interface OnboardingTemplate {
  id: string;
  name: string;
  description: string;
  category: 'automotive' | 'general';
  prefillData: Partial<BasicInfoData & BrandingData & PreferencesData>;
  suggestedSteps: OnboardingStep[];
  industry: 'automotive' | 'other';
  size: 'small' | 'medium' | 'large';
}

export interface TemplateSuggestion {
  template: OnboardingTemplate;
  confidence: number;
  reasons: string[];
}

// Contextual Help Types
export interface HelpSuggestion {
  type: 'tip' | 'warning' | 'info' | 'tutorial';
  title: string;
  content: string;
  action?: {
    label: string;
    action: string;
  };
  priority: 'low' | 'medium' | 'high';
}

export interface SmartSuggestion {
  step: OnboardingStep;
  field?: string;
  suggestions: HelpSuggestion[];
  context: any;
}

// Analytics Types
export interface OnboardingAnalytics {
  tenantId: string;
  onboardingId: string;
  metrics: {
    totalSteps: number;
    completedSteps: number;
    timeSpent: number;
    averageStepTime: number;
    abandonmentRate: number;
    helpUsageCount: number;
    templateUsageCount: number;
  };
  stepMetrics: Record<OnboardingStep, {
    timeSpent: number;
    attemptCount: number;
    errorCount: number;
    helpViewCount: number;
  }>;
  completionData: {
    completedAt?: Date;
    totalDuration: number;
    skippedSteps: OnboardingStep[];
    templateUsed?: string;
  };
}

// API Request/Response Types
export interface InitializeOnboardingRequest {
  tenantId: string;
  userId: string;
  config?: Partial<OnboardingConfig>;
}

export interface StepNavigationRequest {
  onboardingId: string;
  stepData?: any;
  direction?: 'next' | 'previous';
  targetStep?: OnboardingStep;
}

export interface SaveProgressRequest {
  onboardingId: string;
  step: OnboardingStep;
  data: any;
}

export interface GetHelpRequest {
  step: OnboardingStep;
  context: any;
  language?: 'id' | 'en';
}

export interface GetSuggestionsRequest {
  step: OnboardingStep;
  input: any;
  context: any;
}

// Error Types
export class OnboardingError extends Error {
  constructor(
    message: string,
    public code: string,
    public step?: OnboardingStep,
    public field?: string
  ) {
    super(message);
    this.name = 'OnboardingError';
  }
}

export class ValidationError extends OnboardingError {
  constructor(
    message: string,
    step: OnboardingStep,
    field?: string,
    public validationErrors?: string[]
  ) {
    super(message, 'VALIDATION_ERROR', step, field);
    this.name = 'ValidationError';
  }
}

export class StepNavigationError extends OnboardingError {
  constructor(
    message: string,
    step: OnboardingStep,
    public targetStep?: OnboardingStep
  ) {
    super(message, 'STEP_NAVIGATION_ERROR', step);
    this.name = 'StepNavigationError';
  }
}

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type StepDataMap = {
  [OnboardingStep.WELCOME]: Record<string, any>;
  [OnboardingStep.BASIC_INFO]: BasicInfoData;
  [OnboardingStep.BRANDING]: BrandingData;
  [OnboardingStep.TEAM]: TeamData;
  [OnboardingStep.PREFERENCES]: PreferencesData;
  [OnboardingStep.COMPLETE]: Record<string, any>;
};