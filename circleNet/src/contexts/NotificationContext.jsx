// src/contexts/NotificationContext.jsx
'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import { useRouter } from 'next/navigation';

const NotificationContext = createContext();

// ── Constants ──
export const NOTIF_ICONS = {
  like: `<svg fill="currentColor" viewBox="0 0 24 24" width="16" height="16"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>`,
  comment: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`,
  reply: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 00-4-4H4"/></svg>`,
  repost: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>`,
  follow: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>`,
  new_post: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><path d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M5.636 5.636a9 9 0 000 12.728M8.464 8.464a5 5 0 000 7.072M12 13a1 1 0 100-2 1 1 0 000 2z"/></svg>`,
  live: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/><path d="M6.3 6.3a8 8 0 000 11.4"/><path d="M17.7 6.3a8 8 0 010 11.4"/><path d="M3.5 3.5a13.5 13.5 0 000 17"/><path d="M20.5 3.5a13.5 13.5 0 010 17"/></svg>`,
  profile_pic: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  mention: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 006 0v-1a10 10 0 10-3.92 7.94"/></svg>`,
  milestone: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  report_resolved: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><polyline points="20 6 9 17 4 12"/></svg>`,
  report_ignored: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
};

export function escHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, (m) => {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    if (m === '"') return '&quot;';
    if (m === "'") return '&#39;';
    return m;
  });
}

function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 60%)`;
}

function formatTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const router = useRouter();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const pollInterval = useRef(null);
  const prevUnreadCount = useRef(null);

  // ── Fetch notifications ──
  const fetchNotifications = useCallback(async (reset = false) => {
    if (!user) return;
    if (loading) return;
    if (!reset && !hasMore) return;

    if (reset) {
      setPage(1);
      setHasMore(true);
      setNotifications([]);
    }

    setLoading(true);
    try {
      const res = await apiClient(`/api/notifications/${user.id}?page=${page}&limit=10`);
      const { notifications: items, hasMore: more } = res.data || { notifications: [], hasMore: false };

      // Filter by user preferences
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

      setNotifications((prev) => (reset ? visible : [...prev, ...visible]));
      setHasMore(more);
      setPage((p) => p + 1);

      // Update badge
      const unread = reset ? visible.filter((n) => !n.isRead).length : [...notifications, ...visible].filter((n) => !n.isRead).length;
      setUnreadCount(unread);
      updateBadge(unread);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [user, loading, hasMore, page, notifications]);

  // ── Fetch unread count (for polling) ──
  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const res = await apiClient(`/api/notifications/${user.id}/unread-count`);
      const count = res.data.count || 0;
      if (prevUnreadCount.current !== null && count > prevUnreadCount.current) {
        // Play notification sound (optional)
        try {
          const audio = new Audio('/message-tone.wav');
          audio.play().catch(() => {});
        } catch (_) {}
      }
      prevUnreadCount.current = count;
      setUnreadCount(count);
      updateBadge(count);
    } catch (err) {
      // silent
    }
  }, [user]);

  // ── Update badge in sidebar ──
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
    } catch (err) {
      // silent
    }
  }, [unreadCount, updateBadge]);

  // ── Mark all read ──
  const markAllRead = useCallback(async () => {
    if (!user) return;
    try {
      await apiClient(`/api/notifications/${user.id}/read-all`, { method: 'PUT' });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      updateBadge(0);
    } catch (err) {
      // silent
    }
  }, [user, updateBadge]);

  // ── Handle notification click ──
  const onNotifClick = useCallback(async (notif) => {
    const { id, postId, type, actorId, sessionId } = notif;
    await markAsRead(id);

    // Close panel
    setIsPanelOpen(false);

    // System notifications
    if (type === 'report_resolved' || type === 'report_ignored') {
      return;
    }

    // Route based on type
    if (type === 'profile_pic' || type === 'follow') {
      if (actorId) router.push(`/profile?userId=${actorId}`);
      else router.push('/feed');
    } else if (type === 'live' && sessionId) {
      // Live watch – implement Live.watchSession later
      router.push(`/live/${sessionId}`);
    } else if (type === 'new_post' && postId) {
      router.push(`/post/${postId}`);
    } else if (type === 'mention' && postId) {
      router.push(`/post/${postId}`);
    } else if (type === 'milestone') {
      router.push('/profile');
    } else if (postId) {
      // For comment/like/repost/reply, go to post detail
      router.push(`/post/${postId}`);
    } else {
      router.push('/feed');
    }

    // Optionally refetch to update read status
    // fetchNotifications(true);
  }, [markAsRead, router]);

  // ── Open/close panel ──
  const openPanel = useCallback(() => {
    if (!user) {
      // redirect to login
      router.push('/login');
      return;
    }
    setIsPanelOpen(true);
    fetchNotifications(true);
    document.body.style.overflow = 'hidden';
  }, [user, router, fetchNotifications]);

  const closePanel = useCallback(() => {
    setIsPanelOpen(false);
    document.body.style.overflow = '';
    markAllRead();
  }, [markAllRead]);

  // ── Polling ──
  useEffect(() => {
    if (!user) return;
    fetchUnreadCount();
    pollInterval.current = setInterval(fetchUnreadCount, 30000);
    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, [user, fetchUnreadCount]);

  const value = {
    notifications,
    unreadCount,
    loading,
    hasMore,
    fetchNotifications,
    markAsRead,
    markAllRead,
    onNotifClick,
    isPanelOpen,
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