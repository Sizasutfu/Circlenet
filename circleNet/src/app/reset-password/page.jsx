'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';

export default function ResetPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-16 p-6 bg-[var(--color-card)] border border-[var(--color-border)] rounded-[var(--radius-radius)]">
      <h1 className="text-2xl font-head font-bold text-[var(--color-txt)] mb-6 text-center">Reset Password</h1>

      {!sent ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="text-sm text-[var(--color-rose)] bg-[var(--color-rose-bg)] p-2 rounded">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-[var(--color-txt2)] mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-[var(--radius-radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-[var(--color-txt)] focus:border-[var(--color-accent)] focus:outline-none"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-[var(--color-accent)] text-white font-medium rounded-[var(--radius-radius-sm)] hover:bg-[var(--color-accent-h)] transition disabled:opacity-50"
          >
            {loading ? 'Sending…' : 'Send Reset Link'}
          </button>
          <p className="text-center text-sm">
            <Link href="/login" className="text-[var(--color-txt2)] hover:text-[var(--color-accent)]">Back to Login</Link>
          </p>
        </form>
      ) : (
        <div className="text-center space-y-4">
          <p className="text-[var(--color-green)]">✅ If that email exists, a reset link has been sent.</p>
          <p className="text-sm text-[var(--color-txt2)]">Check your inbox and follow the instructions.</p>
          <Link href="/login" className="text-[var(--color-accent)] hover:underline">Return to Login</Link>
        </div>
      )}
    </div>
  );
}