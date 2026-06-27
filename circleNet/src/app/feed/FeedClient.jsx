// src/app/feed/FeedClient.jsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import PostCard from '@/components/ui/PostCard';
import ArticleCard from '@/components/articles/ArticleCard';
import { useRouter } from 'next/navigation';

function resolveMediaUrl(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';
  return `${base}${url}`;
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

export default function FeedClient() {
  const { user } = useAuth();
  const router = useRouter();

  // ── Tab state ──
  const [activeTab, setActiveTab] = useState('global'); // 'global' | 'following' | 'articles'

  // ── Posts state ──
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  // ── Articles state ──
  const [articles, setArticles] = useState([]);
  const [articlesPage, setArticlesPage] = useState(1);
  const [articlesHasMore, setArticlesHasMore] = useState(false);
  const [articlesLoading, setArticlesLoading] = useState(false);

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
      const feedTab = activeTab === 'following' ? 'following' : 'global';
      const response = await apiClient(`/api/posts?feed=${feedTab}&page=${pageNum}&limit=20`);
      let postsData = [];
      let hasMoreData = false;
      if (response?.data?.posts) {
        postsData = response.data.posts;
        hasMoreData = response.data.pagination?.hasMore || postsData.length === 20;
      } else if (Array.isArray(response?.data)) {
        postsData = response.data;
        hasMoreData = postsData.length === 20;
      } else if (Array.isArray(response)) {
        postsData = response;
        hasMoreData = postsData.length === 20;
      }
      const postsWithUser = postsData.map((p) => ({
        ...p,
        user: p.user || { name: p.author || 'Unknown', username: p.authorUsername || '', picture: p.authorPicture || null },
      }));
      setPosts((prev) => (append ? [...prev, ...postsWithUser] : postsWithUser));
      setHasMore(hasMoreData);
      setPage(pageNum);
    } catch (err) {
      console.error('Failed to fetch posts:', err);
      setError('Could not load posts. Please try again.');
      if (pageNum === 1) {
        setPosts([
          { id: 1, text: 'Welcome to Circlenet! 🎉', createdAt: new Date().toISOString(), likes: [], comments: [], user: { name: 'Circlenet', username: 'circlenet', picture: null } },
        ]);
        setHasMore(false);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [activeTab]);

  // ── Fetch articles ──
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

  // ── Load more (universal) ──
  const loadMore = useCallback(() => {
    if (activeTab === 'articles') {
      if (!articlesHasMore || articlesLoading) return;
      fetchArticles(articlesPage + 1, true);
    } else {
      if (!hasMore || loadingMore) return;
      fetchPosts(page + 1, true);
    }
  }, [activeTab, articlesHasMore, articlesLoading, articlesPage, fetchArticles, hasMore, loadingMore, page, fetchPosts]);

  // ── Initial load ──
  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (activeTab === 'articles') {
      if (articles.length === 0 && !articlesLoading) fetchArticles(1, false);
    } else {
      fetchPosts(1, false);
    }
  }, [user, router, activeTab]);

  // ── Intersection Observer ──
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          if (activeTab === 'articles') {
            if (articlesHasMore && !articlesLoading) loadMore();
          } else {
            if (hasMore && !loadingMore) loadMore();
          }
        }
      },
      { threshold: 0.1 }
    );
    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }
    return () => observer.disconnect();
  }, [activeTab, articlesHasMore, articlesLoading, hasMore, loadingMore, loadMore]);

  // ── Toast ──
  const [toast, setToast] = useState(null);
  const showToast = (msg, type = 'success') => setToast({ message: msg, type });

  // ── Like, comment, repost, share ──
  const handleLike = async (postId) => { /* existing like logic */ };
  const handleComment = (postId) => showToast('Comment feature coming soon!', 'success');
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
      navigator.clipboard.writeText(url).then(() => showToast('Link copied!', 'success'));
    }
  };

  // ── Create post ──
  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!user) return;
    if (!composerText.trim() && !composerImage) {
      showToast('Please write something or add an image.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('text', composerText.trim());
      if (composerImage) formData.append('image', composerImage);
      const token = localStorage.getItem('circle_token');
      const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';
      const res = await fetch(`${baseURL}/api/posts`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to create post');
      }
      const newPostData = await res.json();
      const newPost = newPostData.data || newPostData;
      const optimisticPost = {
        id: newPost.id || Date.now(),
        text: composerText.trim(),
        image: newPost.image || null,
        createdAt: new Date().toISOString(),
        likes: [],
        comments: [],
        user: { id: user.id, name: user.name, username: user.username, picture: user.picture },
      };
      setPosts((prev) => [optimisticPost, ...prev]);
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

  // ── Render ──
  if (!user) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center text-[var(--color-txt2)]">
        <p>Please log in to see the feed.</p>
      </div>
    );
  }

  if (loading && activeTab !== 'articles') {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center text-[var(--color-txt2)]">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-accent)] border-t-transparent" />
        <p className="mt-4">Loading feed…</p>
      </div>
    );
  }

  if (error && activeTab !== 'articles') {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center text-[var(--color-txt2)]">
        <p className="text-[var(--color-rose)]">{error}</p>
        <button onClick={() => fetchPosts(1, false)} className="mt-4 px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg">
          Retry
        </button>
      </div>
    );
  }

  const renderContent = () => {
    if (activeTab === 'articles') {
      if (articlesLoading && articles.length === 0) {
        return (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 border border-[var(--color-border)] rounded-xl bg-[var(--color-card)] animate-pulse">
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
      if (articles.length === 0) {
        return <p className="text-center text-[var(--color-txt2)] py-8">No articles yet.</p>;
      }
      return (
        <div className="space-y-4">
          {articles.map((article) => <ArticleCard key={article.id} article={article} />)}
          {articlesHasMore && (
            <div ref={loadMoreRef} className="text-center py-4 text-[var(--color-txt2)]">
              {articlesLoading ? 'Loading more…' : 'Load more'}
            </div>
          )}
        </div>
      );
    }

    // Posts feed
    return (
      <div className="space-y-4">
        {posts.length === 0 ? (
          <p className="text-center text-[var(--color-txt2)] py-8">No posts yet. Be the first to share something!</p>
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
    );
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* ── Composer ── */}
      {activeTab !== 'articles' && (
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-[var(--radius-radius)] p-4 mb-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div
              className="flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
              style={{
                background: user?.picture ? 'transparent' : stringToColor(user?.name || ''),
              }}
            >
              {user?.picture ? <img src={resolveMediaUrl(user.picture)} alt={user.name} className="w-full h-full rounded-full object-cover" /> : user?.name?.charAt(0)?.toUpperCase() || '?'}
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
                  <button onClick={removeImage} className="absolute -top-2 -right-2 bg-[var(--color-rose)] text-white rounded-full p-1 hover:bg-[var(--color-rose)]/80 transition">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                </div>
              )}
              {isExpanded && (
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--color-border)]">
                  <div className="flex gap-2">
                    <button type="button" onClick={() => fileInputRef.current.click()} className="text-[var(--color-txt2)] hover:text-[var(--color-accent)] transition">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
                      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageSelect} />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setIsExpanded(false); setComposerText(''); removeImage(); }} className="px-4 py-1.5 text-sm text-[var(--color-txt2)] hover:bg-[var(--color-accent-bg)] rounded-[var(--radius-radius-sm)] transition">
                      Cancel
                    </button>
                    <button onClick={handleCreatePost} disabled={isSubmitting || (!composerText.trim() && !composerImage)} className="px-4 py-1.5 text-sm font-medium bg-[var(--color-accent)] text-white rounded-[var(--radius-radius-sm)] hover:bg-[var(--color-accent-h)] transition disabled:opacity-50">
                      {isSubmitting ? 'Posting…' : 'Post'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex gap-2 mb-6 border-b border-[var(--color-border)]">
        {['global', 'following', 'articles'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-2 px-3 text-sm font-medium transition border-b-2 ${activeTab === tab ? 'border-[var(--color-accent)] text-[var(--color-accent)]' : 'border-transparent text-[var(--color-txt2)] hover:text-[var(--color-txt)]'}`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      {renderContent()}
    </div>
  );
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