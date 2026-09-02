import { Suspense } from 'react';
import Link from 'next/link';

function NotFoundContent() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg text-txt px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-accent mb-4">404</h1>
        <h2 className="text-2xl font-semibold mb-2">Page Not Found</h2>
        <p className="text-txt2 mb-8">Sorry, the page you're looking for doesn't exist.</p>
        <Link
          href="/feed"
          className="inline-flex items-center justify-center px-6 py-3 bg-accent text-white font-semibold rounded-lg hover:bg-accent-h transition-colors"
        >
          Back to Feed
        </Link>
      </div>
    </div>
  );
}

export default function NotFound() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <NotFoundContent />
    </Suspense>
  );
}