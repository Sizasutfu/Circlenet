// src/components/whisper/WhisperReplyModal.jsx
'use client';

import { useState } from 'react';
import { useWhisper } from '@/contexts/WhisperContext';

export default function WhisperReplyModal({ message, onClose, onPosted }) {
  const { postWhisper } = useWhisper();
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!reply.trim()) {
      setError('Please write a reply.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await postWhisper(message.id, reply);
      onPosted();
    } catch (err) {
      console.error('Whisper reply error:', err);
      setError(err.message || 'Failed to post. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl w-full max-w-lg shadow-xl animate-fadeUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h3 className="font-head font-bold text-[var(--color-txt)]">✍️ Reply & Post</h3>
          <button onClick={onClose} className="text-[var(--color-txt2)] hover:text-[var(--color-txt)] text-xl">×</button>
        </div>

        <div className="p-4 space-y-4">
          {/* Preview */}
          <div className="bg-gradient-to-br from-[#1a1030] to-[#2d1a4a] border border-[#3b2a6e] rounded-xl p-4">
            <div className="text-[10px] font-extrabold tracking-wider uppercase text-[#a78bfa] flex items-center gap-1.5">
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
              Whisper on Circle
            </div>
            <div className="text-[15px] text-[#e2d9f3] italic leading-relaxed break-words mt-1">
              "{message.message}"
            </div>
          </div>

          {/* Reply textarea */}
          <div>
            <textarea
              rows={3}
              maxLength={500}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Your reply… this becomes the post caption"
              className="w-full bg-[var(--color-bg)] border border-[var(--color-accent)] rounded-xl px-4 py-3 text-sm text-[var(--color-txt)] placeholder:text-[var(--color-txt3)] resize-none outline-none"
            />
            <div className="text-right text-xs text-[var(--color-txt3)] mt-1">
              {500 - reply.length} left
            </div>
          </div>

          {error && (
            <div className="text-sm text-[var(--color-rose)] bg-[var(--color-rose-bg)] p-2 rounded">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !reply.trim()}
            className="w-full py-3 bg-[var(--color-accent)] text-white rounded-full font-bold text-sm hover:bg-[var(--color-accent-h)] transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
                Post to Circle feed
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}