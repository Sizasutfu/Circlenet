// src/components/layout/Header.jsx
'use client';

import { Suspense, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ThemeToggle from '../ThemeToggle';
import { useAuth } from '@/lib/auth';

// Isolated on its own: useSearchParams() forces whatever calls it to be
// wrapped in <Suspense>, or Next.js can't statically prerender the page
// it's rendered on. Keeping it in its own leaf component (instead of at
// the top of Header) means only this tiny piece needs the boundary —
// the rest of the header still renders without waiting on it.
function SearchParamsSync({ pathname, onPlaceholderChange, onQueryChange }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const getSearchContext = () => {
      if (pathname.startsWith('/groups')) return 'Search groups...';
      if (pathname.startsWith('/articles')) return 'Search articles...';
      if (pathname.startsWith('/search')) {
        const type = searchParams.get('type');
        if (type === 'people') return 'Search people...';
        if (type === 'groups') return 'Search groups...';
        return 'Search posts...';
      }
      return 'Search posts...';
    };
    onPlaceholderChange(getSearchContext());
  }, [pathname, searchParams, onPlaceholderChange]);

  useEffect(() => {
    onQueryChange(searchParams.get('q') || '');
  }, [searchParams, onQueryChange]);

  return null;
}

export default function Header({ onMenuClick }) {
  const router = useRouter();
  const pathname = usePathname();
  const isHomePage = pathname === '/' || pathname === '/articles';
  const { user, logout } = useAuth();

  const [query, setQuery] = useState('');
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [placeholder, setPlaceholder] = useState('Search...');

  const goBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/articles');
    }
  };

  const handleSearchSubmit = async (event) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    const type = pathname.startsWith('/groups') ? 'groups' : 'posts';
    router.push(`/search?q=${encodeURIComponent(trimmed)}&type=${type}`);
    setShowMobileSearch(false);
  };

  const toggleMobileSearch = () => {
    setShowMobileSearch((current) => !current);
  };

  return (
    <>
      <Suspense fallback={null}>
        <SearchParamsSync
          pathname={pathname}
          onPlaceholderChange={setPlaceholder}
          onQueryChange={setQuery}
        />
      </Suspense>

      <header className="sticky top-0 left-0 right-0 z-40 bg-[var(--color-surface)]/85 backdrop-blur-lg border-b border-[var(--color-border)] w-full h-14 flex items-center">
        {/* Left: hamburger + back (no logo) */}
        <div className="flex-1 flex items-center gap-3 min-w-0 px-4 sm:px-6">
          <button
            onClick={onMenuClick}
            className="inline-flex items-center justify-center text-[var(--color-txt2)] p-2 rounded-lg hover:bg-[var(--color-accent-bg)] hover:text-[var(--color-accent)] transition"
            aria-label="Toggle navigation"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          {!isHomePage && (
            <button
              onClick={goBack}
              className="inline-flex items-center justify-center text-[var(--color-txt2)] text-sm font-semibold p-2 rounded-[var(--radius-radius-sm)] border border-[var(--color-border)] bg-transparent hover:text-[var(--color-accent)] hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-bg)] transition-all"
              aria-label="Go back"
              title="Back"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          )}
        </div>

        {/* Center: only the text "Circlenet" – hidden on md+ screens */}
        <div className="flex-1 flex items-center justify-center md:hidden">
          <Link
            href="/feed"
            className="font-head text-lg font-extrabold text-[var(--color-txt)] tracking-tight"
          >
            Circlenet
          </Link>
        </div>

        {/* Right: search + theme */}
        <div className="flex-1 flex items-center justify-end gap-2 min-w-0 px-4 sm:px-6">
          <form
            onSubmit={handleSearchSubmit}
            className="hidden md:flex flex-1 min-w-0 items-center rounded-[var(--radius-radius-sm)] border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5"
          >
            <div className="relative flex-1 min-w-0">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-txt2)]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-transparent pl-10 pr-3 text-sm text-[var(--color-txt)] placeholder:text-[var(--color-txt2)] outline-none"
              />
            </div>
            <button type="submit" className="ml-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-accent)] text-white transition hover:bg-[var(--color-accent-h)]" aria-label="Search">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </button>
          </form>

          <button
            type="button"
            onClick={toggleMobileSearch}
            className="inline-flex md:hidden h-10 w-10 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-txt2)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
            aria-label={showMobileSearch ? 'Close search' : 'Open search'}
            aria-expanded={showMobileSearch}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </button>

          <ThemeToggle />
        </div>
      </header>

      {/* Mobile search dropdown */}
      {showMobileSearch && (
        <div className="md:hidden bg-[var(--color-surface)]/95 border-b border-[var(--color-border)] px-4 sm:px-6 pb-3">
          <form onSubmit={handleSearchSubmit} className="flex items-center rounded-[var(--radius-radius-sm)] border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5">
            <div className="relative flex-1 min-w-0">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-txt2)]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-transparent pl-10 pr-3 text-sm text-[var(--color-txt)] placeholder:text-[var(--color-txt2)] outline-none"
                autoFocus
              />
            </div>
            <button type="submit" className="ml-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-accent)] text-white transition hover:bg-[var(--color-accent-h)]" aria-label="Search">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}