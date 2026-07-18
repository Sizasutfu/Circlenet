// src/app/feed/FeedClient.jsx
'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import { useFeed } from '@/contexts/FeedContext';
import { useWs } from '@/contexts/WsContext';
import { useGroups } from '@/contexts/GroupsContext';
import PostCard from '@/components/ui/PostCard';
import ArticleCard from '@/components/articles/ArticleCard';
import QuoteModal from '@/components/ui/QuoteModal';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// ─── Helpers ───────────────────────────────────────────────────────────────
function resolveMediaUrl(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';
  return `${base}${url}`;
}

function timeAgo(dateString) {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diff = Math.max(0, now - then);
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);
  if (seconds < 60) return 'just now';
  else if (minutes < 60) return `${minutes}m ago`;
  else if (hours < 24) return `${hours}h ago`;
  else if (days < 7) return `${days}d ago`;
  else if (weeks < 4) return `${weeks}w ago`;
  else if (months < 12) return `${months}mo ago`;
  else return `${years}y ago`;
}

// ─── Uniform avatar placeholder ──────────────────────────────────────────
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

// ─── Toast ──────────────────────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);
  const bgColor = type === 'error' ? 'var(--color-rose)' : 'var(--color-green)';
  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-lg text-white text-sm font-medium"
      style={{ background: bgColor }}
    >
      {message}
    </div>
  );
}

// ─── Skeleton ──────────────────────────────────────────────────────────
function PostCardSkeleton() {
  return (
    <div className="px-4 py-3 border-b border-[var(--color-border)] animate-pulse">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-[var(--color-surface)] flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="h-4 w-24 bg-[var(--color-surface)] rounded" />
              <div className="h-3 w-16 bg-[var(--color-surface)] rounded" />
              <div className="h-3 w-12 bg-[var(--color-surface)] rounded" />
            </div>
            <div className="h-4 w-4 bg-[var(--color-surface)] rounded-full" />
          </div>
          <div className="mt-2 space-y-2">
            <div className="h-4 w-full bg-[var(--color-surface)] rounded" />
            <div className="h-4 w-5/6 bg-[var(--color-surface)] rounded" />
            <div className="h-4 w-3/4 bg-[var(--color-surface)] rounded" />
          </div>
          <div className="mt-3 h-48 w-full bg-[var(--color-surface)] rounded-lg" />
          <div className="mt-3 flex items-center gap-4">
            <div className="h-4 w-12 bg-[var(--color-surface)] rounded" />
            <div className="h-4 w-12 bg-[var(--color-surface)] rounded" />
            <div className="h-4 w-12 bg-[var(--color-surface)] rounded" />
            <div className="h-4 w-12 bg-[var(--color-surface)] rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

function PostSkeletonList({ count = 3 }) {
  return (
    <div className="space-y-0">
      {Array.from({ length: count }).map((_, i) => (
        <PostCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ─── Comment Preview Components ────────────────────────────────────────

/** Single comment preview – small avatar, name, truncated text, time */
function CommentPreview({ comment }) {
  const displayName = comment.author || comment.user?.name || 'Anonymous';
  const username = comment.user?.username || '';
  const avatarUrl = resolveMediaUrl(comment.authorPicture || comment.user?.picture || null);
  const text = comment.text || comment.body || '';
  const truncated = text.length > 80 ? text.slice(0, 80) + '…' : text;
  const time = comment.createdAt ? timeAgo(comment.createdAt) : '';

  return (
    <div className="flex items-start gap-2 py-2 hover:bg-[var(--color-accent-bg)] transition rounded-lg">
      <Link href={`/profile/${username}`} className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        {avatarUrl ? (
          <img src={avatarUrl} alt={displayName} className="h-6 w-6 rounded-full object-cover" />
        ) : (
          <AvatarPlaceholder size="h-6 w-6" />
        )}
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 text-xs">
          <span className="font-semibold text-[var(--color-txt)]">{displayName}</span>
          {username && (
            <span className="text-[var(--color-txt2)]">@{username}</span>
          )}
          <span className="text-[var(--color-txt3)]">· {time}</span>
        </div>
        <p className="text-sm text-[var(--color-txt)] break-words line-clamp-2">{truncated}</p>
      </div>
    </div>
  );
}

/** List of comment previews with a vertical thread line */
function CommentPreviewList({ comments, postId, totalComments }) {
  if (!comments || comments.length === 0) return null;

  const visible = comments.slice(0, 2);
  const remaining = totalComments - visible.length;

  return (
    <div className="ml-12 border-l-2 border-[var(--color-border)] pl-4 mt-1">
      {visible.map((comment) => (
        <CommentPreview key={comment.id} comment={comment} />
      ))}
      {remaining > 0 && (
        <Link
          href={`/post/${postId}`}
          className="block text-sm text-[var(--color-accent)] hover:underline mt-1"
        >
          Show {remaining} more {remaining === 1 ? 'reply' : 'replies'}
        </Link>
      )}
    </div>
  );
}

// ─── Main FeedClient ───────────────────────────────────────────────────
export default function FeedClient({ initialPosts = null }) {
  const { user } = useAuth();
  const router = useRouter();
  const { registerHandler } = useWs();
  const {
    posts,
    loading,
    loadingMore,
    hasMore,
    activeTab,
    error,
    page,
    setActiveTab,
    fetchPosts,
    loadMore,
    updatePostCounts,
    addPost,
    toggleLike,
    initPosts,
    initialized,
  } = useFeed();

  const { groupsList, myGroups } = useGroups();
  const groupMap = useMemo(() => {
    const map = new Map();
    const all = [...myGroups, ...groupsList];
    for (const g of all) {
      if (g.id) {
        map.set(g.id, { id: g.id, topic: g.topic, displayName: g.displayName || `#${g.topic}` });
      }
    }
    return map;
  }, [myGroups, groupsList]);

  const [articles, setArticles] = useState([]);
  const [articlesPage, setArticlesPage] = useState(1);
  const [articlesHasMore, setArticlesHasMore] = useState(false);
  const [articlesLoading, setArticlesLoading] = useState(false);

  const [composerText, setComposerText] = useState('');
  const [composerImage, setComposerImage] = useState(null);
  const [composerImagePreview, setComposerImagePreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const fileInputRef = useRef(null);
  const loadMoreRef = useRef(null);
  const [toast, setToast] = useState(null);
  const [quoteTarget, setQuoteTarget] = useState(null);
  const showToast = (msg, type = 'success') => setToast({ message: msg, type });

  // ── WS: update counts ──
  useEffect(() => {
    const unregister = registerHandler('post_counts', (msg) => {
      updatePostCounts(msg.postId, {
        likes: msg.likes,
        comments: msg.comments,
        reposts: msg.reposts,
      });
    });
    return () => unregister();
  }, [registerHandler, updatePostCounts]);

  // ── Init / fetch ──
  useEffect(() => {
    if (initialPosts && initialPosts.length > 0 && !initialized) {
      initPosts({
        posts: initialPosts,
        hasMore: initialPosts.length === 20,
        page: 1,
      });
    } else if (!initialized && !loading && posts.length === 0 && activeTab !== 'articles') {
      fetchPosts(activeTab, 1, false);
    }
  }, [initialPosts, initPosts, initialized, loading, posts.length, activeTab, fetchPosts]);

  // ── Articles ──
  const fetchArticles = useCallback(async (pageNum = 1, append = false) => {
    if (articlesLoading) return;
    setArticlesLoading(true);
    try {
      const res = await apiClient(`/api/articles?page=${pageNum}&limit=20`);
      const data = res.data || res;
      const newArticles = data.articles || [];
      const total = data.total || 0;
      const hasMoreData = total > pageNum * 20;
      setArticles((prev) => (append ? [...prev, ...newArticles] : newArticles));
      setArticlesHasMore(hasMoreData);
      setArticlesPage(pageNum);
    } catch (err) {
      console.error('Failed to fetch articles:', err);
    } finally {
      setArticlesLoading(false);
    }
  }, [articlesLoading]);

  const handleTabChange = (tab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    if (tab === 'articles') {
      setArticles([]);
      setArticlesPage(1);
      setArticlesHasMore(false);
      if (!articlesLoading) fetchArticles(1, false);
    } else {
      if (!initialized && posts.length === 0 && !loading) {
        fetchPosts(tab, 1, false);
      }
    }
  };

  // ── Infinite scroll observer ──
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          if (activeTab === 'articles') {
            if (articlesHasMore && !articlesLoading) {
              fetchArticles(articlesPage + 1, true);
            }
          } else {
            if (hasMore && !loadingMore) {
              loadMore();
            }
          }
        }
      },
      { threshold: 0.1 }
    );
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [activeTab, articlesHasMore, articlesLoading, hasMore, loadingMore, loadMore, fetchArticles, articlesPage]);

  // ── Interaction handlers ──
  const handleLike = async (postId) => {
    if (!user) { showToast('Log in to like.', 'error'); return; }
    toggleLike(postId);
    try {
      await apiClient(`/api/posts/${postId}/like`, { method: 'POST' });
    } catch (_) {
      toggleLike(postId);
      showToast('Failed to like.', 'error');
    }
  };

  const handleComment = (postId) => {
    if (!user) { showToast('Please log in to comment.', 'error'); return; }
    router.push(`/post/${postId}`);
  };

  const handleRepost = async (postId) => {
    if (!user) { showToast('Log in to repost.', 'error'); return; }
    try {
      await apiClient(`/api/posts/${postId}/repost`, { method: 'POST' });
      showToast('Reposted! 🔁', 'success');
    } catch (_) {
      showToast('Failed to repost.', 'error');
    }
  };

  const handleQuote = (postId) => {
    if (!user) {
      showToast('Please log in to quote.', 'error');
      return;
    }
    const post = posts.find((p) => p.id === postId);
    if (post) setQuoteTarget(post);
  };

  const handleQuoteSuccess = () => {
    setQuoteTarget(null);
    showToast('Quote posted! 🎉', 'success');
    fetchPosts(activeTab, 1, false);
  };

  const handleShare = (postId) => {
    const url = `${window.location.origin}/post/${postId}`;
    if (navigator.share) {
      navigator.share({ title: 'Check this post', url });
    } else {
      navigator.clipboard.writeText(url).then(() => showToast('Link copied!', 'success'));
    }
  };

  // ── Compose post ──
  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!user) { showToast('Please log in to post.', 'error'); return; }
    if (!composerText.trim() && !composerImage) {
      showToast('Please write something or add an image.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('text', composerText.trim());
      if (composerImage) formData.append('image', composerImage);
      const data = await apiClient('/api/posts', { method: 'POST', body: formData });
      const newPost = data.data || data;
      const optimisticPost = {
        id: newPost.id || Date.now(),
        text: composerText.trim(),
        image: newPost.image || null,
        createdAt: new Date().toISOString(),
        likes: [],
        commentCount: 0,
        repostCount: 0,
        user: { id: user.id, name: user.name, username: user.username, picture: user.picture },
        recentComments: [],
      };
      addPost(optimisticPost);
      setComposerText('');
      setComposerImage(null);
      setComposerImagePreview(null);
      setIsExpanded(false);
      showToast('Post created! 🎉', 'success');
    } catch (err) {
      console.error('Failed to create post:', err);
      showToast(err.message || 'Failed to create post.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

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

  // ── Render content ──
  const renderContent = () => {
    if (activeTab === 'articles') {
      if (articlesLoading && articles.length === 0) {
        return (
          <div className="space-y-0">
            {[1, 2, 3].map((i) => (
              <div key={i} className="px-4 py-3 border-b border-[var(--color-border)] animate-pulse">
                <div className="flex gap-4">
                  <div className="sm:w-48 h-32 bg-[var(--color-surface)] rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/3 bg-[var(--color-surface)] rounded" />
                    <div className="h-4 w-3/4 bg-[var(--color-surface)] rounded" />
                    <div className="h-3 w-full bg-[var(--color-surface)] rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      }
      if (articles.length === 0) return <p className="text-center text-[var(--color-txt2)] py-8">No articles yet.</p>;
      return (
        <div className="space-y-0">
          {articles.map((article) => <ArticleCard key={article.id} article={article} />)}
          {articlesHasMore && (
            <div ref={loadMoreRef} className="text-center py-4 text-[var(--color-txt2)]">
              {articlesLoading ? 'Loading more…' : 'Load more'}
            </div>
          )}
        </div>
      );
    }

    // ── Posts feed ──
    if (loading && posts.length === 0) {
      return <PostSkeletonList count={3} />;
    }

    if (error && posts.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-[var(--color-rose)]">{error}</p>
          <button
            onClick={() => fetchPosts(activeTab, 1, false)}
            className="mt-4 px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg"
          >
            Retry
          </button>
        </div>
      );
    }

    // Determine if we should show previews for this page
    // Only pages 1 and 2 get comment previews (first 40 posts)
    const showPreviews = page <= 2 && user;

    return (
      <div className="space-y-0">
        {posts.length === 0 ? (
          <div className="text-center py-8 text-[var(--color-txt2)]">
            <p>No posts yet. Be the first to share something!</p>
            {!user && (
              <Link href="/login" className="inline-block mt-4 px-4 py-2 bg-[var(--color-accent)] text-white rounded-full text-sm">
                Log in to post
              </Link>
            )}
          </div>
        ) : (
          posts.map((post, index) => {
            // Only show previews for the first 40 posts (page 1 and 2)
            const shouldShowPreview = showPreviews && index < 40;
            // Use server‑provided recentComments (already filtered to followed accounts)
            const recentComments = post.recentComments || [];
            const totalComments = post.commentCount || 0;

            return (
              <div key={post.id}>
                <PostCard
                  post={post}
                  groupMap={groupMap}
                  onLike={handleLike}
                  onComment={handleComment}
                  onRepost={handleRepost}
                  onShare={handleShare}
                  onQuote={handleQuote}
                />
                {/* Comment preview with thread line – only if we should show and there are recent comments */}
                {shouldShowPreview && recentComments.length > 0 && (
                  <CommentPreviewList
                    comments={recentComments}
                    postId={post.id}
                    totalComments={totalComments}
                  />
                )}
              </div>
            );
          })
        )}
        {hasMore && (
          <div ref={loadMoreRef} className="text-center py-4 text-[var(--color-txt2)]">
            {loadingMore ? <PostSkeletonList count={2} /> : 'Load more'}
          </div>
        )}
        {!hasMore && posts.length > 0 && (
          <p className="text-center text-sm text-[var(--color-txt3)] py-4">You've seen it all! 🎉</p>
        )}
      </div>
    );
  };

  // ─── Main render ──────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {user && activeTab !== 'articles' && (
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-[var(--radius-radius)] p-4 mb-6 shadow-sm mx-4">
          <div className="flex items-start gap-3">
            {/* ─── Composer avatar ───────────────────────────────────── */}
            <div className="flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm">
              {user?.picture ? (
                <img src={resolveMediaUrl(user.picture)} alt={user.name} className="w-full h-full rounded-full object-cover" />
              ) : (
                <AvatarPlaceholder size="h-10 w-10" />
              )}
            </div>
            <div className="flex-1">
              <textarea
                value={composerText}
                onChange={(e) => { setComposerText(e.target.value); if (e.target.value.trim()) setIsExpanded(true); }}
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
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
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
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="M21 15l-5-5L5 21" />
                      </svg>
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
      )}

      <div className="flex gap-2 mb-6 border-b border-[var(--color-border)] px-4">
        <button
          onClick={() => handleTabChange('global')}
          className={`pb-2 px-3 text-sm font-medium transition border-b-2 ${
            activeTab === 'global'
              ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
              : 'border-transparent text-[var(--color-txt2)] hover:text-[var(--color-txt)]'
          }`}
        >
          Global
        </button>
        {user && (
          <button
            onClick={() => handleTabChange('following')}
            className={`pb-2 px-3 text-sm font-medium transition border-b-2 ${
              activeTab === 'following'
                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'border-transparent text-[var(--color-txt2)] hover:text-[var(--color-txt)]'
            }`}
          >
            Following
          </button>
        )}
        <button
          onClick={() => handleTabChange('articles')}
          className={`pb-2 px-3 text-sm font-medium transition border-b-2 ${
            activeTab === 'articles'
              ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
              : 'border-transparent text-[var(--color-txt2)] hover:text-[var(--color-txt)]'
          }`}
        >
          Articles
        </button>
      </div>

      {renderContent()}

      {quoteTarget && (
        <QuoteModal
          post={quoteTarget}
          onClose={() => setQuoteTarget(null)}
          onSuccess={handleQuoteSuccess}
        />
      )}
    </div>
  );
}