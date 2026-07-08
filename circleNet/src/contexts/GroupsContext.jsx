// src/contexts/GroupsContext.jsx
'use client';

import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';

const GroupsContext = createContext();

function getAuthToken() {
  let token = localStorage.getItem('circle_token') ||
             localStorage.getItem('token') ||
             localStorage.getItem('authToken');
  if (token) return token;
  const userData = localStorage.getItem('circle_user') || localStorage.getItem('user');
  if (userData) {
    try {
      const parsed = JSON.parse(userData);
      if (parsed.token) return parsed.token;
    } catch (_) {}
  }
  return null;
}

function getUserId() {
  const userData = localStorage.getItem('circle_user') || localStorage.getItem('user');
  if (userData) {
    try {
      const parsed = JSON.parse(userData);
      if (parsed.id) return parsed.id;
    } catch (_) {}
  }
  return null;
}

function toggleMembership(group, isJoining) {
  if (!group) return group;
  return {
    ...group,
    isMember: isJoining,
    memberCount: Math.max(0, (group.memberCount || 0) + (isJoining ? 1 : -1)),
  };
}

export function GroupsProvider({ children }) {
  const { user } = useAuth();

  const [groupsList, setGroupsList] = useState([]);
  const [myGroups, setMyGroups] = useState([]);
  const [currentGroup, setCurrentGroup] = useState(null);
  const [groupFeed, setGroupFeed] = useState([]);
  const [hasMoreGroups, setHasMoreGroups] = useState(false);
  const [hasMoreGroupFeed, setHasMoreGroupFeed] = useState(false);
  const [groupsPage, setGroupsPage] = useState(1);
  const [groupFeedPage, setGroupFeedPage] = useState(1);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingGroupFeed, setLoadingGroupFeed] = useState(false);
  const [loadingMyGroups, setLoadingMyGroups] = useState(false);

  useEffect(() => {
    if (user) loadMyGroups();
  }, [user]);

  const loadMyGroups = useCallback(async () => {
    if (!user) return [];
    if (loadingMyGroups) return myGroups;
    setLoadingMyGroups(true);
    try {
      const res = await apiClient('/api/groups/mine');
      const groups = res.data || [];
      setMyGroups(groups);
      if (currentGroup) {
        const found = groups.find(g => g.id === currentGroup.id);
        if (found) {
          setCurrentGroup(prev => ({ ...prev, isMember: true }));
        } else {
          setCurrentGroup(prev => ({ ...prev, isMember: false }));
        }
      }
      return groups;
    } catch (err) {
      console.error('Failed to load my groups:', err);
      return [];
    } finally {
      setLoadingMyGroups(false);
    }
  }, [user, loadingMyGroups, myGroups, currentGroup]);

  const loadGroups = useCallback(async (reset = false) => {
    if (loadingGroups) return;
    if (reset) {
      setGroupsPage(1);
      setHasMoreGroups(false);
      setGroupsList([]);
    }
    setLoadingGroups(true);
    try {
      const userId = user?.id || null;
      const qs = `?page=${reset ? 1 : groupsPage}&limit=12${userId ? '' : ''}`;
      const res = await apiClient(`/api/groups${qs}`);
      const { groups, hasMore } = res.data || { groups: [], hasMore: false };
      setGroupsList((prev) => reset ? groups : [...prev, ...groups]);
      setHasMoreGroups(hasMore);
      setGroupsPage((p) => p + 1);
    } catch (err) {
      console.error('Failed to load groups:', err);
    } finally {
      setLoadingGroups(false);
    }
  }, [loadingGroups, groupsPage, user]);

  const loadGroupDetail = useCallback(async (groupId) => {
    try {
      const res = await apiClient(`/api/groups/${groupId}`);
      let group = res.data || res;
      if (user) {
        let groups = myGroups;
        if (groups.length === 0) groups = await loadMyGroups();
        group.isMember = groups.some(g => g.id === groupId);
      } else {
        group.isMember = false;
      }
      setCurrentGroup(group);
      return group;
    } catch (err) {
      throw err;
    }
  }, [myGroups, user, loadMyGroups]);

  const loadGroupFeed = useCallback(async (groupId, reset = false) => {
    if (loadingGroupFeed) return;
    if (reset) {
      setGroupFeedPage(1);
      setHasMoreGroupFeed(false);
      setGroupFeed([]);
    }
    setLoadingGroupFeed(true);
    try {
      const res = await apiClient(`/api/groups/${groupId}/feed?page=${reset ? 1 : groupFeedPage}&limit=20`);
      const { posts, hasMore } = res.data || { posts: [], hasMore: false };
      setGroupFeed((prev) => reset ? posts : [...prev, ...posts]);
      setHasMoreGroupFeed(hasMore);
      setGroupFeedPage((p) => p + 1);
    } catch (err) {
      console.error('Failed to load group feed:', err);
    } finally {
      setLoadingGroupFeed(false);
    }
  }, [loadingGroupFeed, groupFeedPage]);

  const joinGroup = useCallback(async (groupId) => {
    if (!user) throw new Error('Not authenticated');
    const response = await apiClient(`/api/groups/${groupId}/join`, { method: 'POST' });
    const isMember = response.data?.isMember ?? true;
    console.log('[joinGroup] API returned isMember:', isMember); // Debug

    // 🔥 Update currentGroup immediately
    setCurrentGroup((prev) => {
      if (!prev || prev.id !== groupId) return prev;
      console.log('[joinGroup] Updating currentGroup to isMember = true');
      return { ...prev, isMember: true, memberCount: (prev.memberCount || 0) + 1 };
    });

    // Also update groupsList
    setGroupsList((prev) =>
      prev.map(g => g.id === groupId ? { ...g, isMember: true, memberCount: (g.memberCount || 0) + 1 } : g)
    );

    // Refresh myGroups (async, but don't overwrite currentGroup until done)
    await loadMyGroups();
  }, [user, loadMyGroups]);

  const leaveGroup = useCallback(async (groupId) => {
    if (!user) throw new Error('Not authenticated');
    await apiClient(`/api/groups/${groupId}/join`, { method: 'DELETE' });
    setCurrentGroup((prev) => {
      if (!prev || prev.id !== groupId) return prev;
      return { ...prev, isMember: false, memberCount: Math.max(0, (prev.memberCount || 0) - 1) };
    });
    setGroupsList((prev) =>
      prev.map(g => g.id === groupId ? { ...g, isMember: false, memberCount: Math.max(0, (g.memberCount || 0) - 1) } : g)
    );
    await loadMyGroups();
  }, [user, loadMyGroups]);

  const postToGroup = useCallback(async (groupId, text, imageFile, videoFile) => {
    if (!user) throw new Error('Not authenticated');
    const formData = new FormData();
    formData.append('text', text);
    formData.append('groupId', String(groupId));
    if (imageFile) formData.append('image', imageFile);
    if (videoFile) formData.append('video', videoFile);

    const token = getAuthToken();
    const userId = getUserId() || user?.id;
    if (!token) throw new Error('Authentication token not found. Please log in again.');

    const headers = {
      Authorization: `Bearer ${token}`,
    };
    if (userId) headers['X-User-Id'] = String(userId);

    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';
    const res = await fetch(`${baseUrl}/api/posts`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to post');
    }
    const data = await res.json();
    const newPost = data.data || data;
    setGroupFeed((prev) => [newPost, ...prev]);
    return newPost;
  }, [user]);

  const value = {
    groupsList,
    myGroups,
    currentGroup,
    groupFeed,
    hasMoreGroups,
    hasMoreGroupFeed,
    loadingGroups,
    loadingGroupFeed,
    loadGroups,
    loadMyGroups,
    loadGroupDetail,
    loadGroupFeed,
    joinGroup,
    leaveGroup,
    postToGroup,
    setCurrentGroup,
  };

  return <GroupsContext.Provider value={value}>{children}</GroupsContext.Provider>;
}

export function useGroups() {
  const context = useContext(GroupsContext);
  if (!context) {
    throw new Error('useGroups must be used within a GroupsProvider');
  }
  return context;
}