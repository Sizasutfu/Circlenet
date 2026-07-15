// src/components/live/LiveSetupModal.jsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useLive } from '@/contexts/LiveContext';

export default function LiveSetupModal() {
  const {
    isSetupOpen,
    closeSetup,
    startLive,
    localStream,
    setupError,
    openSetup,
    collaborationEnabled,
    setCollaborationEnabled,
  } = useLive();

  const [title, setTitle] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream;
      videoRef.current.play().catch(() => {});
    }
  }, [localStream]);

  const handleStart = async () => {
    if (!title.trim()) return;
    setIsStarting(true);
    await startLive(title.trim());
    setIsStarting(false);
  };

  if (!isSetupOpen) return null;

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h2 className="text-xl font-head font-extrabold text-[var(--color-txt)]">Go Live</h2>
        <p className="text-sm text-[var(--color-txt2)] mb-4">Share a live moment with your Circle.</p>

        {/* Video preview */}
        <div className="w-full h-48 rounded-xl bg-black/60 overflow-hidden relative mb-4">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover scale-x-[-1]"
          />
        </div>

        {/* Title input */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What's happening? (e.g. Studio session, Q&A…)"
          maxLength={80}
          className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm text-[var(--color-txt)] placeholder:text-[var(--color-txt3)] focus:border-[var(--color-accent)] outline-none transition mb-3"
        />

        {/* Collaboration toggle */}
        <div className="flex items-center gap-3 mb-4">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={collaborationEnabled}
              onChange={(e) => setCollaborationEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-[var(--color-border)] rounded-full peer peer-checked:bg-[var(--color-accent)] transition-colors">
              <div className={`w-4 h-4 bg-white rounded-full absolute top-1 left-1 transition-transform ${collaborationEnabled ? 'translate-x-5' : ''}`}></div>
            </div>
          </label>
          <span className="text-sm text-[var(--color-txt2)]">
            Enable collaboration (up to 4 broadcasters)
          </span>
        </div>

        {/* Error message with Retry button */}
        {setupError && (
          <div className="text-sm text-[var(--color-rose)] bg-[var(--color-rose-bg)] p-3 rounded mb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <span className="flex-1">{setupError}</span>
            <button
              onClick={() => {
                closeSetup();
                setTimeout(() => openSetup(), 300);
              }}
              className="px-3 py-1 bg-[var(--color-accent)] text-white rounded-full text-xs font-medium hover:bg-[var(--color-accent-h)] transition whitespace-nowrap"
            >
              Retry
            </button>
          </div>
        )}

        {/* Start button */}
        <button
          onClick={handleStart}
          disabled={isStarting || !title.trim() || !!setupError}
          className="w-full py-3 bg-[var(--color-rose)] text-white rounded-xl font-extrabold text-sm hover:bg-[var(--color-rose)]/80 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isStarting ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="3" fill="currentColor" />
              </svg>
              Go Live
            </>
          )}
        </button>

        {/* Cancel */}
        <button
          onClick={closeSetup}
          className="w-full mt-2 py-2 text-sm text-[var(--color-txt2)] hover:text-[var(--color-txt)] transition text-center"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}