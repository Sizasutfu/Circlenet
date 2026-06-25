// src/app/feed/FeedClient.jsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';  // ✅ used for all authenticated requests
import PostCard from '@/components/ui/PostCard';
import { useRouter } from 'next/navigation';

// ── Helper: resolve media URLs ──
function resolveMediaUrl(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';
  return `${base}${url}`;
}

// ── Toast component ──
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

export default function FeedClient() {
  const { user } = useAuth();
  const router = useRouter();

  // ── State ──
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // ── Composer state ──
  const [composerText, setComposerText] = useState('');
  const [composerImage, setComposerImage] = useState(null);
  const [composerImagePreview, setComposerImagePreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const loadMoreRef = useRef(null);
  const fileInputRef = useRef(null);

  // ── Fetch posts ──
  const fetchPosts = useCallback(async (pageNum = 1, append = false) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      // ✅ Use apiClient – it adds auth headers automatically
      const response = await apiClient(`/api/posts?feed=global&page=${pageNum}&limit=20`);
      console.log('📦 Feed API response:', response);

      // Robust extraction of posts from various response shapes
      let postsData = [];
      let hasMoreData = false;

      if (response?.data?.posts) {
        postsData = response.data.posts;
        hasMoreData = response.data.pagination?.hasMore ?? (postsData.length === 20);
      } else if (response?.posts) {
        postsData = response.posts;
        hasMoreData = response.pagination?.hasMore ?? (postsData.length === 20);
      } else if (Array.isArray(response?.data)) {
        postsData = response.data;
        hasMoreData = postsData.length === 20;
      } else if (Array.isArray(response)) {
        postsData = response;
        hasMoreData = postsData.length === 20;
      } else {
        const keys = Object.keys(response || {});
        for (const key of keys) {
          if (Array.isArray(response[key])) {
            postsData = response[key];
            hasMoreData = postsData.length === 20;
            break;
          }
        }
      }

      // Ensure each post has a 'user' object
      const postsWithUser = postsData.map((p) => ({
        ...p,
        user: p.user || { name: 'Unknown', username: 'unknown', picture: null },
      }));

      setPosts((prev) => (append ? [...prev, ...postsWithUser] : postsWithUser));
      setHasMore(hasMoreData);
      setPage(pageNum);
    } catch (err) {
      console.error('Failed to fetch posts:', err);
      setError('Could not load posts. Please try again.');
      if (pageNum === 1) {
        // Fallback mock for development
        setPosts([
          { id: 1, text: 'Welcome to Circlenet! 🎉', createdAt: new Date().toISOString(), likes: [], comments: [], user: { name: 'Circlenet', username: 'circlenet', picture: null } },
        ]);
        setHasMore(false);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // ── Load more ──
  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore) return;
    fetchPosts(page + 1, true);
  }, [hasMore, loadingMore, page, fetchPosts]);

  // ── Initial load ──
  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    fetchPosts(1, false);
  }, [user, router, fetchPosts]);

  // ── Intersection Observer ──
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );
    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loadMore]);

  // ── Toast helper ──
  const showToast = (msg, type = 'success') => {
    setToast({ message: msg, type });
  };

  // ── Like a post ──
  const handleLike = async (postId) => {
    if (!user) return;
    const postIndex = posts.findIndex((p) => p.id === postId);
    if (postIndex === -1) return;
    const post = posts[postIndex];
    const isLiked = post.likes?.includes(user.id);
    const newLikes = isLiked
      ? post.likes.filter((id) => id !== user.id)
      : [...(post.likes || []), user.id];

    setPosts((prev) => {
      const updated = [...prev];
      updated[postIndex] = { ...post, likes: newLikes };
      return updated;
    });

    try {
      await apiClient(`/api/posts/${postId}/like`, { method: 'POST' });
    } catch (err) {
      setPosts((prev) => {
        const updated = [...prev];
        updated[postIndex] = { ...post };
        return updated;
      });
      showToast('Failed to like post', 'error');
    }
  };

  const handleComment = (postId) => {
    showToast('Comment feature coming soon!', 'success');
  };

  const handleRepost = async (postId) => {
    if (!user) return;
    try {
      await apiClient(`/api/posts/${postId}/repost`, { method: 'POST' });
      showToast('Reposted! 🔁', 'success');
      fetchPosts(1, false);
    } catch (err) {
      showToast('Failed to repost', 'error');
    }
  };

  const handleShare = (postId) => {
    const url = `${window.location.origin}/post/${postId}`;
    if (navigator.share) {
      navigator.share({ title: 'Check this post', url });
    } else {
      navigator.clipboard.writeText(url).then(() => {
        showToast('Link copied to clipboard!', 'success');
      });
    }
  };

  // ── Create a new post (using apiClient) ──
  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!user) {
      showToast('You must be logged in to post.', 'error');
      return;
    }
    if (!composerText.trim() && !composerImage) {
      showToast('Please write something or add an image.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('text', composerText.trim());
      if (composerImage) {
        formData.append('image', composerImage);
      }

      // ✅ Use apiClient – it automatically adds Authorization and X-User-Id
      const response = await apiClient('/api/posts', {
        method: 'POST',
        body: formData,
        // No need to set headers – apiClient handles it
      });

      // Extract the actual post data (apiClient returns the full response)
      const newPost = response.data || response;

      // Optimistically add the new post to the feed
      const optimisticPost = {
        id: newPost.id || Date.now(),
        text: composerText.trim(),
        image: newPost.image || null,
        createdAt: new Date().toISOString(),
        likes: [],
        comments: [],
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          picture: user.picture,
        },
      };
      setPosts((prev) => [optimisticPost, ...prev]);

      // Clear composer
      setComposerText('');
      setComposerImage(null);
      setComposerImagePreview(null);
      setIsExpanded(false);
      showToast('Post created! 🎉', 'success');
    } catch (err) {
      console.error('Failed to create post:', err);
      showToast(err.message || 'Failed to create post. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Image selection ──
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image must be under 5MB.', 'error');
      return;
    }
    setComposerImage(file);
    const reader = new FileReader();
    reader.onload = (ev) => setComposerImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setComposerImage(null);
    setComposerImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Render states ──
  if (!user) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center text-[var(--color-txt2)]">
        <p>Please log in to see the feed.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center text-[var(--color-txt2)]">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-accent)] border-t-transparent" />
        <p className="mt-4">Loading feed…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center text-[var(--color-txt2)]">
        <p className="text-[var(--color-rose)]">{error}</p>
        <button
          onClick={() => fetchPosts(1, false)}
          className="mt-4 px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg"
        >
          Retry
        </button>
      </div>
    );
  }

  // ── Render feed ──
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* ── Post Composer ── */}
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-[var(--radius-radius)] p-4 mb-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div
            className="flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
            style={{
              background: user?.picture ? 'transparent' : stringToColor(user?.name || ''),
            }}
          >
            {user?.picture ? (
              <img src={resolveMediaUrl(user.picture)} alt={user.name} className="w-full h-full rounded-full object-cover" />
            ) : (
              user?.name?.charAt(0)?.toUpperCase() || '?'
            )}
          </div>
          <div className="flex-1">
            <textarea
              value={composerText}
              onChange={(e) => {
                setComposerText(e.target.value);
                if (e.target.value.trim()) setIsExpanded(true);
              }}
              onFocus={() => setIsExpanded(true)}
              placeholder="What's on your mind?"
              className="w-full bg-transparent border-none outline-none resize-none text-[var(--color-txt)] placeholder:text-[var(--color-txt3)] text-sm"
              rows={isExpanded ? 3 : 1}
            />
            {composerImagePreview && (
              <div className="relative mt-2 inline-block">
                <img src={composerImagePreview} alt="Preview" className="max-h-48 rounded-lg border border-[var(--color-border)]" />
                <button
                  onClick={removeImage}
                  className="absolute -top-2 -right-2 bg-[var(--color-rose)] text-white rounded-full p-1 hover:bg-[var(--color-rose)]/80 transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>
            )}
            {isExpanded && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--color-border)]">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current.click()}
                    className="text-[var(--color-txt2)] hover:text-[var(--color-accent)] transition"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageSelect} />
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setIsExpanded(false); setComposerText(''); removeImage(); }}
                    className="px-4 py-1.5 text-sm text-[var(--color-txt2)] hover:bg-[var(--color-accent-bg)] rounded-[var(--radius-radius-sm)] transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreatePost}
                    disabled={isSubmitting || (!composerText.trim() && !composerImage)}
                    className="px-4 py-1.5 text-sm font-medium bg-[var(--color-accent)] text-white rounded-[var(--radius-radius-sm)] hover:bg-[var(--color-accent-h)] transition disabled:opacity-50"
                  >
                    {isSubmitting ? 'Posting…' : 'Post'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Posts ── */}
      <div className="space-y-4">
        {posts.length === 0 ? (
          <div className="text-center py-12 text-[var(--color-txt2)]">
            <p>No posts yet. Be the first to share something!</p>
          </div>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onLike={handleLike}
              onComment={handleComment}
              onRepost={handleRepost}
              onShare={handleShare}
            />
          ))
        )}

        {hasMore && (
          <div ref={loadMoreRef} className="text-center py-4 text-[var(--color-txt2)]">
            {loadingMore ? 'Loading more…' : 'Load more'}
          </div>
        )}
        {!hasMore && posts.length > 0 && (
          <p className="text-center text-sm text-[var(--color-txt3)] py-4">You've seen it all! 🎉</p>
        )}
      </div>
    </div>
  );
}

// ── Helper for avatar color ──
function stringToColor(str) {
  if (!str) return '#888';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 55%)`;
}