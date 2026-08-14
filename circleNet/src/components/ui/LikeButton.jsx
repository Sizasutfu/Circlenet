// src/components/ui/LikeButton.jsx
'use client';

import { useState, useEffect } from 'react';

export default function LikeButton({ 
  count = 0, 
  active = false, 
  onToggle,
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
      await onToggle?.();
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isUpdating || isLoading}
      className={`flex items-center gap-1 transition dm-engagement-btn ${
        localActive ? 'text-[var(--color-rose)]' : 'text-[var(--color-txt2)] hover:text-[var(--color-rose)]'
      } ${isUpdating ? 'opacity-50 cursor-wait' : ''}`}
      title="Like"
    >
      <svg
        className={`w-4 h-4 ${isUpdating ? 'animate-pulse' : ''}`}
        fill={localActive ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
      </svg>
      {localCount > 0 && <span className="min-w-[1ch]">{localCount}</span>}
      {isUpdating && (
        <span className="text-[10px] text-[var(--color-txt3)] animate-pulse">...</span>
      )}
    </button>
  );
}