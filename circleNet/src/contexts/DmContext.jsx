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
  const [typing, setTyping] = useState(false);

  // ── Refs to keep latest values stable inside intervals ──
  const userRef = useRef(user);
  const activeConvIdRef = useRef(activeConvId);
  const latestIdRef = useRef(latestId);
  const inboxRef = useRef(inbox);
  const intervalRef = useRef(null);
  const heartbeatRef = useRef(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    activeConvIdRef.current = activeConvId;
  }, [activeConvId]);

  useEffect(() => {
    latestIdRef.current = latestId;
  }, [latestId]);

  useEffect(() => {
    inboxRef.current = inbox;
  }, [inbox]);

  // ── Load inbox ──
  const loadInbox = useCallback(async () => {
    if (!userRef.current) return;
    try {
      const res = await apiClient('/api/dm/inbox');
      const data = Array.isArray(res.data) ? res.data : [];
      setInbox(data);
    } catch (_) {}
  }, []);

  // ── Poll new messages ──
  const pollNewMessages = useCallback(async () => {
    const convId = activeConvIdRef.current;
    const lastId = latestIdRef.current;
    const currentUser = userRef.current;
    if (!convId || !lastId || !currentUser) return;

    try {
      const res = await apiClient(`/api/dm/conversations/${convId}/messages/new?after_id=${lastId}`);
      const msgs = Array.isArray(res.data) ? res.data : [];
      if (!msgs.length) return;

      const conv = inboxRef.current.find((c) => c.id === convId);
      const decrypted = await Promise.all(
        msgs.map(async (m) => {
          if (m.body?.startsWith('e2e:') && conv) {
            const plain = await E2E.decrypt(conv.other_id, m.body, apiClient);
            return { ...m, _plain: plain };
          }
          return { ...m, _plain: m.body };
        })
      );

      setMessages((prev) => [...prev, ...decrypted]);
      if (decrypted.length) {
        setLatestId(decrypted[decrypted.length - 1].id);
      }
      // Mark as read
      await apiClient(`/api/dm/conversations/${convId}/read`, { method: 'PATCH' });
      loadInbox(); // refresh inbox to update unread counts
    } catch (_) {}
  }, [loadInbox]);

  // ── Heartbeat ──
  const sendHeartbeat = useCallback(async () => {
    if (!userRef.current) return;
    try {
      await apiClient('/api/dm/heartbeat', { method: 'POST' });
    } catch (_) {}
  }, []);

  // ── Open conversation ──
  const openConversation = useCallback(async (convId) => {
    if (!userRef.current) return;
    const conv = inboxRef.current.find((c) => c.id === convId);
    if (!conv) return;
    setActiveConvId(convId);
    setActiveOther({ id: conv.other_id, name: conv.other_name, picture: conv.other_picture });
    setMessages([]);
    setHasMore(false);
    setCursor(null);
    setLatestId(null);

    try {
      const res = await apiClient(`/api/dm/conversations/${convId}/messages?limit=10`);
      const msgs = res.data?.messages || [];
      const hasMoreData = res.data?.hasMore || false;
      const decrypted = await Promise.all(
        msgs.map(async (m) => {
          if (m.body?.startsWith('e2e:') && conv) {
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
  }, []);

  // ── Load more messages ──
  const loadMoreMessages = useCallback(async () => {
    if (!activeConvId || !hasMore || loadingMore || !cursor) return;
    setLoadingMore(true);
    const conv = inboxRef.current.find((c) => c.id === activeConvId);
    try {
      const res = await apiClient(
        `/api/dm/conversations/${activeConvId}/messages?limit=10&before_id=${cursor}`
      );
      const msgs = res.data?.messages || [];
      const hasMoreData = res.data?.hasMore || false;
      const decrypted = await Promise.all(
        msgs.map(async (m) => {
          if (m.body?.startsWith('e2e:') && conv) {
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
  }, [activeConvId, hasMore, loadingMore, cursor]);

  // ── Send message ──
  const sendMessage = useCallback(async (text) => {
    if (!userRef.current || !activeConvId || !text.trim()) return;
    const conv = inboxRef.current.find((c) => c.id === activeConvId);
    if (!conv) return;
    const tempId = 'tmp_' + Date.now();
    const tempMsg = {
      id: tempId,
      sender_id: userRef.current.id,
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
  }, [activeConvId, loadInbox]);

  // ── Polling setup – runs once when user is available ──
  useEffect(() => {
    // Clean up any existing intervals
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);

    if (!user) return;

    // Initial load
    loadInbox();
    sendHeartbeat();

    // Set up intervals – 10 seconds for inbox & new messages, 30 seconds for heartbeat
    intervalRef.current = setInterval(() => {
      loadInbox();
      if (activeConvIdRef.current) pollNewMessages();
    }, 10000); // 👈 increased to 10 seconds

    heartbeatRef.current = setInterval(sendHeartbeat, 30000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [user, loadInbox, sendHeartbeat, pollNewMessages]); // depends on stable callbacks

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
    openConversation,
    sendMessage,
    loadMoreMessages,
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