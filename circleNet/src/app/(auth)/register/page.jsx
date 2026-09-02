// src/app/(auth)/register/page.jsx
import { Suspense } from 'react';
import RegisterClient from './RegisterClient';

export const metadata = {
  title: 'Create Account | Circlenet',
  description: 'Create your Circlenet account.',
};

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-[var(--color-txt2)]">Loading...</div>}>
      <RegisterClient />
    </Suspense>
  );
}