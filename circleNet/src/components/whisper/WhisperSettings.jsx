// src/components/whisper/WhisperSettings.jsx
'use client';

import { useEffect } from 'react';
import { useWhisper } from '@/contexts/WhisperContext';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';

export default function WhisperSettings() {
  const { user } = useAuth();
  const { settings, fetchSettings, updateSettings } = useWhisper();

  useEffect(() => {
    if (user) fetchSettings();
  }, [user]);

  if (!user) return null;

  const publicLink = `${window.location.origin}/whisper/send/${user.username}`;

  const handleToggle = async () => {
    await updateSettings(!settings.enabled);
  };

  return (
    <div className="settings-section border-t border-[var(--color-border)] pt-6 mt-6">
      <div className="settings-section-title font-head text-lg font-bold text-[var(--color-txt)] mb-3">
        💬 Whisper
      </div>

      <div className="settings-row flex items-center gap-4 py-3 border-b border-[var(--color-border)]">
        <div className="settings-row-icon w-9 h-9 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </div>
        <div className="settings-row-body flex-1">
          <div className="settings-row-title font-semibold text-[var(--color-txt)]">Accept anonymous messages</div>
          <div className="settings-row-sub text-sm text-[var(--color-txt2)]">
            Anyone with your link can send you a message anonymously
          </div>
        </div>
        <div className="settings-row-end">
          <button
            onClick={handleToggle}
            className={`relative w-11 h-6 rounded-full transition-colors ${settings.enabled ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border2)]'}`}
          >
            <div
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all shadow ${settings.enabled ? 'left-[22px]' : 'left-0.5'}`}
            />
          </button>
        </div>
      </div>

      {settings.enabled && (
        <div className="settings-row p-4 bg-[var(--color-surface)] rounded-xl mt-3">
          <div className="flex items-center justify-between gap-3 flex-wrap w-full">
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-[var(--color-txt3)] uppercase tracking-wider">Your Whisper link</div>
              <div className="text-sm font-mono text-[var(--color-accent)] truncate">{publicLink}</div>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(publicLink);
                alert('Link copied! 🔗');
              }}
              className="px-4 py-1.5 bg-[var(--color-accent-bg)] text-[var(--color-accent)] rounded-full text-xs font-bold hover:bg-[var(--color-accent)]/20 transition flex-shrink-0"
            >
              Copy
            </button>
          </div>
        </div>
      )}

      <Link
        href="/whisper/inbox"
        className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-[var(--color-txt2)] hover:text-[var(--color-accent)] transition"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M22 17H2a3 3 0 01-3-3V7a3 3 0 013-3h18a3 3 0 013 3v7a3 3 0 01-3 3z" />
          <polyline points="22 7 12 13 2 7" />
        </svg>
        View past messages
      </Link>
    </div>
  );
}