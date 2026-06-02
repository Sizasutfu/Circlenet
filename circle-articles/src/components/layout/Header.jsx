export default function Header() {
  return (
    <header>
      <div className="container">
        <a href="/">Circle Blog</a>
      </div>
    </header>
  )
}
'use client'; // needed for the back button (history)
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Header() {
  const router = useRouter();

  const goBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/articles');
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-surface/85 backdrop-blur-lg border-b border-border px-4 sm:px-6 h-14 flex items-center gap-4">
      <button
        onClick={goBack}
        className="flex items-center gap-2 text-txt2 text-sm font-semibold px-3 py-1.5 rounded-radius-sm border border-border bg-card hover:text-accent hover:border-accent hover:bg-accent-bg transition-all"
      >
        <svg
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          viewBox="0 0 24 24"
          className="w-4 h-4"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back
      </button>
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
      <div className="flex-1" />
    </header>
  );
}