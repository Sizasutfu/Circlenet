// src/app/post/[id]/PostDetailClient.jsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useWs } from '@/contexts/WsContext';
import { useGroups } from '@/contexts/GroupsContext';
import PostCard from '@/components/ui/PostCard';
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

function fmtNum(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n || 0);
}

function dedupeComments(comments) {
  const seen = new Set();
  return comments.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}

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
  return {
    name: 'Unknown',
    username: 'unknown',
    picture: null,
  };
}

export default function PostDetailClient({ postId }) {
  const { user } = useAuth();
  const router = useRouter();
  const { registerHandler } = useWs();
  const { groupsList, myGroups } = useGroups();

  const groupMap = useMemo(() => {
    const map = new Map();
    const all = [...myGroups, ...groupsList];
    for (const g of all) {
      if (g.id) {
        map.set(g.id, {
          id: g.id,
          topic: g.topic,
          displayName: g.displayName || `#${g.topic}`,
        });
      }
    }
    return map;
  }, [myGroups, groupsList]);

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [creator, setCreator] = useState(null);
  const [creatorLoading, setCreatorLoading] = useState(true);

  const [replyTexts, setReplyTexts] = useState({});
  const [replySubmitting, setReplySubmitting] = useState({});
  const [replyingTo, setReplyingTo] = useState(null);

  const [expandedReplies, setExpandedReplies] = useState(new Set());

  const toggleReplies = (commentId) => {
    setExpandedReplies((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(commentId)) {
        newSet.delete(commentId);
      } else {
        newSet.add(commentId);
      }
      return newSet;
    });
  };

  const fetchPostData = async () => {
    if (!postId) {
      setError('Post ID missing.');
      setLoading(false);
      return;
    }
    try {
      const response = await apiClient(`/api/posts/${postId}`);
      const data = response.data || response;
      setPost(data);
      const deduped = dedupeComments(data.comments || []);
      setComments(deduped);

      const parentIds = new Set();
      deduped.forEach(c => {
        if (c.parentId) parentIds.add(c.parentId);
      });
      setExpandedReplies(parentIds);

      const userInfo = data.user || { name: data.author, picture: data.authorPicture, id: data.authorId };
      if (userInfo && userInfo.id) {
        setCreator(userInfo);
        try {
          const profileRes = await apiClient(`/api/users/${userInfo.id}/profile`);
          const profile = profileRes.data || profileRes;
          setCreator((prev) => ({ ...prev, ...profile }));
          setIsFollowing(profile.isFollowing || false);
          setFollowerCount(profile.followerCount || 0);
        } catch (_) {}
      }
      setCreatorLoading(false);
    } catch (err) {
      console.error('Error fetching post:', err);
      setError(err.message || 'Failed to load post.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPostData();
  }, [postId]);

  useEffect(() => {
    const unregisterNewComment = registerHandler('new_comment', (msg) => {
      if (msg.postId === parseInt(postId)) {
        setComments((prev) => {
          if (prev.some((c) => c.id === msg.comment.id)) return dedupeComments(prev);
          const newComments = dedupeComments([msg.comment, ...prev]);
          if (msg.comment.parentId) {
            setExpandedReplies(prevSet => new Set(prevSet).add(msg.comment.parentId));
          }
          return newComments;
        });
      }
    });
    return () => unregisterNewComment();
  }, [postId, registerHandler]);

  useEffect(() => {
    const unregisterCounts = registerHandler('post_counts', (msg) => {
      if (msg.postId === parseInt(postId)) {
        setPost((prev) => {
          if (!prev) return prev;
          const isLiked = prev.likes && user && prev.likes.some((id) => id === user.id);
          const newLikes = [];
          if (isLiked) newLikes.push(user.id);
          const dummyCount = msg.likes - newLikes.length;
          for (let i = 0; i < dummyCount; i++) newLikes.push(-1);
          return {
            ...prev,
            likes: newLikes,
            commentCount: msg.comments,
            repostCount: msg.reposts,
          };
        });
      }
    });
    return () => unregisterCounts();
  }, [postId, registerHandler, user]);

  const showToast = (msg, type = 'success') => {
    setToast({ message: msg, type });
  };

  const handleFollowToggle = async () => {
    if (!user) {
      showToast('Log in to follow.', 'error');
      return;
    }
    if (!creator) return;
    const following = isFollowing;
    const method = following ? 'DELETE' : 'POST';
    const endpoint = following ? `/api/unfollow/${creator.id}` : `/api/follow/${creator.id}`;
    try {
      await apiClient(endpoint, { method });
      setIsFollowing(!following);
      setFollowerCount((prev) => (following ? prev - 1 : prev + 1));
      showToast(following ? 'Unfollowed.' : 'Following! 🎉');
    } catch (err) {
      showToast('Action failed.', 'error');
    }
  };

  const handleLike = async (id) => {
    if (!user) {
      showToast('Log in to like.', 'error');
      return;
    }
    const isLiked = post?.likes?.some((uid) => uid === user.id) || false;
    const newLikes = isLiked
      ? post.likes.filter((uid) => uid !== user.id)
      : [...(post.likes || []), user.id];
    setPost({ ...post, likes: newLikes });
    try {
      await apiClient(`/api/posts/${id}/like`, { method: 'POST' });
    } catch (err) {
      setPost({
        ...post,
        likes: isLiked ? [...post.likes, user.id] : post.likes.filter((uid) => uid !== user.id),
      });
      showToast('Failed to like post', 'error');
    }
  };

  const handleRepost = async (id) => {
    if (!user) {
      showToast('Log in to repost.', 'error');
      return;
    }
    try {
      await apiClient(`/api/posts/${id}/repost`, { method: 'POST' });
      showToast('Reposted! 🔁', 'success');
    } catch (err) {
      showToast('Failed to repost', 'error');
    }
  };

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
        body: { text },
      });
      const newComment = res.data || res;
      setComments((prev) => dedupeComments([newComment, ...prev]));
      setCommentText('');
      showToast('Comment added!', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to add comment.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleReply = (commentId) => {
    if (replyingTo === commentId) {
      setReplyingTo(null);
      setReplyTexts((prev) => ({ ...prev, [commentId]: '' }));
    } else {
      setReplyingTo(commentId);
      if (!replyTexts[commentId]) {
        setReplyTexts((prev) => ({ ...prev, [commentId]: '' }));
      }
    }
  };

  const handleReplySubmit = async (commentId) => {
    if (!user) {
      showToast('Please log in to reply.', 'error');
      return;
    }
    const text = replyTexts[commentId]?.trim();
    if (!text) return;
    setReplySubmitting((prev) => ({ ...prev, [commentId]: true }));
    try {
      const res = await apiClient(`/api/posts/${postId}/comment`, {
        method: 'POST',
        body: { text, parentId: commentId },
      });
      const newComment = res.data || res;
      setComments((prev) => dedupeComments([...prev, newComment]));
      setExpandedReplies(prev => new Set(prev).add(commentId));
      setReplyTexts((prev) => ({ ...prev, [commentId]: '' }));
      setReplyingTo(null);
      showToast('Reply added!', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to add reply.', 'error');
    } finally {
      setReplySubmitting((prev) => ({ ...prev, [commentId]: false }));
    }
  };

  const renderComment = (comment, depth = 0) => {
    const { name, username, picture } = getCommentUser(comment);
    const avatarUrl = resolveMediaUrl(picture);
    const initial = name.charAt(0).toUpperCase();
    const color = stringToColor(name);
    const isReplying = replyingTo === comment.id;
    const replyText = replyTexts[comment.id] || '';
    const isSubmittingReply = replySubmitting[comment.id] || false;

    const replies = comments.filter((c) => c.parentId === comment.id);
    const isExpanded = expandedReplies.has(comment.id);
    const hasReplies = replies.length > 0;

    return (
      <div key={comment.id} className="border border-[var(--color-border)] rounded-[var(--radius-radius-sm)] p-3 hover:shadow-[var(--color-shadow)] transition-shadow">
        <div className="flex gap-3">
          <div
            className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-white font-bold text-xs overflow-hidden"
            style={{ background: avatarUrl ? 'transparent' : color }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={name} className="w-full h-full object-cover rounded-full" />
            ) : (
              initial
            )}
          </div>

          {/* ── Clickable comment body – navigates to comment detail ── */}
          <Link
            href={`/comment/${comment.id}`}
            className="flex-1 min-w-0 hover:bg-[var(--color-surface)] rounded-md transition p-1 -m-1"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-[var(--color-txt)]">{name}</span>
              <span className="text-xs text-[var(--color-txt3)]">@{username}</span>
              <span className="text-xs text-[var(--color-txt3)]">
                · {new Date(comment.createdAt).toLocaleString()}
              </span>
            </div>
            <p className="text-sm text-[var(--color-txt)] mt-0.5 break-words">{comment.text}</p>
          </Link>
        </div>

        {/* ── Buttons outside the link ── */}
        <div className="flex items-center gap-3 mt-1 ml-11">
          <button
            onClick={(e) => { e.stopPropagation(); toggleReply(comment.id); }}
            className="text-xs text-[var(--color-txt3)] hover:text-[var(--color-accent)] transition"
          >
            {isReplying ? 'Cancel' : 'Reply'}
          </button>
          {hasReplies && (
            <button
              onClick={(e) => { e.stopPropagation(); toggleReplies(comment.id); }}
              className="text-xs text-[var(--color-txt3)] hover:text-[var(--color-accent)] transition"
            >
              {isExpanded ? 'Hide replies' : `View ${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`}
            </button>
          )}
        </div>

        {isReplying && (
          <div className="mt-3 ml-11 flex gap-2">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyTexts((prev) => ({ ...prev, [comment.id]: e.target.value }))}
              placeholder="Write a reply…"
              className="flex-1 bg-[var(--color-surface)] rounded-[var(--radius-radius-sm)] px-3 py-1.5 text-sm text-[var(--color-txt)] placeholder:text-[var(--color-txt3)] border border-[var(--color-border)] focus:border-[var(--color-accent)] focus:outline-none"
              disabled={isSubmittingReply}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleReplySubmit(comment.id);
                }
              }}
            />
            <button
              onClick={() => handleReplySubmit(comment.id)}
              disabled={isSubmittingReply || !replyText.trim()}
              className="px-3 py-1.5 bg-[var(--color-accent)] text-white rounded-[var(--radius-radius-sm)] text-sm font-medium hover:bg-[var(--color-accent-h)] transition disabled:opacity-50"
            >
              {isSubmittingReply ? '…' : 'Reply'}
            </button>
          </div>
        )}

        {hasReplies && isExpanded && (
          <div className="ml-11 mt-3 space-y-3 border-l-2 border-[var(--color-border)] pl-4">
            {replies.map((reply) => renderComment(reply, depth + 1))}
          </div>
        )}
      </div>
    );
  };

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

  const creatorName = creator?.name || post.author || 'Anonymous';
  const creatorUsername = creator?.username || post.authorUsername || post.username || '';
  const creatorAvatar = creator?.picture || post.authorPicture || null;
  const creatorBio = creator?.bio || '';
  const creatorInitial = creatorName.charAt(0).toUpperCase();
  const creatorColor = stringToColor(creatorName);
  const avatarUrl = resolveMediaUrl(creatorAvatar);

  const topLevelComments = comments.filter((c) => !c.parentId);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-[var(--color-txt2)] hover:text-[var(--color-accent)] transition mb-4"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {creator && (
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-4 mb-6 flex items-start gap-4">
          <Link href={`/profile/${creatorUsername}`} className="flex-shrink-0">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg overflow-hidden"
              style={{ background: avatarUrl ? 'transparent' : creatorColor }}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={creatorName} className="w-full h-full object-cover" />
              ) : (
                creatorInitial
              )}
            </div>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Link
                href={`/profile/${creatorUsername}`}
                className="font-head font-bold text-[var(--color-txt)] hover:text-[var(--color-accent)] transition"
              >
                {creatorName}
              </Link>
              <span className="text-xs text-[var(--color-txt2)]">@{creatorUsername}</span>
            </div>
            {creatorBio && (
              <p className="text-sm text-[var(--color-txt2)] mt-1 line-clamp-2">{creatorBio}</p>
            )}
            <div className="flex items-center gap-4 mt-2 text-xs text-[var(--color-txt3)]">
              <span>
                <span className="font-bold text-[var(--color-txt)]">{fmtNum(post.user?.postCount || 0)}</span> posts
              </span>
              <span>
                <span className="font-bold text-[var(--color-txt)]">{fmtNum(followerCount)}</span> followers
              </span>
              <span>
                <span className="font-bold text-[var(--color-txt)]">{fmtNum(creator.followingCount || 0)}</span> following
              </span>
            </div>
          </div>
          {user && user.id !== creator.id && (
            <button
              onClick={handleFollowToggle}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition flex-shrink-0 ${
                isFollowing
                  ? 'border border-[var(--color-border)] text-[var(--color-txt2)] hover:bg-[var(--color-accent-bg)]'
                  : 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-h)]'
              }`}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          )}
        </div>
      )}

      <div className="mb-6">
        {post && (
          <PostCard
            post={post}
            groupMap={groupMap}
            onLike={handleLike}
            onComment={() => document.getElementById('comment-input')?.focus()}
            onRepost={handleRepost}
            onShare={handleShare}
          />
        )}
      </div>

      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-[var(--radius-radius)] p-4 mb-6">
        <form onSubmit={handleComment} className="flex gap-3">
          <div
            className="flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center text-white font-bold text-sm"
            style={{
              background: user?.picture ? 'transparent' : stringToColor(user?.name || ''),
            }}
          >
            {user?.picture ? (
              <img
                src={resolveMediaUrl(user.picture)}
                alt={user?.name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              user?.name?.charAt(0)?.toUpperCase() || '?'
            )}
          </div>
          <input
            id="comment-input"
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder={user ? 'Write a comment…' : 'Log in to comment'}
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
            <Link href="/login" className="text-[var(--color-accent)] hover:underline">
              Log in
            </Link>{' '}
            to join the conversation.
          </p>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-[var(--color-txt2)]">
          Comments ({topLevelComments.length})
        </h3>
        {topLevelComments.length === 0 ? (
          <p className="text-sm text-[var(--color-txt3)]">No comments yet. Be the first!</p>
        ) : (
          topLevelComments.map((comment) => renderComment(comment))
        )}
      </div>
    </div>
  );
}