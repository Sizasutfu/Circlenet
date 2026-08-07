import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { Alert } from 'react-native';
// Remove AsyncStorage import if not using it yet
// import AsyncStorage from '@react-native-async-storage/async-storage';

// Types
export interface User {
  id: string;
  name: string;
  username: string;
  picture?: string | null;
  verified?: boolean;
}

export interface Post {
  id: string;
  text: string;
  image?: string | null;
  video?: string | null;
  createdAt: string;
  user: User;
  likes: string[];
  commentCount: number;
  repostCount: number;
  shares?: number;
  viewCount?: number;
  isLive?: boolean;
  liveSessionId?: string | null;
  isRepost?: boolean;
  originalPost?: Post | null;
  groupId?: string | null;
  recentComments?: Comment[];
  liked?: boolean;
  // Add these for backward compatibility
  author?: string;
  authorUsername?: string;
  authorPicture?: string | null;
}

export interface Comment {
  id: string;
  text: string;
  author: string;
  user?: User;
  createdAt: string;
  authorPicture?: string | null;
}

interface FeedContextType {
  posts: Post[];
  page: number;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  activeTab: 'global' | 'following' | 'articles';
  error: string | null;
  initialized: boolean;
  setActiveTab: (tab: 'global' | 'following' | 'articles') => void;
  fetchPosts: (tab: string, pageNum?: number, append?: boolean) => Promise<void>;
  loadMore: () => void;
  toggleLike: (postId: string) => void;
  addPost: (post: Post) => void;
  initPosts: (data: { posts: Post[]; hasMore: boolean; page?: number }) => void;
}

const FeedContext = createContext<FeedContextType | undefined>(undefined);

// Helper to deduplicate posts
function dedupePosts(posts: Post[]): Post[] {
  const seen = new Set();
  return posts.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}

export function FeedProvider({ children }: { children: ReactNode }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeTab, setActiveTab] = useState<'global' | 'following' | 'articles'>('global');
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Mock current user - replace with actual auth
  const currentUser = { id: 'user1', name: 'You', username: 'you' };

  // Mock API call - replace with actual API
  const fetchPostsFromAPI = async (tab: string, pageNum: number): Promise<{ posts: Post[]; hasMore: boolean }> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Generate mock posts
    const mockPosts: Post[] = Array.from({ length: 10 }, (_, i) => ({
      id: `post_${pageNum}_${i}`,
      text: `This is post ${(pageNum - 1) * 10 + i + 1} in the ${tab} feed. ${['Great content!', 'Awesome!', 'Check this out!', 'Interesting...', 'Wow!', 'Nice!', 'Cool!', 'Amazing!', 'Fantastic!', 'Love this!'][i % 10]}`,
      image: i % 3 === 0 ? `https://picsum.photos/seed/${pageNum}_${i}/400/300` : null,
      video: null,
      createdAt: new Date(Date.now() - i * 3600000).toISOString(),
      user: {
        id: `user_${i % 5}`,
        name: ['Alex Johnson', 'Sarah Chen', 'Marcus Rivera', 'Emma Wilson', 'John Doe'][i % 5],
        username: ['@alexj', '@sarahc', '@marcusr', '@emmaw', '@johnd'][i % 5],
        picture: `https://i.pravatar.cc/150?img=${i + 1}`,
        verified: i % 2 === 0,
      },
      likes: Array.from({ length: Math.floor(Math.random() * 50) }, (_, j) => `user_${j}`),
      commentCount: Math.floor(Math.random() * 20),
      repostCount: Math.floor(Math.random() * 10),
      shares: Math.floor(Math.random() * 5),
      viewCount: Math.floor(Math.random() * 100),
      recentComments: [],
      liked: false,
    }));

    return {
      posts: mockPosts,
      hasMore: pageNum < 5,
    };
  };

  const initPosts = useCallback(({ posts: initialPosts, hasMore: initialHasMore, page: initialPage = 1 }: {
    posts: Post[];
    hasMore: boolean;
    page?: number;
  }) => {
    if (!initialPosts || !initialPosts.length) {
      setInitialized(true);
      return;
    }
    setPosts(dedupePosts(initialPosts));
    setHasMore(initialHasMore);
    setPage(initialPage);
    setInitialized(true);
  }, []);

  const fetchPosts = useCallback(async (tab: string, pageNum: number = 1, append: boolean = false) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);
    setError(null);
    
    try {
      const response = await fetchPostsFromAPI(tab, pageNum);
      const postsWithUser = response.posts.map((p) => ({
        ...p,
        user: p.user || { 
          id: 'unknown', 
          name: p.author || 'Unknown', 
          username: p.authorUsername || '', 
          picture: p.authorPicture || null 
        },
        commentCount: p.commentCount ?? (p.recentComments ? p.recentComments.length : 0),
      }));
      
      setPosts((prev) => {
        const combined = append ? [...prev, ...postsWithUser] : postsWithUser;
        return dedupePosts(combined);
      });
      setHasMore(response.hasMore);
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

  const toggleLike = useCallback((postId: string) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const isLiked = p.liked || (p.likes && currentUser && p.likes.some((id) => id === currentUser.id));
        const newLikes = isLiked
          ? p.likes.filter((id) => id !== currentUser.id)
          : [...(p.likes || []), currentUser.id];
        return { 
          ...p, 
          likes: newLikes, 
          liked: !isLiked,
        };
      })
    );
  }, [currentUser]);

  const addPost = useCallback((newPost: Post) => {
    setPosts((prev) => dedupePosts([newPost, ...prev]));
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
    toggleLike,
    addPost,
    initPosts,
  };

  return <FeedContext.Provider value={value}>{children}</FeedContext.Provider>;
}

export function useFeed() {
  const context = useContext(FeedContext);
  if (!context) throw new Error('useFeed must be used within a FeedProvider');
  return context;
}