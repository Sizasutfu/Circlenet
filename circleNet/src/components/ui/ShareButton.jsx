// src/components/ui/ShareButton.jsx
'use client';

export default function ShareButton({ count = 0, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 transition hover:text-[var(--color-accent)]"
    >
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
      <span>{count}</span>
    </button>
  );
}