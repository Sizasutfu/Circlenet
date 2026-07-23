// app/post/[id]/PostDetailClient.jsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useWs } from '@/contexts/WsContext';
import { useGroups } from '@/contexts/GroupsContext';
import PostCard from '@/components/ui/PostCard';
import QuoteModal from '@/components/ui/QuoteModal';
import {
  Toast,
  CommentInput,
  CommentList,
  dedupeComments,
} from '@/components/post-detail';

export default function PostDetailClient({ postId }) {
  const { user } = useAuth();
  const router = useRouter();
  const { registerHandler } = useWs();
  const { groupsList, myGroups } = useGroups();

  const groupMap = useMemo(() => {
    const map = new Map();
    const all = [...myGroups, ...groupsList];
    for (const g of all) {
      if (g.id) map.set(g.id, { id: g.id, topic: g.topic, displayName: g.displayName || `#${g.topic}` });
    }
    return map;
  }, [myGroups, groupsList]);

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [quoteTarget, setQuoteTarget] = useState(null);

  // ── Follow state ──
  const [isFollowing, setIsFollowing] = useState(false);
  const [authorId, setAuthorId] = useState(null);

  // ---- Effects ----
  useEffect(() => { fetchPostData(); }, [postId]);

  useEffect(() => {
    const unsub = registerHandler('new_comment', (msg) => {
      if (msg.postId === parseInt(postId)) {
        setComments(prev => dedupeComments([msg.comment, ...prev]));
      }
    });
    return () => unsub();
  }, [postId, registerHandler]);

  useEffect(() => {
    const unsub = registerHandler('post_counts', (msg) => {
      if (msg.postId === parseInt(postId)) {
        setPost(prev => ({
          ...prev,
          likes: msg.likes,
          commentCount: msg.comments,
          repostCount: msg.reposts,
        }));
      }
    });
    return () => unsub();
  }, [postId, registerHandler]);

  // ---- Data fetching ----
  const fetchPostData = async () => {
    if (!postId) { setError('Post ID missing.'); setLoading(false); return; }
    setLoading(true);
    try {
      const response = await apiClient(`/api/posts/${postId}`);
      const data = response.data || response;
      setPost(data);
      const deduped = dedupeComments(data.comments || []);
      setComments(deduped);

      // ── Fetch author profile for follow status ──
      const userId = data.user?.id || data.userId || data.authorId;
      if (userId) {
        setAuthorId(userId);
        const profileRes = await apiClient(`/api/users/${userId}/profile`);
        const profile = profileRes.data || profileRes;
        setIsFollowing(profile.isFollowing || false);
      }
    } catch (err) {
      setError(err.message || 'Failed to load post.');
    } finally {
      setLoading(false);
    }
  };

  // ---- Handlers ----
  const showToast = (msg, type = 'success') => setToast({ message: msg, type });
  const handleLike = async (id) => {
    if (!user) { showToast('Log in to like.', 'error'); return; }
    const isLiked = post?.likes?.some(uid => uid === user.id);
    const newLikes = isLiked
      ? post.likes.filter(uid => uid !== user.id)
      : [...(post.likes || []), user.id];
    setPost({ ...post, likes: newLikes });
    try {
      await apiClient(`/api/posts/${id}/like`, { method: 'POST' });
    } catch (err) {
      setPost({ ...post, likes: isLiked ? [...post.likes, user.id] : post.likes.filter(uid => uid !== user.id) });
      showToast('Failed to like post', 'error');
    }
  };
  const handleRepost = async (id) => {
    if (!user) { showToast('Log in to repost.', 'error'); return; }
    try {
      await apiClient(`/api/posts/${id}/repost`, { method: 'POST' });
      showToast('Reposted! 🔁');
    } catch (err) { showToast('Failed to repost', 'error'); }
  };
  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) navigator.share({ title: 'Check this post', url });
    else navigator.clipboard.writeText(url).then(() => showToast('Link copied!'));
  };
  const handleQuote = (postId) => {
    if (!user) { showToast('Please log in to quote.', 'error'); return; }
    if (post && post.id === postId) setQuoteTarget(post);
    else apiClient(`/api/posts/${postId}`).then(res => setQuoteTarget(res.data || res));
  };
  const handleQuoteSuccess = () => { setQuoteTarget(null); showToast('Quote posted! 🎉'); };
  const handleCommentAdd = (newComment) => setComments(prev => dedupeComments([newComment, ...prev]));

  // ── Follow toggle ──
  const handleFollowToggle = async () => {
    if (!user) { showToast('Log in to follow.', 'error'); return; }
    if (!authorId) return;
    const following = isFollowing;
    const method = following ? 'DELETE' : 'POST';
    const endpoint = following ? `/api/unfollow/${authorId}` : `/api/follow/${authorId}`;
    try {
      await apiClient(endpoint, { method });
      setIsFollowing(!following);
      showToast(following ? 'Unfollowed.' : 'Following! 🎉');
    } catch (err) {
      showToast('Action failed.', 'error');
    }
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
        <button onClick={() => router.push('/feed')} className="mt-4 px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg">
          Back to Feed
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-[var(--color-txt2)] hover:text-[var(--color-accent)] transition mb-4">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <div className="mb-6">
        <PostCard
          post={post}
          groupMap={groupMap}
          onLike={handleLike}
          onComment={() => document.getElementById('comment-input')?.focus()}
          onRepost={handleRepost}
          onShare={handleShare}
          onQuote={handleQuote}
          showFollowButton={true}
          isFollowing={isFollowing}
          onFollowToggle={handleFollowToggle}
        />
      </div>

      <CommentInput postId={postId} onCommentAdd={handleCommentAdd} showToast={showToast} />
      <CommentList comments={comments} postId={postId} onCommentAdd={handleCommentAdd} showToast={showToast} />

      {quoteTarget && (
        <QuoteModal post={quoteTarget} onClose={() => setQuoteTarget(null)} onSuccess={handleQuoteSuccess} />
      )}
    </div>
  );
}