'use client'; // needed for the back button (history)
import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ThemeToggle from '../ThemeToggle';

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isHomePage = pathname === '/' || pathname === '/articles';
  const [query, setQuery] = useState('');

  useEffect(() => {
    setQuery(searchParams.get('search') || '');
  }, [searchParams]);

  const goBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/articles');
    }
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const trimmed = query.trim();
    const destination = trimmed ? `/articles?search=${encodeURIComponent(trimmed)}` : '/articles';
    router.push(destination);
  };

  return (
    <header className="sticky top-0 z-50 bg-surface/85 backdrop-blur-lg border-b border-border px-4 sm:px-6 h-14 flex items-center gap-4">
      {!isHomePage && (
        <button
          onClick={goBack}
          className="inline-flex items-center justify-center text-txt2 text-sm font-semibold p-2 rounded-radius-sm border border-border bg-transparent hover:text-accent hover:border-accent hover:bg-accent-bg transition-all"
          aria-label="Go back"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="w-4 h-4"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      )}
      <Link
        href="/articles"
        className="flex items-center gap-2 font-head text-lg font-extrabold text-txt tracking-tight"
      >
        <div className="w-7 h-7 bg-accent rounded-lg grid place-items-center shadow-accent-glow">
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-white">
            <circle cx="12" cy="12" r="9" />
          </svg>
        </div>
        Circle
      </Link>
      <form
        onSubmit={handleSearchSubmit}
        className="flex flex-1 min-w-0 w-full max-w-full md:max-w-xl items-center rounded-radius-sm border border-border bg-card px-3 py-1.5"
      >
        <div className="relative flex-1 min-w-0">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-txt2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search articles"
            className="w-full bg-transparent pl-10 pr-3 text-sm text-txt placeholder:text-txt2 outline-none"
          />
        </div>
        <button
          type="submit"
          className="ml-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-white transition hover:bg-accent-h"
          aria-label="Search articles"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="h-5 w-5"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </button>
      </form>
      <ThemeToggle />
    </header>
  );
}