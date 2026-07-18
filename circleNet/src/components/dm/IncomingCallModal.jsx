// src/components/dm/IncomingCallModal.jsx
'use client';

import { useDmCall } from '@/contexts/DmCallContext';

// ─── Uniform avatar placeholder ──────────────────────────────────────────
function AvatarPlaceholder({ size = 'w-20 h-20', className = '' }) {
  return (
    <div
      className={`flex-shrink-0 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center ${size} ${className}`}
    >
      <svg
        className="w-1/2 h-1/2 text-[var(--color-txt3)]"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    </div>
  );
}

export default function IncomingCallModal() {
  const { callState, acceptIncoming, rejectIncoming } = useDmCall();
  const { isIncoming, callerName, callerAvatar } = callState;

  if (!isIncoming) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
        <div className="flex flex-col items-center">
          {callerAvatar ? (
            <img
              src={callerAvatar}
              alt=""
              className="w-20 h-20 rounded-full border-2 border-[var(--color-accent)] object-cover"
            />
          ) : (
            <AvatarPlaceholder size="w-20 h-20" />
          )}
          <h3 className="text-xl font-head font-bold text-[var(--color-txt)] mt-3">{callerName || 'Unknown'}</h3>
          <p className="text-sm text-[var(--color-txt2)]">Incoming video call…</p>
          <div className="flex gap-4 mt-4">
            <button
              onClick={rejectIncoming}
              className="px-6 py-3 bg-[var(--color-rose)] text-white rounded-full font-bold hover:bg-[var(--color-rose)]/80 transition"
              title="Decline call"
            >
              Decline
            </button>
            <button
              onClick={acceptIncoming}
              className="px-6 py-3 bg-[var(--color-green)] text-white rounded-full font-bold hover:bg-[var(--color-green)]/80 transition"
              title="Accept call"
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}