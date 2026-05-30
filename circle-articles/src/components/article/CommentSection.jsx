'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
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
      // Use the same endpoint as in original blog: GET /api/articles/:id
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
    if (!user) {
      window.location.href = '/login';
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
    const indent = { marginLeft: `${Math.min(depth * 18, 36)}px` };
    return (
      <div key={c.id} className="art-comment-item" style={indent}>
        <div className="art-comment-header">
          <span className="art-comment-user">{c.author}</span>
          <span className="art-comment-time">{new Date(c.createdAt).toLocaleString()}</span>
        </div>
        <div className="art-comment-text">{c.text}</div>
        {user && (
          <button className="art-reply-btn" onClick={() => setReplyTo({ id: c.id, author: c.author })}>
            ↩ Reply
          </button>
        )}
        {(c.replies || []).map(r => renderComment(r, depth + 1))}
      </div>
    );
  };

  if (error) {
    return (
      <section className="art-comments">
        <div className="art-comments-title">Comments</div>
        <div style={{ color: 'var(--rose)', padding: '1rem' }}>Error: {error}</div>
      </section>
    );
  }

  return (
    <section className="art-comments">
      <div className="art-comments-title">Comments</div>
      {replyTo && (
        <div className="reply-to-banner">
          Replying to <strong>{replyTo.author}</strong>
          <button onClick={() => setReplyTo(null)}>✕</button>
        </div>
      )}
      <div className="art-comment-compose">
        <textarea
          placeholder="Write a comment..."
          value={text}
          onChange={e => setText(e.target.value)}
          rows={3}
        />
        <button className="art-comment-submit" onClick={postComment}>
          Post Comment
        </button>
      </div>
      <div id="comments-list">
        {loading ? (
          <div style={{ color: 'var(--txt3)' }}>Loading comments...</div>
        ) : comments.length === 0 ? (
          <div style={{ color: 'var(--txt3)' }}>No comments yet. Be the first!</div>
        ) : (
          comments.map(c => renderComment(c))
        )}
      </div>
    </section>
  );
}