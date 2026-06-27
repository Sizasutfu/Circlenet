// src/contexts/WsContext.jsx
'use client';

import { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth';

const WsContext = createContext();

function getWsUrl() {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';
  return base.replace(/^http/, 'ws') + '/ws';
}

export function WsProvider({ children }) {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const handlersRef = useRef(new Map()); // type → Set of handlers
  const reconnectTimerRef = useRef(null);
  const reconnectMsRef = useRef(1500);
  const pingIntervalRef = useRef(null);
  const isConnectedRef = useRef(false);

  // ── Register / unregister handlers ──
  const registerHandler = useCallback((type, handler) => {
    if (!handlersRef.current.has(type)) {
      handlersRef.current.set(type, new Set());
    }
    handlersRef.current.get(type).add(handler);
    return () => {
      handlersRef.current.get(type)?.delete(handler);
    };
  }, []);

  // ── Send message ──
  const sendMessage = useCallback((payload) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }, []);

  // ── Conversation management ──
  const joinConversation = useCallback((convId) => {
    sendMessage({ type: 'join_conversation', conversationId: convId });
  }, [sendMessage]);

  const leaveConversation = useCallback((convId) => {
    sendMessage({ type: 'leave_conversation', conversationId: convId });
  }, [sendMessage]);

  const sendTyping = useCallback((convId, isTyping) => {
    sendMessage({ type: 'typing', conversationId: convId, isTyping });
  }, [sendMessage]);

  // ── Connect / disconnect ──
  const connect = useCallback(() => {
    if (!user?.id) return;
    if (socketRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(`${getWsUrl()}?userId=${user.id}`);
    socketRef.current = ws;

    ws.addEventListener('open', () => {
      isConnectedRef.current = true;
      reconnectMsRef.current = 1500;
      // Start ping
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = setInterval(() => {
        sendMessage({ type: 'ping' });
      }, 25000);
    });

    ws.addEventListener('message', (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }
      const handlers = handlersRef.current.get(msg.type);
      if (handlers) {
        handlers.forEach((handler) => handler(msg));
      }
    });

    ws.addEventListener('close', (e) => {
      isConnectedRef.current = false;
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      if (e.code === 4001) return; // auth failure – don't retry
      if (!user?.id) return; // logged out
      // Reconnect with exponential backoff
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(() => {
        connect();
        reconnectMsRef.current = Math.min(reconnectMsRef.current * 2, 30000);
      }, reconnectMsRef.current);
    });

    ws.addEventListener('error', (e) => {
      console.warn('[WS] Error:', e);
    });
  }, [user, sendMessage]);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    isConnectedRef.current = false;
  }, []);

  // ── Auto‑connect/disconnect on auth change ──
  useEffect(() => {
    if (user) {
      connect();
    } else {
      disconnect();
    }
    return () => disconnect();
  }, [user, connect, disconnect]);

  const isAlive = () => isConnectedRef.current;

  const value = {
    isAlive,
    sendMessage,
    joinConversation,
    leaveConversation,
    sendTyping,
    registerHandler,
  };

  return <WsContext.Provider value={value}>{children}</WsContext.Provider>;
}

export function useWs() {
  const context = useContext(WsContext);
  if (!context) {
    throw new Error('useWs must be used within a WsProvider');
  }
  return context;
}