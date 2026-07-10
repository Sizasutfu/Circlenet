// app/drafts/page.jsx
import { Suspense } from 'react';
import DraftsClient from './DraftsClient';

export const metadata = {
  title: 'My Drafts | Circlenet',
};

export default function DraftsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-[var(--color-txt2)]">Loading drafts...</div>}>
      <DraftsClient />
    </Suspense>
  );
}