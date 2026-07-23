// src/app/whisper/send/[slug]/WhisperSendClient.jsx
'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import Link from 'next/link';

function resolveMediaUrl(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'}${url}`;
}

// ── SVG Icons ──
const SearchIcon = () => (
  <svg className="w-12 h-12 mx-auto mb-4 text-[var(--color-txt3)]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const LockIcon = () => (
  <svg className="w-12 h-12 mx-auto mb-4 text-[var(--color-txt3)]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
);

const WhisperSentIcon = () => (
  <svg className="w-14 h-14 mx-auto mb-4 text-[var(--color-accent)]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    <path d="M8 10h.01M12 10h.01M16 10h.01" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const WhisperHeaderIcon = () => (
  <svg className="w-5 h-5 text-[var(--color-accent)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    <path d="M8 10h.01M12 10h.01M16 10h.01" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const SendButtonIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ShieldIcon = () => (
  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);

export default function WhisperSendClient({ slug }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await apiClient(`/api/whisper/profile-by-slug/${slug}`);
        setProfile(res.data || res);
      } catch (err) {
        setError(err.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [slug]);

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      await apiClient(`/api/whisper/send-by-slug/${slug}`, {
        method: 'POST',
        body: { message: message.trim() },
      });
      setSent(true);
    } catch (err) {
      alert(err.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-md mx-auto p-8 text-center text-[var(--color-txt2)]">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-accent)] border-t-transparent" />
        <p className="mt-4">Loading…</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-md mx-auto p-8 text-center text-[var(--color-txt2)]">
        <SearchIcon />
        <h2 className="text-lg font-semibold text-[var(--color-txt)]">User not found</h2>
        <p className="text-sm">This whisper link may be invalid or the account was deleted.</p>
      </div>
    );
  }

  if (!profile.whisperEnabled) {
    return (
      <div className="max-w-md mx-auto p-8 text-center text-[var(--color-txt2)]">
        <LockIcon />
        <h2 className="text-lg font-semibold text-[var(--color-txt)]">{profile.name || profile.username} isn't accepting messages</h2>
        <p className="text-sm">They've turned off anonymous messages for now.</p>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="max-w-md mx-auto p-8 text-center">
        <WhisperSentIcon />
        <h2 className="text-xl font-head font-extrabold text-[var(--color-txt)]">Message sent!</h2>
        <p className="text-sm text-[var(--color-txt2)] mt-2">
          {profile.name} will see it anonymously. Your identity is safe.
        </p>
        <button
          onClick={() => setSent(false)}
          className="mt-6 px-6 py-2 bg-[var(--color-accent)] text-white rounded-full font-bold hover:bg-[var(--color-accent-h)] transition"
        >
          Send another
        </button>
      </div>
    );
  }

  const avatarUrl = resolveMediaUrl(profile.avatar);
  const initial = (profile.name || profile.username).charAt(0).toUpperCase();

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-txt2)] bg-[var(--color-card)] border border-[var(--color-border)] px-3 py-1.5 rounded-full"
          title="Back to Circle"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Circle
        </Link>
        <span className="text-xl font-extrabold bg-gradient-to-r from-[var(--color-accent)] to-purple-400 bg-clip-text text-transparent flex items-center gap-1.5">
          <WhisperHeaderIcon />
          Whisper
        </span>
      </div>

      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-6 shadow-[var(--color-shadow)]">
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center text-white font-extrabold text-lg overflow-hidden"
            style={{ background: avatarUrl ? 'transparent' : 'var(--color-accent)' }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={initial} className="w-full h-full object-cover" />
            ) : (
              initial
            )}
          </div>
          <div>
            <div className="text-xs text-[var(--color-txt2)]">Send an anonymous message to</div>
            <div className="text-base font-extrabold text-[var(--color-txt)]">
              {profile.name || profile.username}
              <span className="font-medium text-[var(--color-txt2)] text-sm ml-1">@{profile.username}</span>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <textarea
            rows={5}
            maxLength={500}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write your anonymous message… be kind 💜"
            className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm text-[var(--color-txt)] placeholder:text-[var(--color-txt3)] resize-none outline-none focus:border-[var(--color-accent)] transition"
          />
          <div className="text-right text-xs text-[var(--color-txt3)] mt-1">
            {500 - message.length} left
          </div>
        </div>

        <button
          onClick={handleSend}
          disabled={sending || !message.trim()}
          className="w-full py-3 bg-[var(--color-accent)] text-white rounded-full font-bold text-sm hover:bg-[var(--color-accent-h)] transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {sending ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <>
              <SendButtonIcon />
              Send anonymously
            </>
          )}
        </button>

        <div className="flex items-center justify-center gap-2 mt-4 text-xs text-[var(--color-txt2)]">
          <ShieldIcon />
          Your identity is completely hidden from {profile.name || profile.username}
        </div>
      </div>
    </div>
  );
}