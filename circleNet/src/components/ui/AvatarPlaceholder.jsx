// src/components/ui/AvatarPlaceholder.jsx
'use client';

export default function AvatarPlaceholder({ size = 'w-12 h-12', className = '' }) {
  return (
    <div
      className={`flex-shrink-0 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center ${size} ${className}`}
    >
      <svg
        className="w-1/2 h-1/2 text-[var(--color-txt3)]"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    </div>
  );
}