'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import Link from 'next/link';
import { resolveMediaUrl } from '@/lib/url';
import AvatarPlaceholder from '@/components/ui/AvatarPlaceholder';

export default function CommentInput({ postId, onCommentAdd, showToast }) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) { showToast('Please log in to comment.', 'error'); return; }
    const trimmed = text.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      const res = await apiClient(`/api/posts/${postId}/comment`, {
        method: 'POST',
        body: { text: trimmed },
      });
      const newComment = res.data || res;
      onCommentAdd(newComment);
      setText('');
      showToast('Comment added!');
    } catch (err) {
      showToast(err.message || 'Failed to add comment.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full bg-[var(--color-card)] border border-[var(--color-border)] rounded-[var(--radius-radius)] p-4 mb-6">
      <form onSubmit={handleSubmit} className="flex items-center gap-2 sm:gap-3">
        {/* ─── Avatar ───────────────────────────────────────── */}
        {user?.picture ? (
          <img
            src={resolveMediaUrl(user.picture)}
            alt={user?.name}
            className="flex-shrink-0 h-9 w-9 rounded-full object-cover"
          />
        ) : (
          <AvatarPlaceholder size="h-9 w-9" />
        )}

        {/* ─── Input ───────────────────────────────────────── */}
        <input
          id="comment-input"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={user ? 'Write a comment…' : 'Log in to comment'}
          className="flex-1 min-w-0 bg-[var(--color-surface)] rounded-[var(--radius-radius-sm)] px-3 sm:px-4 py-2 text-sm text-[var(--color-txt)] placeholder:text-[var(--color-txt3)] border border-[var(--color-border)] focus:border-[var(--color-accent)] focus:outline-none"
          disabled={!user || submitting}
        />

        {/* ─── Send button ──────────────────────────────────── */}
        <button
          type="submit"
          disabled={!user || submitting || !text.trim()}
          className="flex-shrink-0 px-3 py-2 bg-[var(--color-accent)] text-white rounded-[var(--radius-radius-sm)] hover:bg-[var(--color-accent-h)] transition disabled:opacity-50 flex items-center justify-center"
          aria-label="Reply"
          title="Reply"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </button>
      </form>
      {!user && (
        <p className="text-xs text-[var(--color-txt3)] mt-2">
          <Link href="/login" className="text-[var(--color-accent)] hover:underline">
            Log in
          </Link>{' '}
          to join the conversation.
        </p>
      )}
    </div>
  );
}