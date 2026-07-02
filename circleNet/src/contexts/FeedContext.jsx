// src/contexts/FeedContext.jsx
'use client';

import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api';

const FeedContext = createContext();

export function FeedProvider({ children }) {
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeTab, setActiveTab] = useState('global');
  const [error, setError] = useState(null);
  const feedKeyRef = useRef(null);

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
      }));
      setPosts((prev) => (append ? [...prev, ...postsWithUser] : postsWithUser));
      setHasMore(hasMoreData);
      setPage(pageNum);
      feedKeyRef.current = `${tab}-${pageNum}`;
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
    setActiveTab,
    fetchPosts,
    loadMore,
    resetFeed,
  };

  return <FeedContext.Provider value={value}>{children}</FeedContext.Provider>;
}

export function useFeed() {
  const context = useContext(FeedContext);
  if (!context) throw new Error('useFeed must be used within a FeedProvider');
  return context;
}