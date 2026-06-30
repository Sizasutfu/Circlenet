// src/components/ui/LikeButton.jsx
'use client';

export default function LikeButton({ count = 0, active = false, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-1 transition hover:text-[var(--color-rose)] ${
        active ? 'text-[var(--color-rose)]' : ''
      }`}
    >
      <svg
        className="w-4 h-4"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
      </svg>
      <span>{count}</span>
    </button>
  );
}