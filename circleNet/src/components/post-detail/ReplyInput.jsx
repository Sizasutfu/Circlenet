'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';

export default function ReplyInput({ postId, parentId, onCommentAdd, showToast, onCancel }) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      const res = await apiClient(`/api/posts/${postId}/comment`, {
        method: 'POST',
        body: { text: text.trim(), parentId },
      });
      const newComment = res.data || res;
      onCommentAdd(newComment);
      setText('');
      showToast('Reply added!');
      if (onCancel) onCancel();
    } catch (err) {
      showToast(err.message || 'Failed to add reply.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write a reply…"
        className="flex-1 bg-[var(--color-surface)] rounded-[var(--radius-radius-sm)] px-3 py-1.5 text-sm text-[var(--color-txt)] placeholder:text-[var(--color-txt3)] border border-[var(--color-border)] focus:border-[var(--color-accent)] focus:outline-none"
        disabled={submitting}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
        }}
      />
      <button
        onClick={handleSubmit}
        disabled={submitting || !text.trim()}
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
    </div>
  );
}