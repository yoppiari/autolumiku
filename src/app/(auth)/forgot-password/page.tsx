'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({
          type: 'success',
          text: data.message,
        });
        setPhoneNumber(data.phoneNumber || null);

        // Store email in sessionStorage for next step
        sessionStorage.setItem('resetEmail', email);

        // Redirect to verify OTP page after 2 seconds
        setTimeout(() => {
          router.push('/verify-otp');
        }, 2000);
      } else {
        setMessage({
          type: 'error',
          text: data.message || data.error || 'Terjadi kesalahan',
        });
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      setMessage({
        type: 'error',
        text: 'Terjadi kesalahan sistem. Silakan coba lagi.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <div className="text-4xl font-bold text-blue-600">AutoLumiKu</div>
          </div>
          <CardTitle className="text-2xl text-center">Lupa Password</CardTitle>
          <CardDescription className="text-center">
            Masukkan email Anda untuk menerima kode OTP
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {message && (
              <div
                className={`flex items-start gap-2 px-4 py-3 rounded-lg text-sm ${
                  message.type === 'success'
                    ? 'bg-green-50 border border-green-200 text-green-700'
                    : 'bg-red-50 border border-red-200 text-red-700'
                }`}
              >
                {message.type === 'success' ? (
                  <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p>{message.text}</p>
                  {phoneNumber && (
                    <p className="mt-1 text-xs">
                      Pesan dikirim ke WhatsApp: <strong>{phoneNumber}</strong>
                    </p>
                  )}
                </div>
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="anda@example.com"
                disabled={loading}
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
              <p className="font-medium mb-1">ℹ️ Informasi</p>
              <p>
                Jika showroom Anda sudah terhubung dengan WhatsApp, kode OTP akan dikirim ke
                WhatsApp bot showroom.
              </p>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Mengirim...
                </>
              ) : (
                'Kirim Kode OTP'
              )}
            </Button>

            <div className="text-center pt-2">
              <Link href="/login" className="text-sm text-blue-600 hover:text-blue-700">
                Kembali ke halaman login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
