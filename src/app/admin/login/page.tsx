'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    console.log('Admin login form data:', formData);

    try {
      const response = await fetch('/api/v1/auth/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      console.log('Admin login response status:', response.status);
      const data = await response.json();
      console.log('Admin login response data:', data);

      if (data.success) {
        // Store token in localStorage
        localStorage.setItem('authToken', data.data.accessToken);
        localStorage.setItem('refreshToken', data.data.refreshToken);
        localStorage.setItem('user', JSON.stringify(data.data.user));
        console.log('Admin token stored, redirecting to /admin...');

        // Redirect to admin dashboard
        router.push('/admin');
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      console.error('Admin login error:', err);
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-[#0d4450]"
      style={{
        backgroundImage: 'linear-gradient(rgba(13, 68, 80, 0.9), rgba(13, 68, 80, 0.9)), url(/admin-bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="rounded-lg border border-white/10 bg-[#0a3d47]/90 backdrop-blur-md shadow-2xl w-full max-w-md">
        <div className="flex flex-col p-6 space-y-1">
          <div className="flex justify-center mb-4">
            {/* Logo text matching the branding in background */}
            <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400 drop-shadow-sm">AutoLumiKu</div>
          </div>
          <h3 className="font-semibold tracking-tight text-2xl text-center text-white">Super Admin Login</h3>
          <p className="text-sm text-gray-300 text-center">Platform administration access</p>
        </div>

        <div className="p-6 pt-0">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-gray-200">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="w-full px-3 py-2 bg-[#0d4450] border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white placeholder-gray-500"
                placeholder="admin@autolumiku.com"
                value={formData.email}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-gray-200">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="w-full px-3 py-2 bg-[#0d4450] border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white placeholder-gray-500"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 h-10 px-4 w-full bg-cyan-600 hover:bg-cyan-700 text-white py-2 rounded-lg font-medium transition-colors disabled:opacity-50 shadow-lg shadow-cyan-900/20"
            >
              {isLoading ? 'Signing in...' : 'Sign in as Admin'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <a
              href="/login"
              className="text-sm text-cyan-300 hover:text-cyan-200 transition-colors"
            >
              ← Back to Showroom Login
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
