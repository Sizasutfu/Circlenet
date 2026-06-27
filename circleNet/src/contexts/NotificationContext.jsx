// src/contexts/NotificationContext.jsx
'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import { useWs } from '@/contexts/WsContext';

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const { registerHandler } = useWs();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const prevUnreadCount = useRef(0);

  // ── Fetch notifications ──
  const fetchNotifications = useCallback(async (reset = false) => {
    if (!user) return;
    if (loading) return;
    if (!reset && !hasMore) return;

    const currentPage = reset ? 1 : page;
    setLoading(true);
    try {
      const res = await apiClient(`/api/notifications/${user.id}?page=${currentPage}&limit=10`);
      const items = res.data?.notifications || [];
      const more = res.data?.hasMore || false;

      // Filter by user preferences (local)
      const prefs = JSON.parse(localStorage.getItem('circle_notif_prefs') || '{}');
      const PREF_KEY = {
        like: 'likes',
        comment: 'comments',
        reply: 'comments',
        repost: 'reposts',
        follow: null,
        new_post: 'new_post',
        live: null,
        profile_pic: 'profile_pic',
        mention: 'mention',
        milestone: 'milestone',
        report_resolved: null,
        report_ignored: null,
      };
      const visible = items.filter((n) => {
        const key = PREF_KEY[n.type];
        if (key === null || key === undefined) return true;
        return prefs[key] !== false;
      });

      setNotifications((prev) => reset ? visible : [...prev, ...visible]);
      setHasMore(more);
      setPage((p) => p + 1);
      // Update badge
      const unread = reset ? visible.filter((n) => !n.isRead).length : notifications.filter((n) => !n.isRead).length;
      setUnreadCount(unread);
      updateBadge(unread);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [user, loading, hasMore, page, notifications]);

  // ── Fetch unread count (polling) ──
  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const res = await apiClient(`/api/notifications/${user.id}/unread-count`);
      const count = res.data?.count || 0;
      if (count > prevUnreadCount.current) {
        // Play sound if new notifications came in (optional)
        try {
          const audio = new Audio('/message-tone.wav');
          audio.play().catch(() => {});
        } catch (_) {}
      }
      prevUnreadCount.current = count;
      setUnreadCount(count);
      updateBadge(count);
    } catch (_) {}
  }, [user]);

  // ── Update badge ──
  const updateBadge = useCallback((count) => {
    const b1 = document.getElementById('topbar-notif-badge');
    const b2 = document.getElementById('snav-notif-badge');
    const text = count > 99 ? '99+' : count > 0 ? String(count) : '';
    if (b1) { b1.textContent = text; b1.classList.toggle('show', count > 0); }
    if (b2) { b2.textContent = text; b2.classList.toggle('show', count > 0); }
  }, []);

  // ── Mark as read ──
  const markAsRead = useCallback(async (notifId) => {
    try {
      await apiClient(`/api/notifications/${notifId}/read`, { method: 'PUT' });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      updateBadge(unreadCount - 1);
    } catch (_) {}
  }, [unreadCount, updateBadge]);

  // ── Mark all read ──
  const markAllRead = useCallback(async () => {
    if (!user) return;
    try {
      await apiClient(`/api/notifications/${user.id}/read-all`, { method: 'PUT' });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      updateBadge(0);
    } catch (_) {}
  }, [user, updateBadge]);

  // ── Notification click handler ──
  const onNotifClick = useCallback(async (notif) => {
    const { id, postId, type, actorId, sessionId } = notif;
    await markAsRead(id);
    setIsPanelOpen(false);
    // Route logic – same as legacy
    // We'll rely on the router from the parent component via a callback
    // For now, just close the panel and let the parent handle navigation.
    // We can also trigger a custom event or use a global router.
    // For simplicity, we'll pass the data to the parent via a callback.
  }, [markAsRead]);

  // ── Open/close panel ──
  const openPanel = useCallback(() => {
    if (!user) return;
    setIsPanelOpen(true);
    fetchNotifications(true);
    document.body.style.overflow = 'hidden';
  }, [user, fetchNotifications]);

  const closePanel = useCallback(() => {
    setIsPanelOpen(false);
    document.body.style.overflow = '';
    markAllRead();
  }, [markAllRead]);

  // ── WS: handle incoming notification ──
  const handleWsNotification = useCallback((msg) => {
    // msg: { type: 'notification', notifType, actorName, ... }
    // Update badge
    setUnreadCount((prev) => prev + 1);
    updateBadge(unreadCount + 1);
    // Play sound
    try {
      const audio = new Audio('/message-tone.wav');
      audio.play().catch(() => {});
    } catch (_) {}
    // If panel is open, refresh
    if (isPanelOpen) {
      fetchNotifications(true);
    }
  }, [unreadCount, updateBadge, isPanelOpen, fetchNotifications]);

  // ── Register WS handler ──
  useEffect(() => {
    const unregister = registerHandler('notification', handleWsNotification);
    return unregister;
  }, [registerHandler, handleWsNotification]);

  // ── Polling for unread count (fallback) ──
  useEffect(() => {
    if (!user) return;
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [user, fetchUnreadCount]);

  const value = {
    notifications,
    unreadCount,
    loading,
    hasMore,
    isPanelOpen,
    fetchNotifications,
    markAsRead,
    markAllRead,
    onNotifClick,
    openPanel,
    closePanel,
    updateBadge,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}