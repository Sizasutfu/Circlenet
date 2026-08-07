// src/components/notification/MentionBadge.jsx
'use client';

import { useNotifications } from '@/contexts/NotificationContext';
import Link from 'next/link';

export default function MentionBadge() {
  const { mentionCount, openPanel } = useNotifications();

  if (mentionCount === 0) return null;

  return (
    <button
      onClick={openPanel}
      className="relative flex items-center gap-1 text-[var(--color-accent)] hover:text-[var(--color-accent-h)] transition"
      title={`${mentionCount} unread mention${mentionCount > 1 ? 's' : ''}`}
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="4"/>
        <path d="M16 8v5a3 3 0 006 0v-1a10 10 0 10-3.92 7.94"/>
      </svg>
      <span className="absolute -top-1 -right-2 text-[10px] font-bold bg-[var(--color-rose)] text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
        {mentionCount > 99 ? '99+' : mentionCount}
      </span>
    </button>
  );
}