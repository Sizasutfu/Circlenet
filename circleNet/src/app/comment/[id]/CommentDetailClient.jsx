// app/comment/[id]/CommentDetailClient.jsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { resolveMediaUrl } from '@/lib/url';
import CommentItem from '@/components/post-detail/CommentItem';
import ReplyInput from '@/components/post-detail/ReplyInput';
import CommentTimestamp from '@/components/post-detail/CommentTimestamp';
import Toast from '@/components/post-detail/Toast';
import { dedupeComments } from '@/lib/comments';

// ─── Uniform avatar placeholder ──────────────────────────
function AvatarPlaceholder({ size = 'h-10 w-10', className = '' }) {
  return (
    <div
      className={`flex-shrink-0 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center ${size} ${className}`}
    >
      <svg
        className="w-1/2 h-1/2 text-[var(--color-txt3)]"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    </div>
  );
}

function getCommentUser(comment) {
  if (!comment) return { name: 'Unknown', username: 'unknown', picture: null };
  if (comment.user) {
    return {
      name: comment.user.name || comment.user.displayName || 'Unknown',
      username: comment.user.username || comment.user.handle || 'unknown',
      picture: comment.user.picture || comment.user.avatar || null,
    };
  }
  if (comment.author || comment.authorName) {
    return {
      name: comment.author || comment.authorName || 'Unknown',
      username: comment.authorUsername || comment.username || 'unknown',
      picture: comment.authorPicture || comment.authorAvatar || null,
    };
  }
  return {
    name: comment.name || 'Unknown',
    username: comment.username || 'unknown',
    picture: comment.picture || null,
  };
}

// ─── Flatten a nested comment tree into a single array with parentId ──
function flattenComments(input, parentId = null, out = []) {
  if (!Array.isArray(input)) return out;
  for (const c of input) {
    if (!c || c.id == null) continue;
    const normalized = {
      ...c,
      parentId: c.parentId ?? c.parent_id ?? parentId ?? null,
    };
    out.push(normalized);
    if (Array.isArray(c.replies) && c.replies.length) {
      flattenComments(c.replies, normalized.id, out);
    }
    if (Array.isArray(c.children) && c.children.length) {
      flattenComments(c.children, normalized.id, out);
    }
  }
  return out;
}

// ─── Pull a flat list of comments out of any of the API's possible shapes ──
function extractComments(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return flattenComments(payload);

  const candidates =
    payload.comments ||
    payload.replies ||
    payload.thread ||
    payload.children ||
    payload.data?.comments ||
    payload.data?.replies ||
    payload.data?.thread ||
    [];

  return flattenComments(candidates);
}

// ─── Seed state from whatever the server passed in ──────────────────────
function seedFromInitial(initialComment) {
  if (!initialComment) return [];
  const rootId = initialComment.id;
  const root = {
    ...initialComment,
    parentId:
      initialComment.parentId ?? initialComment.parent_id ?? null,
  };
  const children = flattenComments(
    initialComment.replies ||
      initialComment.children ||
      initialComment.comments ||
      [],
    rootId
  );
  return dedupeComments([root, ...children]);
}

export default function CommentDetailClient({ commentId, initialComment }) {
  const { user } = useAuth();
  const router = useRouter();

  const [comment, setComment] = useState(initialComment || null);
  const [threadComments, setThreadComments] = useState(() =>
    seedFromInitial(initialComment)
  );
  const [loading, setLoading] = useState(!initialComment);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [replying, setReplying] = useState(false);

  const showToast = (message, type = 'success') =>
    setToast({ message, type });

  // ── Fetch the full thread ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await apiClient(`/api/comments/${commentId}/thread`);
        const payload = res?.data ?? res;

        if (cancelled) return;

        const root =
          payload?.comment || payload?.data?.comment || payload || null;
        const fetched = extractComments(payload);

        // Only replace root if we got a usable object
        if (root && root.id != null) {
          setComment((prev) =>
            prev && prev.id === root.id ? { ...prev, ...root } : root
          );
        }

        // Never wipe what we already have with an empty response
        setThreadComments((prev) => {
          if (!fetched.length) return prev;
          // Merge: fetched first (fresh data), then anything we already had
          return dedupeComments([...fetched, ...prev]);
        });

        setError(null);
      } catch (err) {
        if (cancelled) return;
        // Keep the seeded data — don't blow up the page
        if (!initialComment) {
          setError('Failed to load comment.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commentId]);

  // ── Handle a new reply at any depth ─────────────────────────
  const handleCommentAdd = (newComment) => {
    if (!newComment) return;
    // Normalize parentId so filtering works
    const normalized = {
      ...newComment,
      parentId:
        newComment.parentId ?? newComment.parent_id ?? comment?.id ?? null,
    };
    setThreadComments((prev) => dedupeComments([normalized, ...prev]));
  };

  // Direct children of the root comment
  const rootReplies = useMemo(() => {
    return threadComments.filter(
      (c) =>
        String(c.parentId ?? c.parent_id ?? '') === String(commentId)
    );
  }, [threadComments, commentId]);

  if (loading && !comment) {
    return (
      <div className="p-8 text-center text-[var(--color-txt2)]">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-accent)] border-t-transparent" />
        <p className="mt-4">Loading comment…</p>
      </div>
    );
  }

  if (error || !comment) {
    return (
      <div className="p-8 text-center text-[var(--color-rose)]">
        {error || 'Comment not found.'}
      </div>
    );
  }

  const { name, username, picture } = getCommentUser(comment);
  const avatarUrl = resolveMediaUrl(picture);
  const postId = comment.postId ?? comment.post_id;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-[var(--color-txt2)] hover:text-[var(--color-accent)] transition mb-4"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* ─── Root Comment ───────────────────────────────────── */}
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-4 mb-4">
        <div className="flex gap-3">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={name}
              className="flex-shrink-0 h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <AvatarPlaceholder size="h-10 w-10" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5">
              <Link
                href={`/profile/${username}`}
                className="font-semibold text-sm hover:underline"
              >
                {name}
              </Link>
              <span className="text-xs text-[var(--color-txt2)]">
                @{username}
              </span>
              <span className="text-xs text-[var(--color-txt3)]">
                · <CommentTimestamp date={comment.createdAt} />
              </span>
            </div>
            <p className="text-sm text-[var(--color-txt)] mt-1 whitespace-pre-wrap">
              {comment.text}
            </p>
            {postId && (
              <Link
                href={`/post/${postId}`}
                className="text-xs text-[var(--color-accent)] hover:underline mt-2 inline-block"
              >
                View parent post →
              </Link>
            )}

            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={() => setReplying((v) => !v)}
                className="text-xs text-[var(--color-txt3)] hover:text-[var(--color-accent)] transition"
              >
                {replying ? 'Cancel' : 'Reply'}
              </button>
            </div>

            {replying && (
              <div className="mt-3">
                <ReplyInput
                  postId={postId}
                  parentId={comment.id}
                  onCommentAdd={handleCommentAdd}
                  showToast={showToast}
                  onCancel={() => setReplying(false)}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Replies (recursive) ────────────────────────────── */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-[var(--color-txt2)]">
          Replies ({rootReplies.length})
        </h3>
        {rootReplies.length === 0 ? (
          <p className="text-sm text-[var(--color-txt3)]">No replies yet.</p>
        ) : (
          rootReplies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              allComments={threadComments}
              postId={postId}
              onCommentAdd={handleCommentAdd}
              showToast={showToast}
            />
          ))
        )}
      </div>
    </div>
  );
}