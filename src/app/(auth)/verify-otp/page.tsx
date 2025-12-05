'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, Loader2, Clock } from 'lucide-react';

export default function VerifyOTPPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [otp, setOtp] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds
  const [resendCooldown, setResendCooldown] = useState(0);

  // Load email from sessionStorage
  useEffect(() => {
    const storedEmail = sessionStorage.getItem('resetEmail');
    if (!storedEmail) {
      router.push('/forgot-password');
      return;
    }
    setEmail(storedEmail);
  }, [router]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;

    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [resendCooldown]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/v1/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({
          type: 'success',
          text: data.message,
        });

        // Store reset token
        sessionStorage.setItem('resetToken', data.resetToken);

        // Redirect to reset password page
        setTimeout(() => {
          router.push('/reset-password');
        }, 1500);
      } else {
        setMessage({
          type: 'error',
          text: data.message || data.error || 'Kode OTP tidak valid',
        });
        setAttemptsLeft(data.attemptsLeft ?? null);
      }
    } catch (error) {
      console.error('Verify OTP error:', error);
      setMessage({
        type: 'error',
        text: 'Terjadi kesalahan sistem. Silakan coba lagi.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
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
          text: 'Kode OTP baru telah dikirim ke WhatsApp',
        });
        setTimeLeft(300); // Reset timer
        setResendCooldown(60); // 60 seconds cooldown
        setOtp(''); // Clear OTP input
      } else {
        setMessage({
          type: 'error',
          text: data.message || data.error || 'Gagal mengirim OTP',
        });
      }
    } catch (error) {
      console.error('Resend OTP error:', error);
      setMessage({
        type: 'error',
        text: 'Terjadi kesalahan sistem. Silakan coba lagi.',
      });
    } finally {
      setResending(false);
    }
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setOtp(value);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <div className="text-4xl font-bold text-blue-600">AutoLumiKu</div>
          </div>
          <CardTitle className="text-2xl text-center">Verifikasi Kode OTP</CardTitle>
          <CardDescription className="text-center">
            Masukkan kode OTP yang telah dikirim ke WhatsApp
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
                <div className="flex-1">
                  <p>{message.text}</p>
                  {attemptsLeft !== null && (
                    <p className="mt-1 text-xs font-semibold">
                      Sisa percobaan: {attemptsLeft} kali
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Timer */}
            <div className="flex items-center justify-center gap-2 text-gray-700 bg-gray-50 rounded-lg py-3">
              <Clock className="h-5 w-5" />
              <span className="font-mono text-lg font-semibold">
                {formatTime(timeLeft)}
              </span>
              <span className="text-sm">tersisa</span>
            </div>

            {timeLeft === 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 text-center">
                Kode OTP sudah kadaluarsa. Silakan kirim ulang OTP baru.
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="otp" className="text-sm font-medium text-gray-700">
                Kode OTP (6 Digit)
              </label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                required
                value={otp}
                onChange={handleOtpChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl font-mono tracking-widest"
                placeholder="000000"
                disabled={loading || timeLeft === 0}
                maxLength={6}
              />
              <p className="text-xs text-gray-500 text-center">
                Email: <strong>{email}</strong>
              </p>
            </div>

            <Button
              type="submit"
              disabled={loading || otp.length !== 6 || timeLeft === 0}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Memverifikasi...
                </>
              ) : (
                'Verifikasi OTP'
              )}
            </Button>

            {/* Resend OTP */}
            <div className="text-center pt-2">
              {resendCooldown > 0 ? (
                <p className="text-sm text-gray-500">
                  Kirim ulang OTP dalam {resendCooldown} detik
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  className="text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
                >
                  {resending ? 'Mengirim...' : 'Kirim Ulang OTP'}
                </button>
              )}
            </div>

            <div className="text-center pt-2 border-t">
              <Link href="/forgot-password" className="text-sm text-gray-600 hover:text-gray-700">
                Kembali ke halaman sebelumnya
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
