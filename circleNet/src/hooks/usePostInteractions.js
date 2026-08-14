// src/hooks/usePostInteractions.js
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useWs } from '@/contexts/WsContext';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';

// Match the server's message types
const WS_TYPES = {
  LIKE_UPDATE: 'like_update',
  REPOST_UPDATE: 'repost_update',
  COMMENT_UPDATE: 'comment_update',
  POST_COUNTS: 'post_counts',
};

export function usePostInteractions(postId) {
  const { user } = useAuth();
  const { registerHandler, sendMessage, isAlive } = useWs();
  
  const [likeState, setLikeState] = useState({
    count: 0,
    liked: false,
    userIds: [],
  });
  
  const [repostState, setRepostState] = useState({
    count: 0,
    reposted: false,
    userIds: [],
  });
  
  const [commentCount, setCommentCount] = useState(0);
  
  const pendingOperations = useRef(new Map());
  const isMounted = useRef(true);
  const initialSyncDone = useRef(false);

  // Register WebSocket handlers
  useEffect(() => {
    if (!postId) return;
    
    const handleLikeUpdate = (msg) => {
      if (!isMounted.current) return;
      const { postId: msgPostId, count, userIds } = msg;
      if (msgPostId !== postId) return;
      
      setLikeState(prev => ({
        count: count ?? prev.count,
        liked: userIds?.includes(user?.id) ?? prev.liked,
        userIds: userIds ?? prev.userIds,
      }));
    };
    
    const handleRepostUpdate = (msg) => {
      if (!isMounted.current) return;
      const { postId: msgPostId, count, userIds } = msg;
      if (msgPostId !== postId) return;
      
      setRepostState(prev => ({
        count: count ?? prev.count,
        reposted: userIds?.includes(user?.id) ?? prev.reposted,
        userIds: userIds ?? prev.userIds,
      }));
    };
    
    const handleCommentUpdate = (msg) => {
      if (!isMounted.current) return;
      const { postId: msgPostId, count } = msg;
      if (msgPostId !== postId) return;
      setCommentCount(count);
    };
    
    const handlePostCounts = (msg) => {
      if (!isMounted.current) return;
      const { postId: msgPostId, likes, comments, reposts } = msg;
      if (msgPostId !== postId) return;
      
      setLikeState(prev => ({
        ...prev,
        count: likes ?? prev.count,
      }));
      setRepostState(prev => ({
        ...prev,
        count: reposts ?? prev.count,
      }));
      if (comments !== undefined) {
        setCommentCount(comments);
      }
    };
    
    // Register handlers
    const unsubLike = registerHandler(WS_TYPES.LIKE_UPDATE, handleLikeUpdate);
    const unsubRepost = registerHandler(WS_TYPES.REPOST_UPDATE, handleRepostUpdate);
    const unsubComment = registerHandler(WS_TYPES.COMMENT_UPDATE, handleCommentUpdate);
    const unsubCounts = registerHandler(WS_TYPES.POST_COUNTS, handlePostCounts);
    
    return () => {
      isMounted.current = false;
      if (unsubLike) unsubLike();
      if (unsubRepost) unsubRepost();
      if (unsubComment) unsubComment();
      if (unsubCounts) unsubCounts();
    };
  }, [postId, user?.id, registerHandler]);

  // Toggle like
  const toggleLike = useCallback(async () => {
    if (!user) return;
    
    const newLiked = !likeState.liked;
    const newCount = newLiked ? likeState.count + 1 : likeState.count - 1;
    
    // Optimistic update
    setLikeState(prev => ({
      ...prev,
      liked: newLiked,
      count: newCount,
      userIds: newLiked 
        ? [...prev.userIds, user.id] 
        : prev.userIds.filter(id => id !== user.id),
    }));
    
    try {
      const response = await apiClient(`/api/posts/${postId}/like`, {
        method: 'POST',
        body: { liked: newLiked }
      });
      
      const data = response.data || response;
      
      // The server will broadcast the update via WebSocket
      // No need to manually send message - the server does it
      
      // If the server response has updated data, sync it
      if (data.likes !== undefined) {
        setLikeState(prev => ({
          ...prev,
          count: data.likes,
        }));
      }
      
    } catch (error) {
      // Revert on error
      setLikeState(prev => ({
        ...prev,
        liked: !newLiked,
        count: prev.count - (newLiked ? 1 : -1),
        userIds: newLiked 
          ? prev.userIds.filter(id => id !== user.id)
          : [...prev.userIds, user.id],
      }));
      console.error('Failed to toggle like:', error);
    }
  }, [postId, user, likeState]);

  // Toggle repost
  const toggleRepost = useCallback(async () => {
    if (!user) return;
    
    const newReposted = !repostState.reposted;
    const newCount = newReposted ? repostState.count + 1 : repostState.count - 1;
    
    // Optimistic update
    setRepostState(prev => ({
      ...prev,
      reposted: newReposted,
      count: newCount,
      userIds: newReposted 
        ? [...prev.userIds, user.id] 
        : prev.userIds.filter(id => id !== user.id),
    }));
    
    try {
      const response = await apiClient(`/api/posts/${postId}/repost`, {
        method: 'POST',
        body: { reposted: newReposted }
      });
      
      const data = response.data || response;
      
      // The server will broadcast the update via WebSocket
      // No need to manually send message - the server does it
      
    } catch (error) {
      // Revert on error
      setRepostState(prev => ({
        ...prev,
        reposted: !newReposted,
        count: prev.count - (newReposted ? 1 : -1),
        userIds: newReposted 
          ? prev.userIds.filter(id => id !== user.id)
          : [...prev.userIds, user.id],
      }));
      console.error('Failed to toggle repost:', error);
    }
  }, [postId, user, repostState]);

  // 🔥 FIX: Initialize or update state from server data
  const initialize = useCallback((initialLikeState, initialRepostState, initialCommentCount) => {
    if (!isMounted.current) return;
    
    // Update like state
    setLikeState(prev => ({
      count: initialLikeState.count ?? prev.count,
      liked: initialLikeState.liked ?? prev.liked,
      userIds: initialLikeState.userIds ?? prev.userIds,
    }));
    
    // Update repost state
    setRepostState(prev => ({
      count: initialRepostState.count ?? prev.count,
      reposted: initialRepostState.reposted ?? prev.reposted,
      userIds: initialRepostState.userIds ?? prev.userIds,
    }));
    
    if (initialCommentCount !== undefined) {
      setCommentCount(initialCommentCount);
    }
    
    initialSyncDone.current = true;
  }, []);

  // 🔥 FIX: Allow manual refresh from parent
  const refresh = useCallback((postData) => {
    if (!isMounted.current || !postData) return;
    
    // Update likes from post data
    if (postData.likes !== undefined) {
      const userIds = Array.isArray(postData.likes) ? postData.likes : [];
      setLikeState(prev => ({
        count: userIds.length,
        liked: user ? userIds.includes(user.id) : false,
        userIds: userIds,
      }));
    }
    
    // Update reposts from post data
    if (postData.reposts !== undefined) {
      const userIds = Array.isArray(postData.reposts) ? postData.reposts : [];
      setRepostState(prev => ({
        count: userIds.length,
        reposted: user ? userIds.includes(user.id) : false,
        userIds: userIds,
      }));
    }
    
    // Update comment count
    if (postData.commentCount !== undefined) {
      setCommentCount(postData.commentCount);
    } else if (postData.comments !== undefined) {
      setCommentCount(Array.isArray(postData.comments) ? postData.comments.length : postData.comments);
    }
  }, [user]);

  return {
    likeState,
    repostState,
    commentCount,
    toggleLike,
    toggleRepost,
    setCommentCount,
    initialize,
    refresh, // 🔥 Export refresh function
    isConnected: isAlive(),
  };
}