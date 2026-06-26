// src/components/live/LiveFeedStrip.jsx
'use client';

import { useEffect } from 'react';
import { useLive } from '@/contexts/LiveContext';

export default function LiveFeedStrip() {
  const { activeSessions, isLoadingSessions, loadActiveSessions, watchSession } = useLive();

  useEffect(() => {
    loadActiveSessions();
    // Refresh periodically
    const interval = setInterval(loadActiveSessions, 30000);
    return () => clearInterval(interval);
  }, []);

  if (isLoadingSessions && activeSessions.length === 0) return null;
  if (activeSessions.length === 0) return null;

  return (
    <div className="overflow-x-auto scrollbar-hide pb-2 -mx-1 px-1 mb-4">
      <div className="flex gap-3">
        {activeSessions.map((session) => (
          <div
            key={session.sessionId}
            className="flex-shrink-0 w-40 rounded-xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-card)] cursor-pointer hover:shadow-lg transition"
            onClick={() => watchSession(session.sessionId)}
          >
            <div className="relative h-24 bg-[var(--color-surface)] flex items-center justify-center">
              <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-[var(--color-rose)] text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                LIVE
              </div>
              <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-md text-white text-[10px] font-bold">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <span>{session.viewerCount || 0}</span>
              </div>
              <svg className="w-8 h-8 text-[var(--color-txt3)]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <div className="p-2">
              <div className="text-xs font-bold text-[var(--color-txt)] truncate">{session.broadcasterName || 'Unknown'}</div>
              <div className="text-[10px] text-[var(--color-txt2)] truncate">{session.title || 'Live stream'}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}