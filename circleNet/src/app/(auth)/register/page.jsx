// src/app/register/page.jsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import OtpInput from '@/components/ui/OtpInput';

export default function RegisterPage() {
  const { register, sendEmailVerification, verifyEmail, registerPhoneSendOtp, registerPhoneVerifyOtp, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) router.push('/feed');
  }, [user, router]);

  const [method, setMethod] = useState('email');
  // Email state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('step1'); // step1 | verify
  const [verifyEmailAddr, setVerifyEmailAddr] = useState('');
  const [otpTimer, setOtpTimer] = useState(0);
  const [canResend, setCanResend] = useState(false);

  // Phone state
  const [phone, setPhone] = useState('');
  const [dialCode, setDialCode] = useState('+1');
  const [phoneName, setPhoneName] = useState('');
  const [phoneStep, setPhoneStep] = useState('step1');
  const [phoneError, setPhoneError] = useState('');
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneOtpTimer, setPhoneOtpTimer] = useState(0);
  const [canResendPhone, setCanResendPhone] = useState(false);

  // ── Email registration ──
  const handleEmailRegister = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await register(name, email, password);
      // Send verification code
      await sendEmailVerification(email);
      setVerifyEmailAddr(email);
      setStep('verify');
      setOtpTimer(60);
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
      window._registerInterval = interval;
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailVerify = async (code) => {
    if (code.length !== 6) return;
    setLoading(true);
    try {
      await verifyEmail(verifyEmailAddr, code);
      router.push('/feed');
    } catch (err) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (!canResend) return;
    try {
      await sendEmailVerification(verifyEmailAddr);
      setOtpTimer(60);
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
      window._registerInterval = interval;
    } catch (err) {
      setError('Failed to resend code.');
    }
  };

  // ── Phone registration ──
  const handlePhoneRegisterSend = async () => {
    const digits = phone.replace(/\D/g, '');
    if (!phoneName || phoneName.length < 2) {
      setPhoneError('Name must be at least 2 characters.');
      return;
    }
    if (digits.length < 5) {
      setPhoneError('Please enter a valid phone number.');
      return;
    }
    const fullPhone = dialCode + digits;
    setPhoneLoading(true);
    setPhoneError('');
    try {
      await registerPhoneSendOtp(fullPhone, phoneName);
      setPhoneStep('step2');
      setPhoneOtpTimer(60);
      setCanResendPhone(false);
      const interval = setInterval(() => {
        setPhoneOtpTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setCanResendPhone(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      window._phoneRegisterInterval = interval;
    } catch (err) {
      setPhoneError(err.message || 'Failed to send code');
    } finally {
      setPhoneLoading(false);
    }
  };

  const handlePhoneRegisterVerify = async (code) => {
    if (code.length !== 6) return;
    const digits = phone.replace(/\D/g, '');
    const fullPhone = dialCode + digits;
    setPhoneLoading(true);
    setPhoneError('');
    try {
      await registerPhoneVerifyOtp(fullPhone, code, phoneName);
      router.push('/feed');
    } catch (err) {
      setPhoneError(err.message || 'Verification failed');
    } finally {
      setPhoneLoading(false);
    }
  };

  // Cleanup intervals
  useEffect(() => {
    return () => {
      if (window._registerInterval) clearInterval(window._registerInterval);
      if (window._phoneRegisterInterval) clearInterval(window._phoneRegisterInterval);
    };
  }, []);

  return (
    <div className="max-w-md mx-auto mt-16 p-6 bg-[var(--color-card)] border border-[var(--color-border)] rounded-[var(--radius-radius)]">
      <h1 className="text-2xl font-head font-bold text-[var(--color-txt)] mb-6 text-center">Create Account</h1>

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

      {method === 'email' && (
        <>
          {step === 'step1' && (
            <form onSubmit={handleEmailRegister} className="space-y-4">
              {error && <div className="text-sm text-[var(--color-rose)] bg-[var(--color-rose-bg)] p-2 rounded">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-[var(--color-txt2)] mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-[var(--radius-radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-[var(--color-txt)] focus:border-[var(--color-accent)] focus:outline-none"
                  required
                />
              </div>
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
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-txt2)] mb-1">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-[var(--radius-radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-[var(--color-txt)] focus:border-[var(--color-accent)] focus:outline-none"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-[var(--color-accent)] text-white font-medium rounded-[var(--radius-radius-sm)] hover:bg-[var(--color-accent-h)] transition disabled:opacity-50"
              >
                {loading ? 'Creating…' : 'Create Account'}
              </button>
              <p className="text-center text-sm text-[var(--color-txt2)]">
                Already have an account? <Link href="/login" className="text-[var(--color-accent)] hover:underline">Sign In</Link>
              </p>
            </form>
          )}

          {step === 'verify' && (
            <div className="space-y-4">
              <p className="text-center text-sm text-[var(--color-txt2)]">
                We sent a 6-digit code to <strong>{verifyEmailAddr}</strong>
              </p>
              <OtpInput
                prefix="register-email"
                length={6}
                onComplete={handleEmailVerify}
              />
              <div className="text-center text-sm text-[var(--color-txt2)]">
                {otpTimer > 0 ? `Resend in ${otpTimer}s` : (
                  <button
                    onClick={handleResendEmail}
                    className="text-[var(--color-accent)] hover:underline"
                    disabled={!canResend}
                  >
                    Resend code
                  </button>
                )}
              </div>
              {error && <div className="text-sm text-[var(--color-rose)] bg-[var(--color-rose-bg)] p-2 rounded">{error}</div>}
              <button
                onClick={() => setStep('step1')}
                className="text-sm text-[var(--color-txt2)] hover:text-[var(--color-accent)]"
              >
                ← Change email
              </button>
            </div>
          )}
        </>
      )}

      {method === 'phone' && (
        <>
          {phoneStep === 'step1' && (
            <div className="space-y-4">
              {phoneError && <div className="text-sm text-[var(--color-rose)] bg-[var(--color-rose-bg)] p-2 rounded">{phoneError}</div>}
              <div>
                <label className="block text-sm font-medium text-[var(--color-txt2)] mb-1">Name</label>
                <input
                  type="text"
                  value={phoneName}
                  onChange={(e) => setPhoneName(e.target.value)}
                  className="w-full rounded-[var(--radius-radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-[var(--color-txt)] focus:border-[var(--color-accent)] focus:outline-none"
                  required
                />
              </div>
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
                onClick={handlePhoneRegisterSend}
                disabled={phoneLoading}
                className="w-full py-2 bg-[var(--color-accent)] text-white font-medium rounded-[var(--radius-radius-sm)] hover:bg-[var(--color-accent-h)] transition disabled:opacity-50"
              >
                {phoneLoading ? 'Sending…' : 'Send OTP'}
              </button>
              <p className="text-center text-sm text-[var(--color-txt2)]">
                Already have an account? <Link href="/login" className="text-[var(--color-accent)] hover:underline">Sign In</Link>
              </p>
            </div>
          )}

          {phoneStep === 'step2' && (
            <div className="space-y-4">
              <p className="text-center text-sm text-[var(--color-txt2)]">
                Enter the 6-digit code sent to {dialCode} {phone}
              </p>
              <OtpInput
                prefix="register-phone"
                length={6}
                onComplete={handlePhoneRegisterVerify}
              />
              <div className="text-center text-sm text-[var(--color-txt2)]">
                {phoneOtpTimer > 0 ? `Resend in ${phoneOtpTimer}s` : (
                  <button
                    onClick={handleResendPhone}
                    className="text-[var(--color-accent)] hover:underline"
                    disabled={!canResendPhone}
                  >
                    Resend code
                  </button>
                )}
              </div>
              {phoneError && <div className="text-sm text-[var(--color-rose)] bg-[var(--color-rose-bg)] p-2 rounded">{phoneError}</div>}
              <button
                onClick={() => setPhoneStep('step1')}
                className="text-sm text-[var(--color-txt2)] hover:text-[var(--color-accent)]"
              >
                ← Change phone number
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}