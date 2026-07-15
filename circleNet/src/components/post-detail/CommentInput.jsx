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
          className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-[var(--radius-radius-sm)] text-sm font-medium hover:bg-[var(--color-accent-h)] transition disabled:opacity-50"
        >
          {submitting ? '…' : 'Reply'}
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