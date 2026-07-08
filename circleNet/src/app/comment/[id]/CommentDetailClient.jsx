// app/comment/[id]/CommentDetailClient.jsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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

function timeAgo(dateString) {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diff = Math.max(0, now - then);
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

function getCommentUser(comment) {
  if (comment.user) {
    return {
      name: comment.user.name || 'Unknown',
      username: comment.user.username || 'unknown',
      picture: comment.user.picture || null,
    };
  }
  if (comment.author) {
    return {
      name: comment.author,
      username: comment.authorUsername || comment.username || 'unknown',
      picture: comment.authorPicture || null,
    };
  }
  return { name: 'Unknown', username: 'unknown', picture: null };
}

export default function CommentDetailClient({ commentId, initialComment }) {
  const { user } = useAuth();
  const router = useRouter();

  const [comment, setComment] = useState(initialComment);
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(!initialComment);
  const [error, setError] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialComment) {
      setReplies(initialComment.replies || []);
      return;
    }
    const fetchComment = async () => {
      try {
        const res = await apiClient(`/api/comments/${commentId}`);
        const data = res.data || res;
        setComment(data);
        setReplies(data.replies || []);
      } catch (err) {
        setError('Failed to load comment.');
      } finally {
        setLoading(false);
      }
    };
    fetchComment();
  }, [commentId, initialComment]);

  const handleReply = async (e) => {
    e.preventDefault();
    if (!user) {
      router.push('/login');
      return;
    }
    const text = replyText.trim();
    if (!text) return;
    setSubmitting(true);
    try {
      const res = await apiClient(`/api/comments/${commentId}/reply`, {
        method: 'POST',
        body: { text },
      });
      const newReply = res.data || res;
      setReplies((prev) => [...prev, newReply]);
      setReplyText('');
    } catch (err) {
      setError(err.message || 'Failed to reply.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (error || !comment) return <div className="p-8 text-center text-[var(--color-rose)]">{error || 'Comment not found.'}</div>;

  const { name, username, picture } = getCommentUser(comment);
  const avatarUrl = resolveMediaUrl(picture);
  const initial = name.charAt(0).toUpperCase();
  const color = stringToColor(name);
  const postedTime = timeAgo(comment.createdAt);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-[var(--color-txt2)] hover:text-[var(--color-accent)] transition mb-4"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-4 mb-6">
        <div className="flex gap-3">
          <div
            className="flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm overflow-hidden"
            style={{ background: avatarUrl ? 'transparent' : color }}
          >
            {avatarUrl ? <img src={avatarUrl} alt={name} className="w-full h-full object-cover" /> : initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5">
              <Link href={`/profile/${username}`} className="font-semibold text-sm hover:underline">
                {name}
              </Link>
              <span className="text-xs text-[var(--color-txt2)]">@{username}</span>
              <span className="text-xs text-[var(--color-txt3)]">· {postedTime}</span>
            </div>
            <p className="text-sm text-[var(--color-txt)] mt-1 whitespace-pre-wrap">{comment.text}</p>
            {comment.parentId && (
              <Link
                href={`/post/${comment.postId}`}
                className="text-xs text-[var(--color-accent)] hover:underline mt-2 inline-block"
              >
                View parent post →
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Reply composer */}
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-4 mb-6">
        <form onSubmit={handleReply} className="flex gap-3">
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
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder={user ? 'Write a reply…' : 'Log in to reply'}
            className="flex-1 bg-[var(--color-surface)] rounded-[var(--radius-radius-sm)] px-4 py-2 text-sm text-[var(--color-txt)] placeholder:text-[var(--color-txt3)] border border-[var(--color-border)] focus:border-[var(--color-accent)] focus:outline-none"
            disabled={!user || submitting}
          />
          <button
            type="submit"
            disabled={!user || submitting || !replyText.trim()}
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

      {/* Replies */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-[var(--color-txt2)]">Replies ({replies.length})</h3>
        {replies.length === 0 ? (
          <p className="text-sm text-[var(--color-txt3)]">No replies yet.</p>
        ) : (
          replies.map((reply) => {
            const { name: rName, username: rUsername, picture: rPicture } = getCommentUser(reply);
            const rAvatarUrl = resolveMediaUrl(rPicture);
            const rInitial = rName.charAt(0).toUpperCase();
            const rColor = stringToColor(rName);
            const rTime = timeAgo(reply.createdAt);
            return (
              <div key={reply.id} className="border border-[var(--color-border)] rounded-[var(--radius-radius-sm)] p-3 hover:shadow-[var(--color-shadow)] transition-shadow">
                <div className="flex gap-3">
                  <div
                    className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-white font-bold text-xs overflow-hidden"
                    style={{ background: rAvatarUrl ? 'transparent' : rColor }}
                  >
                    {rAvatarUrl ? <img src={rAvatarUrl} alt={rName} className="w-full h-full object-cover" /> : rInitial}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-[var(--color-txt)]">{rName}</span>
                      <span className="text-xs text-[var(--color-txt3)]">@{rUsername}</span>
                      <span className="text-xs text-[var(--color-txt3)]">· {rTime}</span>
                    </div>
                    <p className="text-sm text-[var(--color-txt)] mt-0.5">{reply.text}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}