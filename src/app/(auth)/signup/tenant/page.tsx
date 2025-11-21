/**
 * Tenant Signup Page
 * Epic 1: Tenant Onboarding Wizard
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type Step = 'business' | 'subdomain' | 'admin' | 'complete';

export default function TenantSignupPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>('business');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    // Business info
    businessName: '',
    industry: 'automotive',

    // Subdomain
    subdomain: '',
    subdomainAvailable: false,

    // Admin user
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const checkSubdomain = async () => {
    if (!formData.subdomain) return;

    try {
      const response = await fetch(`/api/v1/tenants/check-subdomain?subdomain=${formData.subdomain}`);
      const result = await response.json();
      setFormData({ ...formData, subdomainAvailable: result.available });
    } catch (err) {
      setError('Failed to check subdomain availability');
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/v1/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.businessName,
          subdomain: formData.subdomain,
          industry: formData.industry,
          adminUser: {
            email: formData.email,
            password: formData.password,
            firstName: formData.firstName,
            lastName: formData.lastName,
          },
        }),
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.message || 'Signup failed');
        setLoading(false);
        return;
      }

      // Move to completion step
      setCurrentStep('complete');
      setLoading(false);
    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  const renderBusinessStep = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Business Name</label>
        <input
          type="text"
          required
          value={formData.businessName}
          onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="ABC Motors"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Industry</label>
        <select
          value={formData.industry}
          onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="automotive">Automotive / Car Dealership</option>
          <option value="motorcycle">Motorcycle Dealership</option>
          <option value="rental">Vehicle Rental</option>
          <option value="other">Other</option>
        </select>
      </div>

      <Button
        onClick={() => setCurrentStep('subdomain')}
        disabled={!formData.businessName}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
      >
        Continue
      </Button>
    </div>
  );

  const renderSubdomainStep = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Choose Your Subdomain</label>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            required
            value={formData.subdomain}
            onChange={(e) => setFormData({ ...formData, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
            onBlur={checkSubdomain}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="abc-motors"
          />
          <span className="text-gray-500">.autolumiku.com</span>
        </div>
        {formData.subdomain && (
          <p className={`text-sm ${formData.subdomainAvailable ? 'text-green-600' : 'text-red-600'}`}>
            {formData.subdomainAvailable ? '✓ Available' : '✗ Already taken'}
          </p>
        )}
        <p className="text-xs text-gray-500">
          This will be your dealership's unique URL
        </p>
      </div>

      <div className="flex space-x-3">
        <Button
          onClick={() => setCurrentStep('business')}
          variant="outline"
          className="flex-1"
        >
          Back
        </Button>
        <Button
          onClick={() => setCurrentStep('admin')}
          disabled={!formData.subdomain || !formData.subdomainAvailable}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
        >
          Continue
        </Button>
      </div>
    </div>
  );

  const renderAdminStep = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">First Name</label>
          <input
            type="text"
            required
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="John"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Last Name</label>
          <input
            type="text"
            required
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Doe"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Email</label>
        <input
          type="email"
          required
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="you@example.com"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Password</label>
        <input
          type="password"
          required
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="••••••••"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Confirm Password</label>
        <input
          type="password"
          required
          value={formData.confirmPassword}
          onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="••••••••"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="flex space-x-3">
        <Button
          onClick={() => setCurrentStep('subdomain')}
          variant="outline"
          className="flex-1"
        >
          Back
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={loading || !formData.email || !formData.password}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
        >
          {loading ? 'Creating...' : 'Create Account'}
        </Button>
      </div>
    </div>
  );

  const renderCompleteStep = () => (
    <div className="text-center space-y-6">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Welcome to AutoLumiKu!</h3>
        <p className="text-gray-600">
          Your account has been created successfully.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Your dealership URL:</strong><br />
          https://{formData.subdomain}.autolumiku.com
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-sm text-gray-600">
          We've sent a verification email to <strong>{formData.email}</strong>
        </p>
        <Button
          onClick={() => router.push('/login')}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
        >
          Go to Login
        </Button>
      </div>
    </div>
  );

  const steps = [
    { id: 'business', name: 'Business Info', current: currentStep === 'business' },
    { id: 'subdomain', name: 'Subdomain', current: currentStep === 'subdomain' },
    { id: 'admin', name: 'Admin Account', current: currentStep === 'admin' },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="text-3xl font-bold text-blue-600">AutoLumiKu</div>
          </div>
          <CardTitle className="text-2xl text-center">
            {currentStep === 'complete' ? 'Account Created!' : 'Create Your Dealership'}
          </CardTitle>
          <CardDescription className="text-center">
            {currentStep === 'complete'
              ? 'Start managing your inventory today'
              : 'Get started with your 14-day free trial'}
          </CardDescription>

          {currentStep !== 'complete' && (
            <div className="flex justify-center mt-6">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      step.current
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {index + 1}
                  </div>
                  {index < steps.length - 1 && (
                    <div className="w-16 h-1 bg-gray-200 mx-2"></div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {currentStep === 'business' && renderBusinessStep()}
          {currentStep === 'subdomain' && renderSubdomainStep()}
          {currentStep === 'admin' && renderAdminStep()}
          {currentStep === 'complete' && renderCompleteStep()}

          {currentStep !== 'complete' && (
            <div className="mt-6 text-center text-sm text-gray-600">
              Already have an account?{' '}
              <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
                Sign in
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
