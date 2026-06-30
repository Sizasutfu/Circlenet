// src/components/ui/RepostButton.jsx
'use client';

export default function RepostButton({ count = 0, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 transition hover:text-[var(--color-green)]"
    >
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path d="M17 1l4 4-4 4" />
        <path d="M3 11V9a4 4 0 014-4h14" />
        <path d="M7 23l-4-4 4-4" />
        <path d="M21 13v2a4 4 0 01-4 4H3" />
      </svg>
      <span>{count}</span>
    </button>
  );
}