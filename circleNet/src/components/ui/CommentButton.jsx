// src/components/ui/CommentButton.jsx
'use client';

export default function CommentButton({ count = 0, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 transition hover:text-[var(--color-accent)]"
      title="Comment"
    >
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
      <span>{count}</span>
    </button>
  );
}