// src/components/layout/Footer.jsx
'use client';

import Link from 'next/link';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-[var(--color-border)] mt-12 py-8 text-[var(--color-txt3)] text-sm">
      <div className="max-w-screen-lg mx-auto px-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-[var(--color-txt)]">CircleNet</p>
          <p>© {year} CircleNet. All rights reserved.</p>
        </div>

        <div className="flex flex-wrap justify-center gap-4 text-sm">
          <Link href="/about" className="hover:text-[var(--color-accent)] transition-colors">
            About
          </Link>
          <Link href="/privacy-policy" className="hover:text-[var(--color-accent)] transition-colors">
            Privacy Policy
          </Link>
          <Link href="/contact" className="hover:text-[var(--color-accent)] transition-colors">
            Contact
          </Link>
        </div>
      </div>
    </footer>
  );
}