// src/contexts/DmContext.jsx
'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import * as E2E from '@/lib/e2e';
import { useWs } from '@/contexts/WsContext';

const DmContext = createContext();

export function DmProvider({ children }) {
  const { user } = useAuth();
  const { registerHandler, joinConversation, leaveConversation, sendTyping } = useWs();

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

  // ── Refs ──
  const userRef = useRef(user);
  const activeConvIdRef = useRef(activeConvId);
  const latestIdRef = useRef(latestId);
  const inboxRef = useRef(inbox);
  const messagesRef = useRef(messages);

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

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const typingTimeoutRef = useRef(null);

  // ── Load inbox ──
  const loadInbox = useCallback(async () => {
    if (!userRef.current) return;
    try {
      const res = await apiClient('/api/dm/inbox');
      const data = Array.isArray(res.data) ? res.data : [];
      setInbox(data);
    } catch (_) {}
  }, []);

  // ── Poll new messages (fallback) ──
  const pollNewMessages = useCallback(async () => {
    const convId = activeConvIdRef.current;
    const lastId = latestIdRef.current;
    if (!convId || !lastId || !userRef.current) return;

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
      await apiClient(`/api/dm/conversations/${convId}/read`, { method: 'PATCH' });
      loadInbox();
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

    if (activeConvIdRef.current) {
      leaveConversation(activeConvIdRef.current);
    }

    setActiveConvId(convId);
    setActiveOther({ id: conv.other_id, name: conv.other_name, picture: conv.other_picture });
    setMessages([]);
    setHasMore(false);
    setCursor(null);
    setLatestId(null);

    joinConversation(convId);

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
      await apiClient(`/api/dm/conversations/${convId}/read`, { method: 'PATCH' });
      setInbox((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, unread_count: 0 } : c))
      );
    } catch (_) {}
  }, [joinConversation, leaveConversation]);

  const closeConversation = useCallback(() => {
    if (activeConvIdRef.current) {
      leaveConversation(activeConvIdRef.current);
    }
    setActiveConvId(null);
    setActiveOther(null);
    setMessages([]);
    setLatestId(null);
    setCursor(null);
    setHasMore(false);
    setTyping(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [leaveConversation]);

  const loadMoreMessages = useCallback(async () => {
    if (!activeConvIdRef.current || !hasMore || loadingMore || !cursor) return;
    setLoadingMore(true);
    const conv = inboxRef.current.find((c) => c.id === activeConvIdRef.current);
    try {
      const res = await apiClient(
        `/api/dm/conversations/${activeConvIdRef.current}/messages?limit=10&before_id=${cursor}`
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
  }, [hasMore, loadingMore, cursor]);

  // ── Send message (fixed: no manual JSON.stringify) ──
  const sendMessage = useCallback(async (text) => {
    if (!userRef.current || !activeConvIdRef.current || !text.trim()) return;
    const conv = inboxRef.current.find((c) => c.id === activeConvIdRef.current);
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
      const res = await apiClient(`/api/dm/conversations/${activeConvIdRef.current}/messages`, {
        method: 'POST',
        body: { body: wireBody }, // ✅ plain object – apiClient will stringify
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
  }, [loadInbox]);

  const emitTyping = useCallback((isTyping) => {
    if (activeConvIdRef.current) {
      sendTyping(activeConvIdRef.current, isTyping);
    }
  }, [sendTyping]);

  // ── WS injected message ──
  const wsInjectMessage = useCallback(async (convId, message) => {
    if (activeConvIdRef.current !== convId) return;
    if (messagesRef.current.find((m) => m.id === message.id)) return;

    let plain = message.body;
    if (plain && plain.startsWith('e2e:')) {
      const conv = inboxRef.current.find((c) => c.id === convId);
      if (conv) {
        plain = await E2E.decrypt(conv.other_id, plain, apiClient);
      }
    }
    message._plain = plain;

    setMessages((prev) => [...prev, message]);
    setLatestId(message.id);
    await apiClient(`/api/dm/conversations/${convId}/read`, { method: 'PATCH' });
  }, []);

  const wsRefreshInbox = useCallback((convId, message) => {
    setInbox((prev) => {
      const idx = prev.findIndex((c) => c.id === convId);
      if (idx !== -1) {
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          last_message: message.body,
          last_sender_id: message.sender_id,
          last_message_at: message.created_at,
          unread_count:
            message.sender_id !== userRef.current?.id &&
            convId !== activeConvIdRef.current
              ? (updated[idx].unread_count || 0) + 1
              : updated[idx].unread_count,
        };
        return updated;
      }
      loadInbox();
      return prev;
    });
  }, [loadInbox]);

  const handleMessageSeen = useCallback((msg) => {
    if (activeConvIdRef.current !== msg.conversationId) return;
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.messageId ? { ...m, is_read: 1 } : m))
    );
  }, []);

  const handleDMRead = useCallback((msg) => {
    if (activeConvIdRef.current !== msg.conversationId) return;
    setMessages((prev) => {
      const lastSent = [...prev].reverse().find((m) => m.sender_id === userRef.current?.id);
      if (lastSent) {
        return prev.map((m) => (m.id === lastSent.id ? { ...m, is_read: 1 } : m));
      }
      return prev;
    });
  }, []);

  const handleTyping = useCallback((msg) => {
    if (activeConvIdRef.current !== msg.conversationId) return;
    setTyping(msg.isTyping);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (msg.isTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        setTyping(false);
        typingTimeoutRef.current = null;
      }, 3000);
    }
  }, []);

  // ── Register WS handlers ──
  useEffect(() => {
    const unregNewDM = registerHandler('new_dm', (msg) => {
      wsInjectMessage(msg.conversationId, msg.message);
      wsRefreshInbox(msg.conversationId, msg.message);
    });

    const unregMessageSeen = registerHandler('message_seen', (msg) => {
      handleMessageSeen(msg);
    });

    const unregDMRead = registerHandler('dm_read', (msg) => {
      handleDMRead(msg);
    });

    const unregTyping = registerHandler('typing', (msg) => {
      handleTyping(msg);
    });

    return () => {
      unregNewDM();
      unregMessageSeen();
      unregDMRead();
      unregTyping();
    };
  }, [registerHandler, wsInjectMessage, wsRefreshInbox, handleMessageSeen, handleDMRead, handleTyping]);

  // ── Polling and initial load ──
  useEffect(() => {
    if (!user) {
      if (window._dmInterval) clearInterval(window._dmInterval);
      if (window._heartbeatInterval) clearInterval(window._heartbeatInterval);
      setInbox([]);
      setMessages([]);
      return;
    }

    loadInbox();
    sendHeartbeat();

    const dmInterval = setInterval(() => {
      loadInbox();
      if (activeConvIdRef.current) pollNewMessages();
    }, 10000);

    const heartbeatInterval = setInterval(sendHeartbeat, 30000);

    window._dmInterval = dmInterval;
    window._heartbeatInterval = heartbeatInterval;

    return () => {
      clearInterval(dmInterval);
      clearInterval(heartbeatInterval);
      window._dmInterval = null;
      window._heartbeatInterval = null;
    };
  }, [user, loadInbox, sendHeartbeat, pollNewMessages]);

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
    closeConversation,
    sendMessage,
    loadMoreMessages,
    emitTyping,
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