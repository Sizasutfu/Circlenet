// src/components/ui/QuoteModal.jsx
'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api';
import PostCard from './PostCard';

export default function QuoteModal({ post, onClose, onSuccess }) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) {
      setError('Please write something.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiClient(`/api/posts/${post.id}/repost`, {
        method: 'POST',
        body: { text: text.trim() },
      });
      onSuccess();
    } catch (err) {
      setError(err.message || 'Failed to quote post.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-[var(--radius-radius)] w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-fadeUp" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] flex-shrink-0">
          <h2 className="font-head font-extrabold text-[var(--color-txt)]">Quote Post</h2>
          <button onClick={onClose} className="text-[var(--color-txt2)] hover:text-[var(--color-txt)] transition text-xl">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {/* Original post */}
          <div className="mb-4">
            <div className="text-xs font-bold text-[var(--color-txt2)] uppercase tracking-wide mb-2">Original post</div>
            <div className="border border-[var(--color-border)] rounded-xl overflow-hidden bg-[var(--color-surface)]">
              <PostCard post={post} />
            </div>
          </div>

          {/* Quote textarea */}
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="quote-text" className="text-xs font-bold text-[var(--color-txt2)] uppercase tracking-wide block mb-2">
                Your comment
              </label>
              <textarea
                id="quote-text"
                rows={4}
                maxLength={500}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Add your thoughts…"
                className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm text-[var(--color-txt)] placeholder:text-[var(--color-txt3)] resize-none outline-none focus:border-[var(--color-accent)] transition"
                autoFocus
              />
              <div className="text-right text-xs text-[var(--color-txt3)] mt-1">
                {500 - text.length} left
              </div>
            </div>

            {error && (
              <div className="mb-3 text-sm text-[var(--color-rose)] bg-[var(--color-rose-bg)] px-4 py-2 rounded-lg">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-[var(--color-txt2)] hover:bg-[var(--color-surface)] rounded-lg transition"
                title='Close'
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !text.trim()}
                className="px-6 py-2 bg-[var(--color-accent)] text-white rounded-lg text-sm font-semibold hover:bg-[var(--color-accent-h)] transition disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Posting…
                  </>
                ) : (
                  'Quote & Post'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}