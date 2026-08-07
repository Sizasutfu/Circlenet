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
  const [mentionCount, setMentionCount] = useState(0);
  const [verificationCount, setVerificationCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const prevUnreadCount = useRef(0);
  const audioRef = useRef(null);

  // ── Play notification sound ──
  const playSound = useCallback(() => {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio('/message-tone.wav');
      }
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    } catch (_) {}
  }, []);

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
        mention: 'mentions',
        milestone: 'milestone',
        report_resolved: null,
        report_ignored: null,
        verified: null, // Always show verification notifications
        unverified: null, // Always show verification notifications
      };
      
      const visible = items.filter((n) => {
        const key = PREF_KEY[n.type];
        if (key === null || key === undefined) return true;
        return prefs[key] !== false;
      });

      setNotifications((prev) => reset ? visible : [...prev, ...visible]);
      setHasMore(more);
      setPage((p) => p + 1);
      
      // Update counts
      const unread = visible.filter((n) => !n.isRead);
      const mentions = visible.filter((n) => n.type === 'mention' && !n.isRead);
      const verifications = visible.filter((n) => 
        (n.type === 'verified' || n.type === 'unverified') && !n.isRead
      );
      setUnreadCount(unread.length);
      setMentionCount(mentions.length);
      setVerificationCount(verifications.length);
      updateBadge(unread.length, mentions.length, verifications.length);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [user, loading, hasMore, page]);

  // ── Fetch unread count (polling) ──
  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const res = await apiClient(`/api/notifications/${user.id}/unread-count`);
      const count = res.data?.count || 0;
      
      if (count > prevUnreadCount.current) {
        playSound();
      }
      prevUnreadCount.current = count;
      
      setUnreadCount(count);
      updateBadge(count, mentionCount, verificationCount);
    } catch (_) {}
  }, [user, playSound, mentionCount, verificationCount]);

  // ── Update badge ──
  const updateBadge = useCallback((count, mentionCount = 0, verificationCount = 0) => {
    const b1 = document.getElementById('topbar-notif-badge');
    const b2 = document.getElementById('snav-notif-badge');
    const m1 = document.getElementById('topbar-mention-badge');
    const m2 = document.getElementById('snav-mention-badge');
    const v1 = document.getElementById('topbar-verification-badge');
    const v2 = document.getElementById('snav-verification-badge');
    
    const text = count > 99 ? '99+' : count > 0 ? String(count) : '';
    if (b1) { b1.textContent = text; b1.classList.toggle('show', count > 0); }
    if (b2) { b2.textContent = text; b2.classList.toggle('show', count > 0); }
    
    const mentionText = mentionCount > 99 ? '99+' : mentionCount > 0 ? String(mentionCount) : '';
    if (m1) { m1.textContent = mentionText; m1.classList.toggle('show', mentionCount > 0); }
    if (m2) { m2.textContent = mentionText; m2.classList.toggle('show', mentionCount > 0); }
    
    const verificationText = verificationCount > 99 ? '99+' : verificationCount > 0 ? String(verificationCount) : '';
    if (v1) { v1.textContent = verificationText; v1.classList.toggle('show', verificationCount > 0); }
    if (v2) { v2.textContent = verificationText; v2.classList.toggle('show', verificationCount > 0); }
  }, []);

  // ── Mark as read ──
  const markAsRead = useCallback(async (notifId) => {
    try {
      await apiClient(`/api/notifications/${notifId}/read`, { method: 'PUT' });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, isRead: true } : n))
      );
      
      // Update counts
      const updatedNotif = notifications.find(n => n.id === notifId);
      if (updatedNotif && !updatedNotif.isRead) {
        setUnreadCount((c) => Math.max(0, c - 1));
        if (updatedNotif.type === 'mention') {
          setMentionCount((c) => Math.max(0, c - 1));
        }
        if (updatedNotif.type === 'verified' || updatedNotif.type === 'unverified') {
          setVerificationCount((c) => Math.max(0, c - 1));
        }
        updateBadge(
          unreadCount - 1,
          updatedNotif.type === 'mention' ? mentionCount - 1 : mentionCount,
          (updatedNotif.type === 'verified' || updatedNotif.type === 'unverified') ? verificationCount - 1 : verificationCount
        );
      }
    } catch (_) {}
  }, [notifications, unreadCount, mentionCount, verificationCount, updateBadge]);

  // ── Mark all read ──
  const markAllRead = useCallback(async () => {
    if (!user) return;
    try {
      await apiClient(`/api/notifications/${user.id}/read-all`, { method: 'PUT' });
      
      // Also mark all mentions as read
      try {
        await apiClient(`/api/users/mentions/read`, { method: 'PUT', body: {} });
      } catch (_) {}
      
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      setMentionCount(0);
      setVerificationCount(0);
      updateBadge(0, 0, 0);
    } catch (_) {}
  }, [user, updateBadge]);

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
    const isMention = msg.notifType === 'mention';
    const isVerification = msg.notifType === 'verified' || msg.notifType === 'unverified';
    
    setUnreadCount((prev) => prev + 1);
    if (isMention) {
      setMentionCount((prev) => prev + 1);
    }
    if (isVerification) {
      setVerificationCount((prev) => prev + 1);
    }
    updateBadge(
      unreadCount + 1,
      isMention ? mentionCount + 1 : mentionCount,
      isVerification ? verificationCount + 1 : verificationCount
    );
    
    playSound();
    
    if (isPanelOpen) {
      fetchNotifications(true);
    }
  }, [unreadCount, mentionCount, verificationCount, updateBadge, isPanelOpen, fetchNotifications, playSound]);

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
    mentionCount,
    verificationCount,
    loading,
    hasMore,
    isPanelOpen,
    fetchNotifications,
    markAsRead,
    markAllRead,
    openPanel,
    closePanel,
    updateBadge,
    playSound,
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