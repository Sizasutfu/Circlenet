'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import Link from 'next/link';
import { resolveMediaUrl, stringToColor } from './utils';

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
    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-[var(--radius-radius)] p-4 mb-6">
      <form onSubmit={handleSubmit} className="flex gap-3">
        <div
          className="flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center text-white font-bold text-sm overflow-hidden"
          style={{
            background: user?.picture ? 'transparent' : stringToColor(user?.name || ''),
          }}
        >
          {user?.picture ? (
            <img src={resolveMediaUrl(user.picture)} alt={user?.name} className="w-full h-full rounded-full object-cover" />
          ) : (
            user?.name?.charAt(0)?.toUpperCase() || '?'
          )}
        </div>
        <input
          id="comment-input"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={user ? 'Write a comment…' : 'Log in to comment'}
          className="flex-1 bg-[var(--color-surface)] rounded-[var(--radius-radius-sm)] px-4 py-2 text-sm text-[var(--color-txt)] placeholder:text-[var(--color-txt3)] border border-[var(--color-border)] focus:border-[var(--color-accent)] focus:outline-none"
          disabled={!user || submitting}
        />
        <button
          type="submit"
          disabled={!user || submitting || !text.trim()}
          className="px-3 py-1.5 bg-[var(--color-accent)] text-white rounded-[var(--radius-radius-sm)] hover:bg-[var(--color-accent-h)] transition disabled:opacity-50 flex items-center justify-center"
          aria-label="Reply"
          title="Reply"
        >
          <svg
            className="w-4 h-4"
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