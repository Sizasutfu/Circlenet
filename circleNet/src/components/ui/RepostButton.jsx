// src/components/ui/RepostButton.jsx
'use client';

export default function RepostButton({ count = 0, active = false, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 transition ${
        active 
          ? 'text-green-500 hover:text-green-600' 
          : 'text-[var(--color-txt2)] hover:text-[var(--color-green)]'
      }`}
      title={active ? "Undo repost" : "Repost"}
    >
      <svg
        className={`w-4 h-4 transition ${
          active ? 'fill-green-500' : 'fill-none'
        }`}
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path d="M17 1l4 4-4 4" />
        <path d="M3 11V9a4 4 0 014-4h14" />
        <path d="M7 23l-4-4 4-4" />
        <path d="M21 13v2a4 4 0 01-4 4H3" />
      </svg>
      {count > 0 && <span>{count}</span>}
    </button>
  );
}