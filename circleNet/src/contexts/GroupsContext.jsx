// src/contexts/GroupsContext.jsx
'use client';

import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';

const GroupsContext = createContext();

export function GroupsProvider({ children }) {
  const { user } = useAuth();

  // ── State ──
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

  // ── Load trending groups ──
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

  // ── Load my groups ──
  const loadMyGroups = useCallback(async () => {
    if (!user) return;
    try {
      const res = await apiClient('/api/groups/mine');
      const groups = res.data || [];
      setMyGroups(groups);
    } catch (err) {
      console.error('Failed to load my groups:', err);
    }
  }, [user]);

  // ── Load group detail ──
  const loadGroupDetail = useCallback(async (groupId) => {
    try {
      const res = await apiClient(`/api/groups/${groupId}`);
      const group = res.data || res;
      setCurrentGroup(group);
      return group;
    } catch (err) {
      throw err;
    }
  }, []);

  // ── Load group feed ──
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

  // ── Join group ──
  const joinGroup = useCallback(async (groupId) => {
    if (!user) throw new Error('Not authenticated');
    await apiClient(`/api/groups/${groupId}/join`, { method: 'POST' });
    // Refresh group lists
    await loadGroups(true);
    await loadMyGroups();
    // Update current group if open
    if (currentGroup && currentGroup.id === groupId) {
      const updated = await loadGroupDetail(groupId);
      setCurrentGroup(updated);
    }
  }, [user, loadGroups, loadMyGroups, loadGroupDetail, currentGroup]);

  // ── Leave group ──
  const leaveGroup = useCallback(async (groupId) => {
    if (!user) throw new Error('Not authenticated');
    await apiClient(`/api/groups/${groupId}/join`, { method: 'DELETE' });
    await loadGroups(true);
    await loadMyGroups();
    if (currentGroup && currentGroup.id === groupId) {
      const updated = await loadGroupDetail(groupId);
      setCurrentGroup(updated);
    }
  }, [user, loadGroups, loadMyGroups, loadGroupDetail, currentGroup]);

  // ── Post to group ──
  const postToGroup = useCallback(async (groupId, text, imageFile, videoFile) => {
    if (!user) throw new Error('Not authenticated');
    const formData = new FormData();
    formData.append('text', text);
    formData.append('groupId', String(groupId));
    if (imageFile) formData.append('image', imageFile);
    if (videoFile) formData.append('video', videoFile);
    // Using fetch directly because apiClient doesn't handle FormData with Content-Type automatically.
    const token = localStorage.getItem('circle_token');
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'}/api/posts`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to post');
    }
    const data = await res.json();
    const newPost = data.data || data;
    // Prepend to group feed optimistically
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