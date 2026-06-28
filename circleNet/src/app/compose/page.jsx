// src/app/compose/page.jsx
import { Suspense } from 'react';
import ComposePage from './ComposePage';

export const metadata = {
  title: 'Create | Circlenet',
  description: 'Create a new post or article.',
};

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-[var(--color-txt2)]">Loading...</div>}>
      <ComposePage />
    </Suspense>
  );
}