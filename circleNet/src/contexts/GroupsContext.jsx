// src/contexts/GroupsContext.jsx
'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
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
  const [refreshKey, setRefreshKey] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load my groups when user changes
  useEffect(() => {
    if (user) {
      console.log('[GroupsProvider] User changed, loading my groups...');
      loadMyGroups().then(() => {
        setIsInitialized(true);
      });
    } else {
      setMyGroups([]);
      setGroupsList([]);
      setIsInitialized(false);
    }
  }, [user]);

  const loadMyGroups = useCallback(async () => {
    if (!user) {
      console.log('[loadMyGroups] No user, returning empty');
      return [];
    }
    
    if (loadingMyGroups) {
      console.log('[loadMyGroups] Already loading, returning cached');
      return myGroups;
    }
    
    console.log('[loadMyGroups] Loading groups for user:', user.id);
    setLoadingMyGroups(true);
    
    try {
      const res = await apiClient('/api/groups/mine');
      const groups = res.data || [];
      console.log('[loadMyGroups] Loaded groups:', groups.length, groups.map(g => ({ id: g.id, topic: g.topic })));
      
      setMyGroups(groups);
      
      // Update isMember status in groupsList
      setGroupsList(prev => {
        const updated = prev.map(g => ({
          ...g,
          isMember: groups.some(mg => mg.id === g.id)
        }));
        console.log('[loadMyGroups] Updated groupsList with membership:', updated.map(g => ({ id: g.id, isMember: g.isMember })));
        return updated;
      });
      
      // Update currentGroup if it exists
      if (currentGroup) {
        const found = groups.find(g => g.id === currentGroup.id);
        setCurrentGroup(prev => ({ 
          ...prev, 
          isMember: !!found 
        }));
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
      const qs = `?page=${reset ? 1 : groupsPage}&limit=12${userId ? `&userId=${userId}` : ''}`;
      console.log('[loadGroups] Fetching groups with:', { userId, page: reset ? 1 : groupsPage });
      
      const res = await apiClient(`/api/groups${qs}`);
      const { groups, hasMore } = res.data || { groups: [], hasMore: false };
      
      console.log('[loadGroups] Raw groups from API:', groups.map(g => ({ id: g.id, topic: g.topic, isMember: g.isMember })));
      console.log('[loadGroups] Current myGroups:', myGroups.map(g => ({ id: g.id, topic: g.topic })));
      
      // Ensure isMember is correctly set based on myGroups
      const groupsWithMembership = groups.map(g => {
        const isMember = myGroups.some(mg => mg.id === g.id) || g.isMember || false;
        return {
          ...g,
          isMember
        };
      });
      
      console.log('[loadGroups] Groups with membership:', groupsWithMembership.map(g => ({ id: g.id, topic: g.topic, isMember: g.isMember })));
      
      setGroupsList((prev) => {
        const updated = reset ? groupsWithMembership : [...prev, ...groupsWithMembership];
        console.log('[loadGroups] Updated groupsList length:', updated.length);
        return updated;
      });
      
      setHasMoreGroups(hasMore);
      setGroupsPage((p) => p + 1);
    } catch (err) {
      console.error('Failed to load groups:', err);
    } finally {
      setLoadingGroups(false);
    }
  }, [loadingGroups, groupsPage, user, myGroups]);

  const loadGroupDetail = useCallback(async (groupId) => {
    try {
      const res = await apiClient(`/api/groups/${groupId}`);
      let group = res.data || res;
      
      // Check if user is a member
      if (user) {
        let groups = myGroups;
        if (groups.length === 0) groups = await loadMyGroups();
        group.isMember = groups.some(g => g.id === groupId);
        console.log('[loadGroupDetail] Group membership:', { groupId, isMember: group.isMember });
      } else {
        group.isMember = false;
      }
      
      setCurrentGroup(group);
      return group;
    } catch (err) {
      console.error('loadGroupDetail error:', err);
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
    
    try {
      console.log('[joinGroup] Joining group:', groupId);
      const response = await apiClient(`/api/groups/${groupId}/join`, { method: 'POST' });
      
      console.log('[joinGroup] Response:', response);
      
      // Get the updated data from response
      const data = response.data || response;
      const isMember = data.isMember ?? true;
      const memberCount = data.memberCount;
      
      console.log('[joinGroup] Response data:', { isMember, memberCount });
      
      // Update currentGroup
      setCurrentGroup((prev) => {
        if (!prev || prev.id !== groupId) return prev;
        return { 
          ...prev, 
          isMember: true, 
          memberCount: memberCount || (prev.memberCount || 0) + 1 
        };
      });

      // Update groupsList
      setGroupsList((prev) =>
        prev.map(g => 
          g.id === groupId 
            ? { 
                ...g, 
                isMember: true, 
                memberCount: memberCount || (g.memberCount || 0) + 1 
              } 
            : g
        )
      );

      // Force refresh myGroups
      await loadMyGroups();
      
      // Force re-render
      setRefreshKey(prev => prev + 1);
      
      console.log('[joinGroup] Successfully joined group:', groupId);
      return true;
    } catch (err) {
      console.error('Failed to join group:', err);
      throw err;
    }
  }, [user, loadMyGroups]);

  const leaveGroup = useCallback(async (groupId) => {
    if (!user) throw new Error('Not authenticated');
    
    try {
      console.log('[leaveGroup] Leaving group:', groupId);
      const response = await apiClient(`/api/groups/${groupId}/join`, { method: 'DELETE' });
      
      console.log('[leaveGroup] Response:', response);
      
      // Get the updated data from response
      const data = response.data || response;
      const isMember = data.isMember ?? false;
      const memberCount = data.memberCount;
      
      console.log('[leaveGroup] Response data:', { isMember, memberCount });
      
      setCurrentGroup((prev) => {
        if (!prev || prev.id !== groupId) return prev;
        return { 
          ...prev, 
          isMember: false, 
          memberCount: memberCount || Math.max(0, (prev.memberCount || 0) - 1) 
        };
      });
      
      setGroupsList((prev) =>
        prev.map(g => 
          g.id === groupId 
            ? { 
                ...g, 
                isMember: false, 
                memberCount: memberCount || Math.max(0, (g.memberCount || 0) - 1) 
              } 
            : g
        )
      );
      
      await loadMyGroups();
      setRefreshKey(prev => prev + 1);
      
      console.log('[leaveGroup] Successfully left group:', groupId);
      return true;
    } catch (err) {
      console.error('Failed to leave group:', err);
      throw err;
    }
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
    refreshKey,
    isInitialized,
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