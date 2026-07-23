// src/components/ui/SignupPrompt.jsx
'use client';

import Link from 'next/link';
import { getAuthUrl } from '@/lib/redirect';

export default function SignupPrompt({
  title = '✨ Want to see more?',
  description = "Create a free account to continue scrolling and join the conversation.",
  signupText = 'Sign up free',
  loginText = 'Log in',
  redirectTo = null, // optional: override the redirect target
  className = '',
}) {
  // If redirectTo is not provided, use the current page
  const redirect = redirectTo || (typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/');

  return (
    <div className={`my-6 p-6 border border-[var(--color-border)] rounded-xl bg-[var(--color-card)] text-center shadow-md ${className}`}>
      <h3 className="text-lg font-head font-bold text-[var(--color-txt)]">{title}</h3>
      <p className="text-sm text-[var(--color-txt2)] mt-1">{description}</p>
      <div className="flex items-center justify-center gap-3 mt-4">
        <Link
          href={`/register?redirect=${encodeURIComponent(redirect)}`}
          className="px-6 py-2 bg-[var(--color-accent)] text-white rounded-full font-medium hover:bg-[var(--color-accent-h)] transition"
        >
          {signupText}
        </Link>
        <Link
          href={`/login?redirect=${encodeURIComponent(redirect)}`}
          className="px-6 py-2 border border-[var(--color-border)] text-[var(--color-txt2)] rounded-full hover:bg-[var(--color-surface)] transition"
        >
          {loginText}
        </Link>
      </div>
    </div>
  );
}