// src/components/live/LiveSetupModal.jsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useLive } from '@/contexts/LiveContext';

export default function LiveSetupModal() {
  const { isSetupOpen, closeSetup, startLive, localStream } = useLive();
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
        <div className="w-full h-48 rounded-xl bg-black/60 overflow-hidden relative mb-4">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover scale-x-[-1]"
          />
        </div>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What's happening? (e.g. Studio session, Q&A…)"
          maxLength={80}
          className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm text-[var(--color-txt)] placeholder:text-[var(--color-txt3)] focus:border-[var(--color-accent)] outline-none transition mb-4"
        />
        <button
          onClick={handleStart}
          disabled={isStarting || !title.trim()}
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
        <button onClick={closeSetup} className="w-full mt-2 py-2 text-sm text-[var(--color-txt2)] hover:text-[var(--color-txt)] transition text-center">
          Cancel
        </button>
      </div>
    </div>
  );
}