// src/app/post/[id]/PostDetailClient.jsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import { useRouter } from 'next/navigation';
import PostCard from '@/components/ui/PostCard';
import Link from 'next/link';

// ── Helper: resolve media URLs ──
function resolveMediaUrl(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';
  return `${base}${url}`;
}

function stringToColor(str) {
  if (!str) return '#888';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 55%)`;
}

// ── Toast ──
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);
  const bgColor = type === 'error' ? 'var(--color-rose)' : 'var(--color-green)';
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-lg text-white text-sm font-medium" style={{ background: bgColor }}>
      {message}
    </div>
  );
}

export default function PostDetailClient({ postId }) {
  const { user } = useAuth();
  const router = useRouter();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [commenting, setCommenting] = useState(false);

  // ── Fetch post and comments ──
  useEffect(() => {
    if (!postId) {
      setError('Post ID missing.');
      setLoading(false);
      return;
    }

    const fetchPost = async () => {
      try {
        const response = await apiClient(`/api/posts/${postId}`);
        const data = response.data || response;
        setPost(data);
        setComments(data.comments || []);
      } catch (err) {
        console.error('Error fetching post:', err);
        setError(err.message || 'Failed to load post.');
      } finally {
        setLoading(false);
      }
    };
    fetchPost();
  }, [postId]);

  // ── Show toast ──
  const showToast = (msg, type = 'success') => {
    setToast({ message: msg, type });
  };

  // ── Like post ──
  const handleLike = async (id) => {
    if (!user) return;
    const isLiked = post.likes?.includes(user.id);
    const newLikes = isLiked
      ? post.likes.filter((uid) => uid !== user.id)
      : [...(post.likes || []), user.id];
    setPost({ ...post, likes: newLikes });
    try {
      await apiClient(`/api/posts/${id}/like`, { method: 'POST' });
    } catch (err) {
      setPost({ ...post, likes: isLiked ? [...post.likes, user.id] : post.likes.filter((uid) => uid !== user.id) });
      showToast('Failed to like post', 'error');
    }
  };

  // ── Repost ──
  const handleRepost = async (id) => {
    if (!user) return;
    try {
      await apiClient(`/api/posts/${id}/repost`, { method: 'POST' });
      showToast('Reposted! 🔁', 'success');
    } catch (err) {
      showToast('Failed to repost', 'error');
    }
  };

  // ── Share ──
  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: 'Check this post', url });
    } else {
      navigator.clipboard.writeText(url).then(() => {
        showToast('Link copied!', 'success');
      });
    }
  };

  // ── Comment ──
  const handleComment = async (e) => {
    e.preventDefault();
    if (!user) {
      showToast('Please log in to comment.', 'error');
      return;
    }
    const text = commentText.trim();
    if (!text) return;
    setSubmitting(true);
    try {
      const res = await apiClient(`/api/posts/${postId}/comment`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
      const newComment = res.data || res;
      setComments((prev) => [newComment, ...prev]);
      setCommentText('');
      showToast('Comment added!', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to add comment.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render states ──
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center text-[var(--color-txt2)]">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-accent)] border-t-transparent" />
        <p className="mt-4">Loading post…</p>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center text-[var(--color-txt2)]">
        <p className="text-[var(--color-rose)]">{error || 'Post not found.'}</p>
        <button
          onClick={() => router.push('/feed')}
          className="mt-4 px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg"
        >
          Back to Feed
        </button>
      </div>
    );
  }

  // ── Render post detail ──
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-[var(--color-txt2)] hover:text-[var(--color-accent)] transition mb-4"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Main post */}
      <div className="mb-6">
        <PostCard
          post={post}
          onLike={handleLike}
          onComment={() => setCommenting(true)}
          onRepost={handleRepost}
          onShare={handleShare}
        />
      </div>

      {/* Comment form */}
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-[var(--radius-radius)] p-4 mb-6">
        <form onSubmit={handleComment} className="flex gap-3">
          <div
            className="flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center text-white font-bold text-sm"
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
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder={user ? "Write a comment…" : "Log in to comment"}
            className="flex-1 bg-[var(--color-surface)] rounded-[var(--radius-radius-sm)] px-4 py-2 text-sm text-[var(--color-txt)] placeholder:text-[var(--color-txt3)] border border-[var(--color-border)] focus:border-[var(--color-accent)] focus:outline-none"
            disabled={!user || submitting}
          />
          <button
            type="submit"
            disabled={!user || submitting || !commentText.trim()}
            className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-[var(--radius-radius-sm)] text-sm font-medium hover:bg-[var(--color-accent-h)] transition disabled:opacity-50"
          >
            {submitting ? '…' : 'Reply'}
          </button>
        </form>
        {!user && (
          <p className="text-xs text-[var(--color-txt3)] mt-2">
            <Link href="/login" className="text-[var(--color-accent)] hover:underline">Log in</Link> to join the conversation.
          </p>
        )}
      </div>

      {/* Comments list */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-[var(--color-txt2)]">Comments ({comments.length})</h3>
        {comments.length === 0 ? (
          <p className="text-sm text-[var(--color-txt3)]">No comments yet. Be the first!</p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="flex gap-3 bg-[var(--color-card)] border border-[var(--color-border)] rounded-[var(--radius-radius-sm)] p-3">
              <div
                className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-white font-bold text-xs"
                style={{
                  background: comment.user?.picture ? 'transparent' : stringToColor(comment.user?.name || ''),
                }}
              >
                {comment.user?.picture ? (
                  <img src={resolveMediaUrl(comment.user.picture)} alt={comment.user.name} className="w-full h-full rounded-full object-cover" />
                ) : (
                  comment.user?.name?.charAt(0)?.toUpperCase() || '?'
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-[var(--color-txt)]">{comment.user?.name || 'Unknown'}</span>
                  <span className="text-xs text-[var(--color-txt3)]">@{comment.user?.username || 'unknown'}</span>
                  <span className="text-xs text-[var(--color-txt3)]">· {new Date(comment.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-sm text-[var(--color-txt)] mt-0.5">{comment.text}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}