// src/app/(auth)/login/page.jsx
import { Suspense } from 'react';
import LoginClient from './LoginClient';

export const metadata = {
  title: 'Sign In | Circlenet',
  description: 'Sign in to your Circlenet account.',
};

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-[var(--color-txt2)]">Loading...</div>}>
      <LoginClient />
    </Suspense>
  );
}