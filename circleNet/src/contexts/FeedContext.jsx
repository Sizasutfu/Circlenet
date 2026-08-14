// src/contexts/FeedContext.jsx
'use client';

import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const FeedContext = createContext();

function dedupePosts(posts) {
  const seen = new Set();
  return posts.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}

export function FeedProvider({ children }) {
  const { user: currentUser } = useAuth();
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeTab, setActiveTab] = useState('global');
  const [error, setError] = useState(null);
  const [initialized, setInitialized] = useState(false);

  // ── Initialize posts from server (SSR) ──
  const initPosts = useCallback(({ posts: initialPosts, hasMore: initialHasMore, page: initialPage = 1 }) => {
    if (!initialPosts || !initialPosts.length) {
      setInitialized(true);
      return;
    }
    const postsWithUser = initialPosts.map((p) => ({
      ...p,
      user: p.user || { name: p.author || 'Unknown', username: p.authorUsername || '', picture: p.authorPicture || null },
      commentCount: p.commentCount ?? (p.comments ? p.comments.length : 0),
      repostCount: p.repostCount ?? (p.reposts ? p.reposts.length : 0),
    }));
    setPosts(dedupePosts(postsWithUser));
    setHasMore(initialHasMore);
    setPage(initialPage);
    setInitialized(true);
  }, []);

  // ── Fetch posts (client-side) ──
  const fetchPosts = useCallback(async (tab, pageNum = 1, append = false) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);
    setError(null);
    try {
      const feedTab = tab === 'following' ? 'following' : 'global';
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
      if (!Array.isArray(postsData)) postsData = [];
      const postsWithUser = postsData.map((p) => ({
        ...p,
        user: p.user || { name: p.author || 'Unknown', username: p.authorUsername || '', picture: p.authorPicture || null },
        commentCount: p.commentCount ?? (p.comments ? p.comments.length : 0),
        repostCount: p.repostCount ?? (p.reposts ? p.reposts.length : 0),
      }));
      setPosts((prev) => {
        const combined = append ? [...prev, ...postsWithUser] : postsWithUser;
        return dedupePosts(combined);
      });
      setHasMore(hasMoreData);
      setPage(pageNum);
    } catch (err) {
      console.error('Failed to fetch posts:', err);
      setError('Could not load posts. Please try again.');
      if (pageNum === 1) {
        setPosts([]);
        setHasMore(false);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore) return;
    fetchPosts(activeTab, page + 1, true);
  }, [activeTab, hasMore, loadingMore, page, fetchPosts]);

  // ── Update counts via WebSocket (likes, comments, reposts) ──
  const updatePostCounts = useCallback((postId, { likes, comments, reposts }) => {
    setPosts((prev) => {
      return prev.map((p) => {
        if (p.id !== postId) return p;
        const updated = { ...p };
        
        if (likes !== undefined) {
          // Update like count while preserving the likes array
          updated.likeCount = likes;
          // If we have a likes array, keep it, otherwise create one
          if (!updated.likes) {
            updated.likes = [];
          }
        }
        
        if (comments !== undefined) {
          updated.commentCount = comments;
        }
        
        if (reposts !== undefined) {
          updated.repostCount = reposts;
          if (!updated.reposts) {
            updated.reposts = [];
          }
        }
        
        return updated;
      });
    });
  }, []);

  // ── Update post interactions (likes/reposts with user lists) ──
  const updatePostInteractions = useCallback((postId, data) => {
    setPosts((prev) => {
      return prev.map((p) => {
        if (p.id !== postId) return p;
        const updated = { ...p };
        
        // Update likes
        if (data.likes !== undefined) {
          updated.likeCount = data.likes;
          if (data.userIds !== undefined) {
            updated.likes = data.userIds;
          }
        }
        
        // Update reposts
        if (data.reposts !== undefined) {
          updated.repostCount = data.reposts;
          if (data.repostUserIds !== undefined) {
            updated.reposts = data.repostUserIds;
          }
        }
        
        return updated;
      });
    });
  }, []);

  // ── Toggle like (optimistic) ──
  const toggleLike = useCallback((postId) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const userId = currentUser?.id;
        if (!userId) return p;
        
        const isLiked = p.likes?.some((id) => id === userId) || false;
        const newLikes = isLiked
          ? (p.likes || []).filter((id) => id !== userId)
          : [...(p.likes || []), userId];
        
        return { 
          ...p, 
          likes: newLikes,
          likeCount: newLikes.length,
        };
      })
    );
  }, [currentUser]);

  // ── Add a new post ──
  const addPost = useCallback((newPost) => {
    setPosts((prev) => dedupePosts([newPost, ...prev]));
  }, []);

  // ── Reset feed ──
  const resetFeed = useCallback((tab) => {
    if (tab !== undefined) setActiveTab(tab);
  }, []);

  const value = {
    posts,
    page,
    hasMore,
    loading,
    loadingMore,
    activeTab,
    error,
    initialized,
    setActiveTab,
    fetchPosts,
    loadMore,
    resetFeed,
    updatePostCounts,
    updatePostInteractions,
    addPost,
    toggleLike,
    initPosts,
  };

  return <FeedContext.Provider value={value}>{children}</FeedContext.Provider>;
}

export function useFeed() {
  const context = useContext(FeedContext);
  if (!context) throw new Error('useFeed must be used within a FeedProvider');
  return context;
}