// src/hooks/useRecommendation.js
import { useState } from 'react';
import { apiClient } from '@/lib/api';

export function useRecommendation() {
  const [following, setFollowing] = useState(new Set());

  const handleFollow = async (userId, onSuccess) => {
    if (following.has(userId)) {
      setFollowing(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
      try {
        await apiClient(`/api/unfollow/${userId}`, { method: 'DELETE' });
        if (onSuccess) onSuccess();
      } catch (_) {
        setFollowing(prev => new Set(prev).add(userId));
      }
    } else {
      setFollowing(prev => new Set(prev).add(userId));
      try {
        await apiClient(`/api/follow/${userId}`, { method: 'POST' });
        if (onSuccess) onSuccess();
      } catch (_) {
        setFollowing(prev => {
          const newSet = new Set(prev);
          newSet.delete(userId);
          return newSet;
        });
      }
    }
  };

  const handleDismiss = async (userId, onSuccess) => {
    try {
      await apiClient('/api/recommendations/dismiss', {
        method: 'POST',
        body: { dismissedUserId: userId },
      });
      if (onSuccess) onSuccess(userId);
    } catch (_) {}
  };

  return { following, handleFollow, handleDismiss };
}