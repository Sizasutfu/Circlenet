// src/app/whisper/inbox/WhisperInboxClient.jsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useWhisper } from '@/contexts/WhisperContext';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import WhisperReplyModal from '@/components/whisper/WhisperReplyModal';

function relativeTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function WhisperInboxClient() {
  const { user } = useAuth();
  const router = useRouter();
  const {
    messages,
    loading,
    hasMore,
    fetchInbox,
    deleteMessage,
    reportMessage,
    settings,
    fetchSettings,
    updateSettings,
  } = useWhisper();

  const [replyTarget, setReplyTarget] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [whisperSlug, setWhisperSlug] = useState(null);
  const [slugLoading, setSlugLoading] = useState(true);

  // ── Fetch the username (or link_slug) for the public link ──
  useEffect(() => {
    if (!user) return;

    const fetchSlug = async () => {
      try {
        if (settings?.link_slug) {
          setWhisperSlug(settings.link_slug);
          setSlugLoading(false);
          return;
        }
        if (user.username) {
          setWhisperSlug(user.username);
          setSlugLoading(false);
          return;
        }
        const res = await apiClient(`/api/users/${user.id}/profile`);
        const profile = res.data || res;
        if (profile.username) {
          setWhisperSlug(profile.username);
        } else {
          setWhisperSlug(user.name || 'user');
        }
        setSlugLoading(false);
      } catch (err) {
        console.warn('Failed to fetch whisper slug:', err);
        setWhisperSlug(user.username || user.name || 'user');
        setSlugLoading(false);
      }
    };

    fetchSlug();
  }, [user, settings]);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    fetchSettings();
    fetchInbox();
  }, [user]);

  const handleDelete = async (id) => {
    if (!confirm('Delete this message? This cannot be undone.')) return;
    await deleteMessage(id);
  };

  const handleReport = async (id) => {
    await reportMessage(id);
    alert('Reported – thanks for keeping Circle safe 🛡️');
  };

  const loadMore = () => {
    if (hasMore && !loading) {
      fetchInbox(cursor);
    }
  };

  if (!user) return null;

  const publicLink = `${window.location.origin}/whisper/send/${whisperSlug || 'user'}`;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-head font-extrabold text-[var(--color-txt)]">
            💬 Whisper Inbox
          </h1>
          <p className="text-sm text-[var(--color-txt2)]">Anonymous messages from your audience</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-[var(--color-txt2)]">Accepting</span>
          <button
            onClick={async () => {
              const next = !settings.enabled;
              await updateSettings(next);
            }}
            className={`relative w-11 h-6 rounded-full transition-colors ${settings.enabled ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border2)]'}`}
          >
            <div
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all shadow ${settings.enabled ? 'left-[22px]' : 'left-0.5'}`}
            />
          </button>
        </div>
      </div>

      {/* Public link */}
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-4 mb-6 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] font-bold text-[var(--color-txt3)] uppercase tracking-wider">Your Whisper link</div>
          {slugLoading ? (
            <div className="text-sm font-mono text-[var(--color-txt2)] animate-pulse">Loading…</div>
          ) : (
            <div className="text-sm font-mono text-[var(--color-accent)] break-all">{publicLink}</div>
          )}
        </div>
        <button
          onClick={() => {
            if (whisperSlug) {
              navigator.clipboard.writeText(publicLink);
              alert('Link copied! 🔗');
            }
          }}
          disabled={!whisperSlug}
          className="px-4 py-2 bg-[var(--color-accent-bg)] text-[var(--color-accent)] rounded-full text-sm font-bold hover:bg-[var(--color-accent)]/20 transition disabled:opacity-50"
        >
          Copy link
        </button>
      </div>

      {/* Messages */}
      <div className="space-y-3">
        {loading && messages.length === 0 ? (
          <div className="text-center py-12 text-[var(--color-txt2)]">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-accent)] border-t-transparent" />
            <p className="mt-4">Loading whispers…</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-16 text-[var(--color-txt2)]">
            <div className="text-5xl mb-4">💬</div>
            <p className="text-lg font-semibold text-[var(--color-txt)]">No whispers yet</p>
            <p className="text-sm">Share your link and let people send you anonymous messages.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-4 border-l-4 border-l-[var(--color-accent)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-accent)] bg-[var(--color-accent-bg)] px-3 py-1 rounded-full">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      Anonymous
                    </span>
                    <span className="text-xs text-[var(--color-txt3)]">{relativeTime(msg.created_at)}</span>
                    {msg.posted && (
                      <span className="text-xs text-[var(--color-green)]">✓ Posted</span>
                    )}
                  </div>
                  <div className="text-[var(--color-txt)] text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {msg.message}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 mt-3">
                {!msg.posted && (
                  <button
                    onClick={() => setReplyTarget(msg)}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-[var(--color-accent)] text-white rounded-full text-xs font-bold hover:bg-[var(--color-accent-h)] transition"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                    Reply & Post
                  </button>
                )}
                <button
                  onClick={() => handleDelete(msg.id)}
                  className="p-2 text-[var(--color-txt3)] hover:text-[var(--color-rose)] transition rounded-full"
                  title="Delete"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4h6v2" />
                  </svg>
                </button>
                <button
                  onClick={() => handleReport(msg.id)}
                  className="p-2 text-[var(--color-txt3)] hover:text-[var(--color-rose)] transition rounded-full"
                  title="Report"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}

        {hasMore && (
          <button
            onClick={loadMore}
            disabled={loading}
            className="w-full py-3 text-sm font-medium text-[var(--color-txt2)] hover:text-[var(--color-accent)] transition border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)]"
          >
            {loading ? 'Loading…' : 'Load more'}
          </button>
        )}
      </div>

      {/* Reply Modal */}
      {replyTarget && (
        <WhisperReplyModal
          message={replyTarget}
          onClose={() => setReplyTarget(null)}
          onPosted={() => setReplyTarget(null)}
        />
      )}
    </div>
  );
}