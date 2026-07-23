// src/app/register/page.jsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import OtpInput from '@/components/ui/OtpInput';

export default function RegisterPage() {
  const { register, sendEmailVerification, verifyEmail, registerPhoneSendOtp, registerPhoneVerifyOtp, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── Get redirect target from URL ──
  const redirectTo = searchParams.get('redirect') || '/feed';

  useEffect(() => {
    if (user) router.push(redirectTo);
  }, [user, router, redirectTo]);

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

  // Terms acceptance
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Password visibility toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // ── Password strength ──
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, label: '' });

  const checkStrength = (pwd) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd)) score++;

    const capped = Math.min(score, 4);
    const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
    return { score: capped, label: labels[capped] };
  };

  useEffect(() => {
    setPasswordStrength(checkStrength(password));
  }, [password]);

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
      router.push(redirectTo);
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
      router.push(redirectTo);
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

  // Eye icon components
  const EyeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );

  const EyeOffIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );

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
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-[var(--radius-radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 pr-10 text-[var(--color-txt)] focus:border-[var(--color-accent)] focus:outline-none"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-txt2)] hover:text-[var(--color-txt)] focus:outline-none"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>

                {/* ── Strength meter ── */}
                {password.length > 0 && (
                  <div className="mt-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-[var(--color-surface)] rounded-full overflow-hidden">
                        <div
                          className="h-full transition-all duration-200"
                          style={{
                            width: `${(passwordStrength.score / 4) * 100}%`,
                            backgroundColor:
                              passwordStrength.score === 0 ? 'var(--color-rose)' :
                              passwordStrength.score === 1 ? 'var(--color-rose)' :
                              passwordStrength.score === 2 ? '#f59e0b' :
                              passwordStrength.score === 3 ? '#3b82f6' :
                              '#22c55e',
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium text-[var(--color-txt2)] whitespace-nowrap">
                        {passwordStrength.label}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--color-txt3)] mt-1">
                      {passwordStrength.score === 0 && 'Add length, uppercase, lowercase, digits, or special characters.'}
                      {passwordStrength.score === 1 && 'Add more variety (uppercase, digits, special).'}
                      {passwordStrength.score === 2 && 'Good – add more length or special characters.'}
                      {passwordStrength.score === 3 && 'Strong – almost there!'}
                      {passwordStrength.score === 4 && 'Excellent – this password is very strong.'}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-txt2)] mb-1">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-[var(--radius-radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 pr-10 text-[var(--color-txt)] focus:border-[var(--color-accent)] focus:outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-txt2)] hover:text-[var(--color-txt)] focus:outline-none"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-xs text-[var(--color-rose)] mt-1">Passwords do not match.</p>
                )}
              </div>

              {/* Terms of Service checkbox */}
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="terms-email"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-1 accent-[var(--color-accent)]"
                />
                <label htmlFor="terms-email" className="text-sm text-[var(--color-txt2)]">
                  I agree to the <Link href="/terms" className="text-[var(--color-accent)] hover:underline">Terms of Service</Link>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading || !termsAccepted}
                className="w-full py-2 bg-[var(--color-accent)] text-white font-medium rounded-[var(--radius-radius-sm)] hover:bg-[var(--color-accent-h)] transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating…' : 'Create Account'}
              </button>
              <p className="text-center text-sm text-[var(--color-txt2)]">
                Already have an account? <Link href={`/login${redirectTo ? '?redirect='+encodeURIComponent(redirectTo) : ''}`} className="text-[var(--color-accent)] hover:underline">Sign In</Link>
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

              {/* Terms of Service checkbox */}
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="terms-phone"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-1 accent-[var(--color-accent)]"
                />
                <label htmlFor="terms-phone" className="text-sm text-[var(--color-txt2)]">
                  I agree to the <Link href="/terms" className="text-[var(--color-accent)] hover:underline">Terms of Service</Link>
                </label>
              </div>

              <button
                onClick={handlePhoneRegisterSend}
                disabled={phoneLoading || !termsAccepted}
                className="w-full py-2 bg-[var(--color-accent)] text-white font-medium rounded-[var(--radius-radius-sm)] hover:bg-[var(--color-accent-h)] transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {phoneLoading ? 'Sending…' : 'Send OTP'}
              </button>
              <p className="text-center text-sm text-[var(--color-txt2)]">
                Already have an account? <Link href={`/login${redirectTo ? '?redirect='+encodeURIComponent(redirectTo) : ''}`} className="text-[var(--color-accent)] hover:underline">Sign In</Link>
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