// src/components/ui/RepostButton.jsx
'use client';

import { useState, useEffect } from 'react';

export default function RepostButton({ 
  count = 0, 
  active = false, 
  onClick,
  postId,
  isLoading = false,
}) {
  const [localCount, setLocalCount] = useState(count);
  const [localActive, setLocalActive] = useState(active);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    setLocalCount(count);
    setLocalActive(active);
  }, [count, active]);

  const handleClick = async (e) => {
    e.stopPropagation();
    
    if (isUpdating || isLoading) return;
    
    setIsUpdating(true);
    
    try {
      await onClick?.();
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isUpdating || isLoading}
      className={`flex items-center gap-1 transition dm-engagement-btn ${
        localActive 
          ? 'text-green-500 hover:text-green-600' 
          : 'text-[var(--color-txt2)] hover:text-[var(--color-green)]'
      } ${isUpdating ? 'opacity-50 cursor-wait' : ''}`}
      title={localActive ? "Undo repost" : "Repost"}
    >
      <svg
        className={`w-4 h-4 transition ${isUpdating ? 'animate-pulse' : ''}`}
        fill={localActive ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path d="M17 1l4 4-4 4" />
        <path d="M3 11V9a4 4 0 014-4h14" />
        <path d="M7 23l-4-4 4-4" />
        <path d="M21 13v2a4 4 0 01-4 4H3" />
      </svg>
      {localCount > 0 && <span className="min-w-[1ch]">{localCount}</span>}
      {isUpdating && (
        <span className="text-[10px] text-[var(--color-txt3)] animate-pulse">...</span>
      )}
    </button>
  );
}