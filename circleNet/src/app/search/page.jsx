// app/search/page.js
import { Suspense } from 'react';
import SearchClient from './SearchClient';

export const metadata = {
  title: 'Search',
  description: 'Search for posts, people, and groups',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function SearchPage() {
  // SearchClient uses useSearchParams(), which requires a Suspense
  // boundary around it or Next.js can't prerender this route.
  return (
    <Suspense fallback={<div className="p-8 text-center text-[var(--color-txt2)]">Loading...</div>}>
      <SearchClient />
    </Suspense>
  );
}