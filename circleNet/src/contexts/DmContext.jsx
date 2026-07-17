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
  const [otherOnline, setOtherOnline] = useState(false);

  const userRef = useRef(user);
  const activeConvIdRef = useRef(activeConvId);
  const latestIdRef = useRef(latestId);
  const inboxRef = useRef(inbox);
  const typingTimeoutRef = useRef(null);
  const presenceIntervalRef = useRef(null);

  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { activeConvIdRef.current = activeConvId; }, [activeConvId]);
  useEffect(() => { latestIdRef.current = latestId; }, [latestId]);
  useEffect(() => { inboxRef.current = inbox; }, [inbox]);

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
    if (!convId || !lastId || !userRef.current) return;

    try {
      const res = await apiClient(`/api/dm/conversations/${convId}/messages/new?after_id=${lastId}`);
      const msgs = Array.isArray(res.data) ? res.data : [];
      if (!msgs.length) return;

      const conv = inboxRef.current.find((c) => c.id === convId);
      const decrypted = await Promise.all(
        msgs.map(async (m) => {
          if (m.body?.startsWith('e2e:') && conv) {
            try {
              const plain = await E2E.decrypt(conv.other_id, m.body, apiClient);
              return { ...m, _plain: plain || '[Unable to decrypt]' };
            } catch (err) {
              console.error('[DM] Decryption error:', err);
              return { ...m, _plain: '[🔒 Encrypted message]' };
            }
          }
          return { ...m, _plain: m.body };
        })
      );

      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const newMsgs = decrypted.filter((m) => !existingIds.has(m.id));
        return [...prev, ...newMsgs];
      });

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

  // ── Fetch presence ──
  const fetchPresence = useCallback(async () => {
    const convId = activeConvIdRef.current;
    if (!convId) return;
    try {
      const res = await apiClient(`/api/dm/conversations/${convId}/presence`);
      setOtherOnline(res.data?.online || false);
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
    setTyping(false);
    setOtherOnline(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    joinConversation(convId);

    try {
      const res = await apiClient(`/api/dm/conversations/${convId}/messages?limit=10`);
      const msgs = res.data?.messages || [];
      const hasMoreData = res.data?.hasMore || false;
      const decrypted = await Promise.all(
        msgs.map(async (m) => {
          if (m.body?.startsWith('e2e:') && conv) {
            try {
              const plain = await E2E.decrypt(conv.other_id, m.body, apiClient);
              return { ...m, _plain: plain || '[Unable to decrypt]' };
            } catch (err) {
              console.error('[DM] Decryption error:', err);
              return { ...m, _plain: '[🔒 Encrypted message]' };
            }
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

    fetchPresence();
  }, [joinConversation, leaveConversation, fetchPresence]);

  // ── Start a new conversation ──
  const startConversation = useCallback(async (userId) => {
    if (!userRef.current) return;
    // Check if conversation already exists
    const existing = inboxRef.current.find((c) => c.other_id === userId);
    if (existing) {
      openConversation(existing.id);
      return;
    }
    // Create new conversation
    try {
      const res = await apiClient('/api/dm/conversations', {
        method: 'POST',
        body: { recipientId: userId },
      });
      const data = res.data || res;
      if (data.conversationId) {
        await loadInbox();
        // After load, find the new conversation
        const newConv = inboxRef.current.find((c) => c.other_id === userId);
        if (newConv) {
          openConversation(newConv.id);
        }
      }
    } catch (err) {
      console.error('[DM] Failed to start conversation:', err);
    }
  }, [openConversation, loadInbox]);

  // ── Close conversation ──
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
    setOtherOnline(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (presenceIntervalRef.current) {
      clearInterval(presenceIntervalRef.current);
      presenceIntervalRef.current = null;
    }
  }, [leaveConversation]);

  // ── Load more messages ──
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
            try {
              const plain = await E2E.decrypt(conv.other_id, m.body, apiClient);
              return { ...m, _plain: plain || '[Unable to decrypt]' };
            } catch (err) {
              console.error('[DM] Decryption error:', err);
              return { ...m, _plain: '[🔒 Encrypted message]' };
            }
          }
          return { ...m, _plain: m.body };
        })
      );

      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const newMsgs = decrypted.filter((m) => !existingIds.has(m.id));
        return [...newMsgs, ...prev];
      });

      setHasMore(hasMoreData);
      setCursor(decrypted.length ? decrypted[0].id : cursor);
    } catch (_) {}
    setLoadingMore(false);
  }, [hasMore, loadingMore, cursor]);

  // ── Send message ──
  const sendMessage = useCallback(
    async (text) => {
      if (!userRef.current || !activeConvIdRef.current || !text.trim()) return;
      const conv = inboxRef.current.find((c) => c.id === activeConvIdRef.current);
      if (!conv) return;

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      emitTyping(false);

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
          body: { body: wireBody },
        });
        const saved = res.data || res;
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        if (saved && saved.id) {
          saved._plain = text;
          setMessages((prev) => {
            if (prev.find((m) => m.id === saved.id)) return prev;
            return [...prev, saved];
          });
          setLatestId(saved.id);
        }
        loadInbox();
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        throw err;
      }
    },
    [loadInbox]
  );

  const emitTyping = useCallback(
    (isTyping) => {
      if (activeConvIdRef.current) {
        const convId = Number(activeConvIdRef.current);
        if (!isNaN(convId)) {
          sendTyping(convId, isTyping);
        }
      }
    },
    [sendTyping]
  );

  // ── EDIT MESSAGE ──
  const editMessage = useCallback(
    async (messageId, newText) => {
      if (!userRef.current || !activeConvIdRef.current || !newText.trim()) return;
      const conv = inboxRef.current.find((c) => c.id === activeConvIdRef.current);
      if (!conv) return;

      // Optimistically update the local message
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, _plain: newText, body: newText, edited_at: new Date().toISOString() }
            : m
        )
      );

      try {
        const wireBody = await E2E.encrypt(conv.other_id, newText, apiClient);
        await apiClient(`/api/dm/messages/${messageId}`, {
          method: 'PATCH',
          body: { body: wireBody },
        });
        // The WebSocket will broadcast an update; we already updated optimistically.
        // But we might get a WS 'message_edited' event that will sync with server timestamp.
        // We'll rely on that to keep consistency.
        loadInbox(); // refresh inbox (last message might change)
      } catch (err) {
        // Revert optimistic update
        console.error('[DM] Edit failed:', err);
        // Optionally reload messages or revert – we can just reload the conversation
        if (activeConvIdRef.current) {
          openConversation(activeConvIdRef.current);
        }
        throw err;
      }
    },
    [loadInbox, openConversation]
  );

  // ── DELETE MESSAGE ──
  const deleteMessage = useCallback(
    async (messageId) => {
      if (!userRef.current || !activeConvIdRef.current) return;

      // Remove optimistically
      setMessages((prev) => prev.filter((m) => m.id !== messageId));

      try {
        await apiClient(`/api/dm/messages/${messageId}`, {
          method: 'DELETE',
        });
        // WS 'message_deleted' will also arrive, but we already removed it.
        loadInbox(); // refresh inbox in case last message changes
      } catch (err) {
        console.error('[DM] Delete failed:', err);
        // Revert – reload conversation
        if (activeConvIdRef.current) {
          openConversation(activeConvIdRef.current);
        }
        throw err;
      }
    },
    [loadInbox, openConversation]
  );

  // ── WS handlers ──
  const wsInjectMessage = useCallback(async (convId, message) => {
    if (activeConvIdRef.current !== convId) return;

    let plain = message.body;
    if (plain && plain.startsWith('e2e:')) {
      const conv = inboxRef.current.find((c) => c.id === convId);
      if (conv) {
        try {
          plain = await E2E.decrypt(conv.other_id, plain, apiClient);
          plain = plain || '[Unable to decrypt]';
        } catch (err) {
          console.error('[DM] WS decryption error:', err);
          plain = '[🔒 Encrypted message]';
        }
      }
    }
    message._plain = plain;

    setMessages((prev) => {
      if (prev.find((m) => m.id === message.id)) return prev;
      return [...prev, message];
    });

    setLatestId(message.id);
    await apiClient(`/api/dm/conversations/${convId}/read`, { method: 'PATCH' });
  }, []);

  const wsRefreshInbox = useCallback(
    (convId, message) => {
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
    },
    [loadInbox]
  );

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

  // ── WS handlers for edit & delete ──
  const handleMessageEdited = useCallback((data) => {
    if (activeConvIdRef.current !== data.conversationId) return;
    // data: { conversationId, messageId, body, edited_at }
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === data.messageId) {
          const updated = { ...m, body: data.body, edited_at: data.edited_at };
          // If we have a _plain, try to decrypt if it's e2e
          if (data.body?.startsWith('e2e:')) {
            const conv = inboxRef.current.find((c) => c.id === data.conversationId);
            if (conv) {
              E2E.decrypt(conv.other_id, data.body, apiClient)
                .then((plain) => {
                  setMessages((prev2) =>
                    prev2.map((m2) =>
                      m2.id === data.messageId ? { ...m2, _plain: plain || '[Unable to decrypt]' } : m2
                    )
                  );
                })
                .catch(() => {});
            }
          } else {
            updated._plain = data.body;
          }
          return updated;
        }
        return m;
      })
    );
  }, []);

  const handleMessageDeleted = useCallback((data) => {
    if (activeConvIdRef.current !== data.conversationId) return;
    setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
  }, []);

  // ── Register WS handlers ──
  useEffect(() => {
    const unregNewDM = registerHandler('new_dm', (msg) => {
      wsInjectMessage(msg.conversationId, msg.message);
      wsRefreshInbox(msg.conversationId, msg.message);
    });
    const unregMessageSeen = registerHandler('message_seen', handleMessageSeen);
    const unregDMRead = registerHandler('dm_read', handleDMRead);
    const unregTyping = registerHandler('typing', handleTyping);
    const unregMessageEdited = registerHandler('message_edited', handleMessageEdited);
    const unregMessageDeleted = registerHandler('message_deleted', handleMessageDeleted);

    return () => {
      unregNewDM();
      unregMessageSeen();
      unregDMRead();
      unregTyping();
      unregMessageEdited();
      unregMessageDeleted();
    };
  }, [
    registerHandler,
    wsInjectMessage,
    wsRefreshInbox,
    handleMessageSeen,
    handleDMRead,
    handleTyping,
    handleMessageEdited,
    handleMessageDeleted,
  ]);

  // ── Presence polling ──
  useEffect(() => {
    if (activeConvId) {
      fetchPresence();
      if (presenceIntervalRef.current) clearInterval(presenceIntervalRef.current);
      presenceIntervalRef.current = setInterval(fetchPresence, 30000);
    } else {
      if (presenceIntervalRef.current) {
        clearInterval(presenceIntervalRef.current);
        presenceIntervalRef.current = null;
      }
    }
    return () => {
      if (presenceIntervalRef.current) {
        clearInterval(presenceIntervalRef.current);
        presenceIntervalRef.current = null;
      }
    };
  }, [activeConvId, fetchPresence]);

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
    otherOnline,
    loadInbox,
    openConversation,
    closeConversation,
    startConversation,
    sendMessage,
    loadMoreMessages,
    emitTyping,
    pollNewMessages,
    editMessage,   // ✅ added
    deleteMessage, // ✅ added
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