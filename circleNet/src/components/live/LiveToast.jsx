// src/components/live/LiveToast.jsx
'use client';

import { useState, useEffect } from 'react';
import { useLive } from '@/contexts/LiveContext';

export default function LiveToast() {
  const { activeSessions, watchSession } = useLive();
  const [shownSessions, setShownSessions] = useState(new Set());
  const [toast, setToast] = useState(null);

  useEffect(() => {
    // Check for new sessions (not previously shown)
    activeSessions.forEach((session) => {
      if (!shownSessions.has(session.sessionId)) {
        setShownSessions((prev) => new Set(prev).add(session.sessionId));
        // Show toast for this session
        setToast(session);
        // Auto-hide after 5 seconds
        setTimeout(() => setToast(null), 5000);
      }
    });
  }, [activeSessions]);

  if (!toast) return null;

  return (
    <div
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[900] bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl px-4 py-3 flex items-center gap-3 shadow-xl cursor-pointer hover:bg-[var(--color-surface)] transition animate-fadeUp"
      onClick={() => {
        watchSession(toast.sessionId);
        setToast(null);
      }}
    >
      {toast.broadcasterAvatar ? (
        <img src={toast.broadcasterAvatar} alt="" className="w-8 h-8 rounded-full border-2 border-[var(--color-rose)] object-cover" />
      ) : (
        <div className="w-8 h-8 rounded-full border-2 border-[var(--color-rose)] bg-[var(--color-surface)]" />
      )}
      <div>
        <div className="text-sm text-[var(--color-txt)]">
          <strong>{toast.broadcasterName || 'Someone'}</strong> just went live
        </div>
      </div>
      <span className="flex items-center gap-1 bg-[var(--color-rose)] text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md">
        <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
        LIVE
      </span>
    </div>
  );
}