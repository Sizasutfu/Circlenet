'use client';
import { useState, useEffect } from 'react';
import { useAuth, isAuthenticated, redirectToLogin } from '@/lib/auth';
import { apiClient } from '@/lib/api';

export default function CommentSection({ articleId }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Validate articleId
  const isValidId = articleId && !isNaN(Number(articleId));

  const loadComments = async () => {
    if (!isValidId) {
      setError(`Invalid article ID: ${articleId}`);
      setLoading(false);
      return;
    }
    try {
      const res = await apiClient(`/api/articles/${articleId}`);
      setComments(res.data?.comments || []);
      setError(null);
    } catch (err) {
      console.error('Failed to load comments:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComments();
  }, [articleId]);

  const postComment = async () => {
    if (!user && !isAuthenticated()) {
      redirectToLogin();
      return;
    }
    if (!text.trim()) return;
    if (!isValidId) {
      alert('Invalid article ID');
      return;
    }
    try {
      const payload = { text: text.trim() };
      if (replyTo) payload.parentId = replyTo.id;
      await apiClient(`/api/articles/${articleId}/comment`, { method: 'POST', body: JSON.stringify(payload) });
      setText('');
      setReplyTo(null);
      await loadComments();
    } catch (err) {
      alert(err.message);
    }
  };

  const renderComment = (c, depth = 0) => {
    const marginLeft = Math.min(depth * 18, 36);
    return (
      <div
        key={c.id}
        className="bg-card border border-border rounded-radius-sm mb-2.5 animate-card-in p-3.5"
        style={{ marginLeft: `${marginLeft}px` }}
      >
        <div className="flex gap-2 items-center mb-1.5">
          <span className="text-txt text-sm font-bold">{c.author}</span>
          <span className="text-txt3 text-xs ml-auto">
            {new Date(c.createdAt).toLocaleString()}
          </span>
        </div>
        <div className="text-txt2 text-sm leading-relaxed">{c.text}</div>
        {user && (
          <button
            className="text-accent text-xs font-semibold bg-none border-none cursor-pointer mt-2 hover:text-accent-h"
            onClick={() => setReplyTo({ id: c.id, author: c.author })}
          >
            ↩ Reply
          </button>
        )}
        {(c.replies || []).map(r => renderComment(r, depth + 1))}
      </div>
    );
  };

  if (error) {
    return (
      <section className="mt-12">
        <div className="font-head text-lg font-bold text-txt mb-5 pb-3 border-b border-border">
          Comments
        </div>
        <div className="text-rose p-4">Error: {error}</div>
      </section>
    );
  }

  return (
    <section className="mt-12">
      <div className="font-head text-lg font-bold text-txt mb-5 pb-3 border-b border-border">
        Comments
      </div>

      {replyTo && (
        <div className="flex items-center gap-2 bg-accent-bg border border-accent-glow rounded-radius-sm px-3 py-2 mb-3 text-accent text-sm font-semibold">
          Replying to <strong>{replyTo.author}</strong>
          <button
            onClick={() => setReplyTo(null)}
            className="bg-none border-none text-accent text-base cursor-pointer ml-auto"
          >
            ✕
          </button>
        </div>
      )}

      <div className="bg-card border border-border rounded-radius p-3.5 mb-6">
        <textarea
          placeholder="Write a comment..."
          value={text}
          onChange={e => setText(e.target.value)}
          rows={3}
          className="w-full bg-surface border border-border rounded-radius-sm p-2 text-txt text-sm font-body outline-none focus:border-accent resize-vertical min-h-[80px]"
        />
        <button
          onClick={postComment}
          className="mt-2 px-5 py-2 rounded-radius-sm bg-accent text-white text-sm font-bold border-none cursor-pointer hover:bg-accent-h transition-transform hover:-translate-y-0.5"
        >
          Post Comment
        </button>
      </div>

      <div id="comments-list">
        {loading ? (
          <div className="text-txt3">Loading comments...</div>
        ) : comments.length === 0 ? (
          <div className="text-txt3">No comments yet. Be the first!</div>
        ) : (
          comments.map(c => renderComment(c))
        )}
      </div>
    </section>
  );
}