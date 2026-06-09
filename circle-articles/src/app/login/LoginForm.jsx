'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get('redirect');
  const { user, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      router.replace('/articles');
    }
  }, [user, router]);

  const resolveRedirect = () => {
    if (!redirectParam) return '/articles';
    try {
      const url = new URL(redirectParam, window.location.origin);
      if (url.origin === window.location.origin) {
        return url.pathname + url.search + url.hash;
      }
    } catch (err) {
      console.warn('Invalid redirect payload:', err);
    }
    return '/articles';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    if (!email.trim() || !password) {
      setError('Email and password are required.');
      setLoading(false);
      return;
    }

    try {
      const res = await apiClient('/api/users/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      });
      login(res.data);
      router.push(resolveRedirect());
    } catch (err) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-md mx-auto px-4 py-16 sm:px-6">
      <div className="rounded-radius-lg border border-border bg-surface p-8 shadow-xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-txt">Log in to Circlenet</h1>
          <p className="text-txt2 mt-2 text-sm">
            Use your Circle account to like, comment, and save articles.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-radius-sm border border-rose bg-rose-bg px-4 py-3 text-sm text-rose">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-semibold text-txt2">
            Email
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className="mt-2 w-full rounded-radius-sm border border-border bg-card px-4 py-3 text-sm text-txt outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>

          <label className="block text-sm font-semibold text-txt2">
            Password
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              className="mt-2 w-full rounded-radius-sm border border-border bg-card px-4 py-3 text-sm text-txt outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-radius-sm bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-accent-h disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-txt2">
          Need an account?{' '}
          <Link href="/articles" className="font-semibold text-accent hover:underline">
            Continue browsing
          </Link>
        </p>
      </div>
    </main>
  );
}
