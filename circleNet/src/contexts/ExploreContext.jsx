// src/contexts/ExploreContext.jsx
'use client';

import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';

const ExploreContext = createContext();

export function ExploreProvider({ children }) {
  const { user } = useAuth();

  // ── Topics ──
  const [topics, setTopics] = useState([]);
  const [topicsLoading, setTopicsLoading] = useState(false);

  // ── People ──
  const [people, setPeople] = useState([]);
  const [peopleLoading, setPeopleLoading] = useState(false);

  // ── Trending ──
  const [trending, setTrending] = useState([]);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [trendingCategory, setTrendingCategory] = useState('all');
  const [trendingSort, setTrendingSort] = useState('hot');

  // ── New Members ──
  const [newMembers, setNewMembers] = useState([]);
  const [newMembersLoading, setNewMembersLoading] = useState(false);

  // ── Topic Feed ──
  const [currentTopic, setCurrentTopic] = useState(null);
  const [topicPosts, setTopicPosts] = useState([]);
  const [topicHasMore, setTopicHasMore] = useState(false);
  const [topicPage, setTopicPage] = useState(1);
  const [topicLoading, setTopicLoading] = useState(false);

  // ── Load Topics ──
  const loadTopics = useCallback(async () => {
    if (topicsLoading) return;
    setTopicsLoading(true);
    try {
      const res = await apiClient('/api/topics?limit=20');
      const data = res.data || [];
      setTopics(data);
    } catch (err) {
      console.error('Failed to load topics:', err);
    } finally {
      setTopicsLoading(false);
    }
  }, [topicsLoading]);

  // ── Load People (recommendations) ──
  const loadPeople = useCallback(async () => {
    if (!user || peopleLoading) return;
    setPeopleLoading(true);
    try {
      const res = await apiClient(`/api/recommendations?userId=${user.id}&limit=12`);
      const data = res.data || [];
      setPeople(data);
    } catch (err) {
      console.error('Failed to load people:', err);
    } finally {
      setPeopleLoading(false);
    }
  }, [user, peopleLoading]);

  // ── Load Trending ──
  const loadTrending = useCallback(async () => {
    if (trendingLoading) return;
    setTrendingLoading(true);
    try {
      const res = await apiClient('/api/explore/trending');
      const data = res.data || [];
      // Ensure likes/reposts/comments are arrays
      data.forEach((post) => {
        post.likes = Array.isArray(post.likes) ? post.likes : [];
        post.reposts = Array.isArray(post.reposts) ? post.reposts : [];
        post.comments = Array.isArray(post.comments) ? post.comments : [];
      });
      setTrending(data);
    } catch (err) {
      console.error('Failed to load trending:', err);
    } finally {
      setTrendingLoading(false);
    }
  }, [trendingLoading]);

  // ── Load New Members ──
  const loadNewMembers = useCallback(async () => {
    if (!user || newMembersLoading) return;
    setNewMembersLoading(true);
    try {
      const res = await apiClient('/api/users/new-members?limit=20');
      const data = (res.data || []).filter((u) => {
        if (u.id === user.id) return false;
        const days = Math.floor((Date.now() - new Date(u.createdAt).getTime()) / 86400000);
        return days <= 3;
      });
      setNewMembers(data);
    } catch (err) {
      console.error('Failed to load new members:', err);
    } finally {
      setNewMembersLoading(false);
    }
  }, [user, newMembersLoading]);

  // ── Load Topic Feed ──
  const loadTopicFeed = useCallback(async (topic, page = 1, append = false) => {
    if (topicLoading) return;
    setTopicLoading(true);
    try {
      const res = await apiClient(`/api/topics/${encodeURIComponent(topic)}/posts?page=${page}`);
      const { posts: newPosts, hasMore } = res.data || { posts: [], hasMore: false };
      setTopicPosts((prev) => (append ? [...prev, ...newPosts] : newPosts));
      setTopicHasMore(hasMore);
      setTopicPage(page + 1);
      setCurrentTopic(topic);
    } catch (err) {
      console.error('Failed to load topic feed:', err);
    } finally {
      setTopicLoading(false);
    }
  }, [topicLoading]);

  // ── Follow topic ──
  const followTopic = useCallback(async (topic) => {
    if (!user) return;
    try {
      await apiClient(`/api/topics/${encodeURIComponent(topic)}/follow`, { method: 'POST' });
    } catch (_) {}
  }, [user]);

  // ── Filter trending ──
  const getFilteredTrending = useCallback(() => {
    let items = [...trending];

    switch (trendingCategory) {
      case 'popular':
        items = items.filter((p) => (p.likes?.length || 0) > 0);
        break;
      case 'discussed':
        items = items.filter((p) => (p.comments?.length || 0) > 0);
        break;
      case 'shared':
        items = items.filter((p) => (p.reposts?.length || 0) > 0);
        break;
      case 'media':
        items = items.filter((p) => !!p.image);
        break;
      default:
        break;
    }

    switch (trendingSort) {
      case 'hot':
        items.sort((a, b) => {
          const engA = (a.likes?.length || 0) * 3 + (a.comments?.length || 0) * 2 + (a.reposts?.length || 0) * 2;
          const engB = (b.likes?.length || 0) * 3 + (b.comments?.length || 0) * 2 + (b.reposts?.length || 0) * 2;
          const ageA = Date.now() - new Date(a.createdAt).getTime();
          const ageB = Date.now() - new Date(b.createdAt).getTime();
          return (engB / (1 + ageB / 3600000)) - (engA / (1 + ageA / 3600000));
        });
        break;
      case 'newest':
        items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
      case 'top':
        items.sort((a, b) => {
          const eA = (a.likes?.length || 0) + (a.comments?.length || 0) + (a.reposts?.length || 0);
          const eB = (b.likes?.length || 0) + (b.comments?.length || 0) + (b.reposts?.length || 0);
          return eB - eA;
        });
        break;
      default:
        break;
    }

    return items;
  }, [trending, trendingCategory, trendingSort]);

  const value = {
    topics,
    topicsLoading,
    people,
    peopleLoading,
    trending,
    trendingLoading,
    trendingCategory,
    trendingSort,
    newMembers,
    newMembersLoading,
    currentTopic,
    topicPosts,
    topicHasMore,
    topicPage,
    topicLoading,
    loadTopics,
    loadPeople,
    loadTrending,
    loadNewMembers,
    loadTopicFeed,
    followTopic,
    getFilteredTrending,
    setTrendingCategory,
    setTrendingSort,
  };

  return <ExploreContext.Provider value={value}>{children}</ExploreContext.Provider>;
}

export function useExplore() {
  const context = useContext(ExploreContext);
  if (!context) {
    throw new Error('useExplore must be used within an ExploreProvider');
  }
  return context;
}