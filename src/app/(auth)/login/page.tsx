/**
 * Login Page
 * Epic 1: User Authentication UI
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface TenantBranding {
  name: string;
  logoUrl?: string;
  primaryColor?: string;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionExpired, setSessionExpired] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [branding, setBranding] = useState<TenantBranding | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  // Check for session expired error in URL
  useEffect(() => {
    if (searchParams.get('error') === 'session_expired') {
      setSessionExpired(true);
    }
  }, [searchParams]);

  // Fetch tenant branding on mount
  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const response = await fetch('/api/public/tenant-info');
        if (response.ok) {
          const data = await response.json();
          if (data.branding || data.tenant) {
            setBranding({
              name: data.branding?.showroomName || data.tenant?.name || 'AutoLumiKu',
              logoUrl: data.branding?.logoUrl || data.tenant?.logoUrl,
              primaryColor: data.branding?.primaryColor,
            });
          }
        }
      } catch (err) {
        console.log('Using default branding');
      }
    };
    fetchBranding();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    console.log('Submitting login form:', formData); // Debug log

    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      console.log('Login response status:', response.status);
      const result = await response.json();
      console.log('Login response data:', result);

      if (!result.success) {
        setError(result.error || result.message || 'Login failed');
        setLoading(false);
        return;
      }

      // Store token and user data
      if (result.data?.accessToken) {
        localStorage.setItem('authToken', result.data.accessToken);
        localStorage.setItem('refreshToken', result.data.refreshToken);
        localStorage.setItem('user', JSON.stringify(result.data.user));
        console.log('Showroom token stored, user role:', result.data.user.role);
        console.log('Redirecting to dashboard...');
      }

      // Showroom users go to /dashboard
      router.push('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <div className="flex justify-center mb-4">
          {branding?.logoUrl ? (
            <Image
              src={branding.logoUrl}
              alt={branding.name}
              width={200}
              height={60}
              className="h-14 w-auto object-contain"
              priority
            />
          ) : (
            <div
              className="text-4xl font-bold"
              style={{ color: branding?.primaryColor || '#2563eb' }}
            >
              {branding?.name || 'AutoLumiKu'}
            </div>
          )}
        </div>
        <CardTitle className="text-2xl text-center">Welcome back</CardTitle>
        <CardDescription className="text-center">
          Enter your credentials to access your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {sessionExpired && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm">
              Sesi Anda telah berakhir karena tidak ada aktivitas selama 60 menit. Silakan login kembali.
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium text-gray-700">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Suspense fallback={
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex justify-center mb-4">
              <div className="text-4xl font-bold text-blue-600">Loading...</div>
            </div>
          </CardHeader>
        </Card>
      }>
        <LoginForm />
      </Suspense>
    </div>
  );
}
