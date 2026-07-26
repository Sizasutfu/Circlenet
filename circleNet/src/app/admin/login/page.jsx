// src/app/admin/login/page.jsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import Link from 'next/link';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      // Store admin token and admin info
      localStorage.setItem('circle_admin_token', data.data.token);
      localStorage.setItem('circle_admin', JSON.stringify(data.data.admin));

      router.push('/admin');
    } catch (err) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] px-4">
      <div className="max-w-md w-full bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-8 shadow-lg">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-full bg-[var(--color-accent)] flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <polyline points="9 12 11 14 15 10" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-head font-extrabold text-[var(--color-txt)]">Admin Login</h1>
          <p className="text-sm text-[var(--color-txt2)] mt-1">Access the admin dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-[var(--color-rose-bg)] border border-[var(--color-rose)] rounded-lg text-sm text-[var(--color-rose)]">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[var(--color-txt2)] mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-txt)] focus:border-[var(--color-accent)] outline-none transition"
              placeholder="admin@circle.app"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-txt2)] mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-txt)] focus:border-[var(--color-accent)] outline-none transition"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[var(--color-accent)] text-white rounded-lg font-semibold hover:bg-[var(--color-accent-h)] transition disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>

          <p className="text-center text-sm text-[var(--color-txt2)]">
            <Link href="/login" className="text-[var(--color-accent)] hover:underline">
              Back to user login
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}