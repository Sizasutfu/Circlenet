// src/app/login/page.jsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import OtpInput from '@/components/ui/OtpInput';

export default function LoginPage() {
  const { login, sendPhoneOtp, verifyPhoneOtp, user } = useAuth();
  const router = useRouter();

  // Redirect if already logged in
  useEffect(() => {
    if (user) router.push('/feed');
  }, [user, router]);

  // ── Email login state ──
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // ── Phone login state ──
  const [method, setMethod] = useState('email'); // 'email' | 'phone'
  const [phone, setPhone] = useState('');
  const [dialCode, setDialCode] = useState('+1');
  const [phoneStep, setPhoneStep] = useState('step1'); // 'step1' | 'step2'
  const [phoneError, setPhoneError] = useState('');
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [canResend, setCanResend] = useState(false);
  const [phoneCode, setPhoneCode] = useState('');

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push('/feed');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSendPhoneOtp = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 5) {
      setPhoneError('Please enter a valid phone number.');
      return;
    }
    const fullPhone = dialCode + digits;
    setPhoneLoading(true);
    setPhoneError('');
    try {
      await sendPhoneOtp(fullPhone);
      setPhoneStep('step2');
      setOtpTimer(30);
      setCanResend(false);
      // Start countdown
      const interval = setInterval(() => {
        setOtpTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      // Store interval id to clear later
      window._otpInterval = interval;
    } catch (err) {
      setPhoneError(err.message || 'Failed to send OTP');
    } finally {
      setPhoneLoading(false);
    }
  };

  const handlePhoneVerify = async (code) => {
    if (code.length !== 6) return;
    const digits = phone.replace(/\D/g, '');
    const fullPhone = dialCode + digits;
    setPhoneLoading(true);
    setPhoneError('');
    try {
      await verifyPhoneOtp(fullPhone, code);
      router.push('/feed');
    } catch (err) {
      setPhoneError(err.message || 'Invalid code');
      // Reset OTP inputs (shake handled by OtpInput? We'll handle externally)
      setPhoneCode('');
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!canResend) return;
    setCanResend(false);
    setPhoneStep('step1'); // go back to send step
    // Or we could resend directly, but we'll just go back to step1
    // Actually, we can resend directly:
    const digits = phone.replace(/\D/g, '');
    const fullPhone = dialCode + digits;
    setPhoneLoading(true);
    try {
      await sendPhoneOtp(fullPhone);
      setPhoneStep('step2');
      setOtpTimer(30);
      setCanResend(false);
      const interval = setInterval(() => {
        setOtpTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      window._otpInterval = interval;
    } catch (err) {
      setPhoneError(err.message || 'Failed to resend');
    } finally {
      setPhoneLoading(false);
    }
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (window._otpInterval) clearInterval(window._otpInterval);
    };
  }, []);

  return (
    <div className="max-w-md mx-auto mt-16 p-6 bg-[var(--color-card)] border border-[var(--color-border)] rounded-[var(--radius-radius)]">
      <h1 className="text-2xl font-head font-bold text-[var(--color-txt)] mb-6 text-center">Welcome Back</h1>

      {/* Method Tabs */}
      <div className="flex gap-2 mb-6 bg-[var(--color-surface)] p-1 rounded-lg">
        <button
          onClick={() => setMethod('email')}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition ${
            method === 'email' ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-txt2)] hover:text-[var(--color-txt)]'
          }`}
        >
          Email
        </button>
        <button
          onClick={() => setMethod('phone')}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition ${
            method === 'phone' ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-txt2)] hover:text-[var(--color-txt)]'
          }`}
        >
          Phone
        </button>
      </div>

      {/* ── Email Method ── */}
      {method === 'email' && (
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          {error && <div className="text-sm text-[var(--color-rose)] bg-[var(--color-rose-bg)] p-2 rounded">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-[var(--color-txt2)] mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-[var(--radius-radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-[var(--color-txt)] focus:border-[var(--color-accent)] focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-txt2)] mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-[var(--radius-radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-[var(--color-txt)] focus:border-[var(--color-accent)] focus:outline-none"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-[var(--color-accent)] text-white font-medium rounded-[var(--radius-radius-sm)] hover:bg-[var(--color-accent-h)] transition disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
          <p className="text-center text-sm text-[var(--color-txt2)]">
            Don't have an account? <Link href="/register" className="text-[var(--color-accent)] hover:underline">Register</Link>
          </p>
          <p className="text-center text-sm">
            <Link href="/reset-password" className="text-[var(--color-txt2)] hover:text-[var(--color-accent)]">Forgot password?</Link>
          </p>
        </form>
      )}

      {/* ── Phone Method ── */}
      {method === 'phone' && (
        <div>
          {phoneError && <div className="text-sm text-[var(--color-rose)] bg-[var(--color-rose-bg)] p-2 rounded mb-4">{phoneError}</div>}

          {phoneStep === 'step1' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-txt2)] mb-1">Phone Number</label>
                <div className="flex gap-2">
                  <select
                    value={dialCode}
                    onChange={(e) => setDialCode(e.target.value)}
                    className="w-28 rounded-[var(--radius-radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2 text-[var(--color-txt)] focus:border-[var(--color-accent)] focus:outline-none"
                  >
                    <option value="+1">+1 (US/CA)</option>
                    <option value="+44">+44 (UK)</option>
                    <option value="+61">+61 (AU)</option>
                    <option value="+91">+91 (IN)</option>
                    <option value="+254">+254 (KE)</option>
                    {/* Add more as needed */}
                  </select>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    className="flex-1 rounded-[var(--radius-radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-[var(--color-txt)] focus:border-[var(--color-accent)] focus:outline-none"
                    placeholder="Phone number (digits only)"
                  />
                </div>
              </div>
              <button
                onClick={handleSendPhoneOtp}
                disabled={phoneLoading}
                className="w-full py-2 bg-[var(--color-accent)] text-white font-medium rounded-[var(--radius-radius-sm)] hover:bg-[var(--color-accent-h)] transition disabled:opacity-50"
              >
                {phoneLoading ? 'Sending…' : 'Send OTP'}
              </button>
            </div>
          )}

          {phoneStep === 'step2' && (
            <div className="space-y-4">
              <p className="text-center text-sm text-[var(--color-txt2)]">
                Enter the 6-digit code sent to {dialCode} {phone}
              </p>
              <OtpInput
                prefix="login-phone"
                length={6}
                onComplete={handlePhoneVerify}
              />
              <div className="text-center text-sm text-[var(--color-txt2)]">
                {otpTimer > 0 ? `Resend in ${otpTimer}s` : (
                  <button
                    onClick={handleResendOtp}
                    className="text-[var(--color-accent)] hover:underline"
                    disabled={!canResend}
                  >
                    Resend code
                  </button>
                )}
              </div>
              <button
                onClick={() => setPhoneStep('step1')}
                className="text-sm text-[var(--color-txt2)] hover:text-[var(--color-accent)]"
              >
                ← Change phone number
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}