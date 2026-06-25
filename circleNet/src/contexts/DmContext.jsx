// src/contexts/DmContext.jsx
'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import * as E2E from '@/lib/e2e';

const DmContext = createContext();

export function DmProvider({ children }) {
  const { user } = useAuth();

  // ── State ──
  const [inbox, setInbox] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [activeOther, setActiveOther] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [latestId, setLatestId] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [typing, setTyping] = useState(false); // peer typing

  // Polling / heartbeat refs
  const pollInterval = useRef(null);
  const heartbeatInterval = useRef(null);
  const presenceInterval = useRef(null);

  // ── Load inbox ──
  const loadInbox = useCallback(async () => {
    if (!user) return;
    try {
      const res = await apiClient('/api/dm/inbox');
      const data = Array.isArray(res.data) ? res.data : [];
      setInbox(data);
    } catch (_) {}
  }, [user]);

  // ── Render inbox (used externally) ──
  const renderInbox = useCallback(() => {
    loadInbox();
  }, [loadInbox]);

  // ── Open conversation ──
  const openConversation = useCallback(async (convId) => {
    if (!user) return;
    const conv = inbox.find((c) => c.id === convId);
    if (!conv) return;
    setActiveConvId(convId);
    setActiveOther({ id: conv.other_id, name: conv.other_name, picture: conv.other_picture });
    setMessages([]);
    setHasMore(false);
    setCursor(null);
    setLatestId(null);
    // Fetch messages
    try {
      const res = await apiClient(`/api/dm/conversations/${convId}/messages?limit=10`);
      const msgs = res.data?.messages || [];
      const hasMoreData = res.data?.hasMore || false;
      // Decrypt E2E messages
      const decrypted = await Promise.all(
        msgs.map(async (m) => {
          if (m.body && m.body.startsWith('e2e:')) {
            const plain = await E2E.decrypt(conv.other_id, m.body, apiClient);
            return { ...m, _plain: plain };
          }
          return { ...m, _plain: m.body };
        })
      );
      setMessages(decrypted);
      setHasMore(hasMoreData);
      setCursor(decrypted.length ? decrypted[0].id : null);
      setLatestId(decrypted.length ? decrypted[decrypted.length - 1].id : null);
      // Mark as read
      await apiClient(`/api/dm/conversations/${convId}/read`, { method: 'PATCH' });
      // Update inbox unread count
      setInbox((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, unread_count: 0 } : c))
      );
    } catch (_) {}
  }, [user, inbox]);

  // ── Load more messages ──
  const loadMoreMessages = useCallback(async () => {
    if (!activeConvId || !hasMore || loadingMore || !cursor) return;
    setLoadingMore(true);
    try {
      const res = await apiClient(
        `/api/dm/conversations/${activeConvId}/messages?limit=10&before_id=${cursor}`
      );
      const msgs = res.data?.messages || [];
      const hasMoreData = res.data?.hasMore || false;
      const conv = inbox.find((c) => c.id === activeConvId);
      const decrypted = await Promise.all(
        msgs.map(async (m) => {
          if (m.body && m.body.startsWith('e2e:') && conv) {
            const plain = await E2E.decrypt(conv.other_id, m.body, apiClient);
            return { ...m, _plain: plain };
          }
          return { ...m, _plain: m.body };
        })
      );
      setMessages((prev) => [...decrypted, ...prev]);
      setHasMore(hasMoreData);
      setCursor(decrypted.length ? decrypted[0].id : cursor);
    } catch (_) {}
    setLoadingMore(false);
  }, [activeConvId, hasMore, loadingMore, cursor, inbox]);

  // ── Send message ──
  const sendMessage = useCallback(async (text) => {
    if (!user || !activeConvId || !text.trim()) return;
    const conv = inbox.find((c) => c.id === activeConvId);
    if (!conv) return;
    const tempId = 'tmp_' + Date.now();
    const tempMsg = {
      id: tempId,
      sender_id: user.id,
      body: text,
      created_at: new Date().toISOString(),
      _plain: text,
    };
    setMessages((prev) => [...prev, tempMsg]);
    try {
      const wireBody = await E2E.encrypt(conv.other_id, text, apiClient);
      const res = await apiClient(`/api/dm/conversations/${activeConvId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: wireBody }),
      });
      const saved = res.data || res;
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      if (saved && saved.id) {
        saved._plain = text;
        setMessages((prev) => [...prev, saved]);
        setLatestId(saved.id);
      }
      loadInbox();
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      throw err;
    }
  }, [user, activeConvId, inbox, loadInbox]);

  // ── Poll new messages ──
  const pollNewMessages = useCallback(async () => {
    if (!activeConvId || !latestId) return;
    try {
      const res = await apiClient(
        `/api/dm/conversations/${activeConvId}/messages/new?after_id=${latestId}`
      );
      const msgs = Array.isArray(res.data) ? res.data : [];
      if (!msgs.length) return;
      const conv = inbox.find((c) => c.id === activeConvId);
      const decrypted = await Promise.all(
        msgs.map(async (m) => {
          if (m.body && m.body.startsWith('e2e:') && conv) {
            const plain = await E2E.decrypt(conv.other_id, m.body, apiClient);
            return { ...m, _plain: plain };
          }
          return { ...m, _plain: m.body };
        })
      );
      setMessages((prev) => [...prev, ...decrypted]);
      setLatestId(decrypted[decrypted.length - 1].id);
      // Mark as read
      await apiClient(`/api/dm/conversations/${activeConvId}/read`, { method: 'PATCH' });
      // Update unread in inbox
      loadInbox();
    } catch (_) {}
  }, [activeConvId, latestId, inbox, loadInbox]);

  // ── Heartbeat ──
  const sendHeartbeat = useCallback(async () => {
    if (!user) return;
    try {
      await apiClient('/api/dm/heartbeat', { method: 'POST' });
    } catch (_) {}
  }, [user]);

  // ── Polling ──
  useEffect(() => {
    if (!user) return;
    loadInbox();
    // Start polling
    pollInterval.current = setInterval(() => {
      loadInbox();
      if (activeConvId) pollNewMessages();
    }, 4000);
    // Heartbeat
    sendHeartbeat();
    heartbeatInterval.current = setInterval(sendHeartbeat, 30000);
    return () => {
      clearInterval(pollInterval.current);
      clearInterval(heartbeatInterval.current);
    };
  }, [user, activeConvId, loadInbox, pollNewMessages, sendHeartbeat]);

  // ── Context value ──
  const value = {
    inbox,
    activeConvId,
    activeOther,
    messages,
    hasMore,
    loadingMore,
    typing,
    loadInbox,
    renderInbox,
    openConversation,
    loadMoreMessages,
    sendMessage,
    setActiveConvId,
    setActiveOther,
    setMessages,
    setHasMore,
    setLoadingMore,
    setTyping,
    pollNewMessages,
  };

  return <DmContext.Provider value={value}>{children}</DmContext.Provider>;
}

export function useDm() {
  const context = useContext(DmContext);
  if (!context) {
    throw new Error('useDm must be used within a DmProvider');
  }
  return context;
}