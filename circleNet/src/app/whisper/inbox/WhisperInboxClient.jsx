// src/app/whisper/inbox/WhisperInboxClient.jsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useWhisper } from '@/contexts/WhisperContext';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { generateWhisperCard } from '@/lib/whisperCard';
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
    regenerateSlug,
  } = useWhisper();

  const [replyTarget, setReplyTarget] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [slugLoading, setSlugLoading] = useState(true);

  // ── Fetch settings and slug ──
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      await fetchSettings();
      setSlugLoading(false);
    };
    load();
  }, [user, fetchSettings]);

  // ── Auth check and initial inbox load ──
  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    fetchInbox();
  }, [user, fetchInbox, router]);

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

  const handleRegenerateSlug = async () => {
    if (!confirm('This will generate a new link for your Whisper page. Your old link will stop working. Continue?')) return;
    try {
      await regenerateSlug();
      alert('New link generated! 🔗');
    } catch {
      alert('Failed to generate new link.');
    }
  };

  // ── Download Whisper Card ──
  const handleDownloadWhisper = async (msg) => {
    try {
      const canvas = await generateWhisperCard(msg.message, user.username);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `whisper-${msg.id}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading whisper:', err);
      alert('Failed to download image.');
    }
  };

  // ── Share Whisper Card ──
  const handleShareWhisper = async (msg) => {
    try {
      const canvas = await generateWhisperCard(msg.message, user.username);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const file = new File([blob], `whisper-${msg.id}.png`, { type: 'image/png' });

      if (navigator.share) {
        await navigator.share({
          title: 'Whisper card',
          files: [file],
        });
      } else {
        await handleDownloadWhisper(msg);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error sharing whisper:', err);
        alert('Failed to share image.');
      }
    }
  };

  if (!user) return null;

  const publicLink = `${window.location.origin}/whisper/send/${settings.link_slug || ''}`;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-head font-extrabold text-[var(--color-txt)] flex items-center gap-2">
            <svg className="w-7 h-7 text-[var(--color-accent)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              <circle cx="9" cy="10" r="1" fill="currentColor" stroke="none" />
              <circle cx="12" cy="10" r="1" fill="currentColor" stroke="none" />
              <circle cx="15" cy="10" r="1" fill="currentColor" stroke="none" />
            </svg>
            Whisper Inbox
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
          ) : settings.link_slug ? (
            <div className="text-sm font-mono text-[var(--color-accent)] break-all">{publicLink}</div>
          ) : (
            <div className="text-sm text-[var(--color-txt2)]">No link generated yet.</div>
          )}
        </div>
        <div className="flex gap-2">
          {settings.link_slug && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(publicLink);
                alert('Link copied! 🔗');
              }}
              className="px-4 py-2 bg-[var(--color-accent-bg)] text-[var(--color-accent)] rounded-full text-sm font-bold hover:bg-[var(--color-accent)]/20 transition"
            >
              <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
              </svg>
              Copy link
            </button>
          )}
          <button
            onClick={handleRegenerateSlug}
            className="flex items-center gap-1.5 px-4 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-txt2)] rounded-full text-sm font-bold hover:bg-[var(--color-accent-bg)] transition"
            title="Generate a new unique link"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M23 4v6h-6" />
              <path d="M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            New link
          </button>
        </div>
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
            <svg className="w-16 h-16 mx-auto mb-4 text-[var(--color-txt3)]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              <circle cx="9" cy="10" r="1.5" fill="currentColor" stroke="none" />
              <circle cx="12" cy="10" r="1.5" fill="currentColor" stroke="none" />
              <circle cx="15" cy="10" r="1.5" fill="currentColor" stroke="none" />
            </svg>
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
                    <span className="hidden sm:inline">Reply & Post</span>
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

                <button
                  onClick={() => handleDownloadWhisper(msg)}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full text-xs font-bold hover:bg-[var(--color-accent-bg)] transition"
                  title="Download whisper card"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
                  </svg>
                  <span className="hidden sm:inline">Download</span>
                </button>

                <button
                  onClick={() => handleShareWhisper(msg)}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full text-xs font-bold hover:bg-[var(--color-accent-bg)] transition"
                  title="Share whisper card to other apps"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                  </svg>
                  <span className="hidden sm:inline">Share</span>
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