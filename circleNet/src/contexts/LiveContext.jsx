// src/contexts/LiveContext.jsx
'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import { useWs } from '@/contexts/WsContext';

const LiveContext = createContext();

export function LiveProvider({ children }) {
  const { user } = useAuth();
  const { registerHandler, sendMessage: wsSend } = useWs();

  const [activeSessions, setActiveSessions] = useState([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [role, setRole] = useState(null); // 'host' | 'viewer' | null
  const [sessionId, setSessionId] = useState(null);
  const [title, setTitle] = useState('');
  const [broadcasterName, setBroadcasterName] = useState('');
  const [broadcasterAvatar, setBroadcasterAvatar] = useState('');
  const [viewerCount, setViewerCount] = useState(0);
  const [chatMessages, setChatMessages] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [micMuted, setMicMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [isSetupOpen, setIsSetupOpen] = useState(false);

  const localStreamRef = useRef(null);
  const peersRef = useRef({});
  const peerConnRef = useRef(null);
  const wsRef = useRef(null);

  // ── Load active sessions ──
  const loadActiveSessions = useCallback(async () => {
    setIsLoadingSessions(true);
    try {
      const res = await apiClient('/api/live/active');
      const sessions = Array.isArray(res.data) ? res.data : Array.isArray(res) ? res : [];
      setActiveSessions(sessions);
    } catch (_) {
      console.warn('[Live] Failed to load active sessions');
    } finally {
      setIsLoadingSessions(false);
    }
  }, []);

  // ── Open setup modal ──
  const openSetup = useCallback(async () => {
    if (!user) {
      alert('Please log in to go live.');
      return;
    }
    setIsSetupOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      localStreamRef.current = stream;
    } catch (err) {
      console.error('[Live] Camera/mic denied:', err);
      alert('Camera or microphone access was denied.');
      setIsSetupOpen(false);
    }
  }, [user]);

  const closeSetup = useCallback(() => {
    setIsSetupOpen(false);
    if (localStreamRef.current && role !== 'host') {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      setLocalStream(null);
      localStreamRef.current = null;
    }
  }, [role]);

  // ── Start live (host) ──
  const startLive = useCallback(async (titleText) => {
    if (!localStreamRef.current) {
      alert('No camera/mic stream available.');
      return;
    }
    try {
      const res = await apiClient('/api/live/start', {
        method: 'POST',
        body: JSON.stringify({ title: titleText }),
      });
      const data = res.data || res;
      setSessionId(data.sessionId);
      setTitle(data.title || titleText);
      setRole('host');
      setBroadcasterName(data.broadcasterName || user.name || user.username || '');
      setBroadcasterAvatar(data.broadcasterAvatar || user.picture || '');
      setIsSetupOpen(false);
      setIsOverlayOpen(true);
      // Force video on
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) videoTrack.enabled = true;
      setCamOff(false);
      // Notify via WS
      wsSend({
        type: 'live:started',
        sessionId: data.sessionId,
        broadcasterName: broadcasterName,
        broadcasterAvatar: broadcasterAvatar,
        title: titleText,
        hostId: user.id,
      });
    } catch (err) {
      console.error('[Live] Failed to start:', err);
      alert(err.message || 'Could not start stream.');
    }
  }, [user, wsSend, broadcasterName, broadcasterAvatar]);

  // ── Watch session ──
  const watchSession = useCallback(async (sessionId) => {
    if (!user) {
      alert('Please log in to watch.');
      return;
    }
    setSessionId(sessionId);
    setRole('viewer');
    setIsOverlayOpen(true);
    try {
      const res = await apiClient(`/api/live/${sessionId}`);
      const data = res.data || res;
      setBroadcasterName(data.broadcasterName || '');
      setBroadcasterAvatar(data.broadcasterAvatar || '');
      setTitle(data.title || '');
    } catch (_) {}
    // Send viewer_join via WS
    wsSend({
      type: 'live:viewer_join',
      sessionId,
      viewerId: user.id,
      viewerName: user.username || user.name || null,
    });
  }, [user, wsSend]);

  // ── Close live ──
  const closeLive = useCallback(async () => {
    if (role === 'host') {
      if (!confirm('End your live stream?')) return;
      try {
        await apiClient('/api/live/end', { method: 'POST', body: JSON.stringify({ sessionId }) });
      } catch (_) {}
      Object.values(peersRef.current).forEach((pc) => pc.close());
      peersRef.current = {};
      wsSend({ type: 'live:ended', sessionId });
    } else if (role === 'viewer') {
      if (peerConnRef.current) {
        peerConnRef.current.close();
        peerConnRef.current = null;
      }
      wsSend({ type: 'live:viewer_leave', sessionId, viewerId: user?.id });
    }
    // Teardown
    setIsOverlayOpen(false);
    setRole(null);
    setSessionId(null);
    setTitle('');
    setBroadcasterName('');
    setBroadcasterAvatar('');
    setChatMessages([]);
    setViewerCount(0);
    setRemoteStream(null);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      setLocalStream(null);
      localStreamRef.current = null;
    }
    setMicMuted(false);
    setCamOff(false);
  }, [role, sessionId, user, wsSend]);

  // ── Toggle mic ──
  const toggleMic = useCallback(() => {
    if (!localStreamRef.current) return;
    const newState = !micMuted;
    setMicMuted(newState);
    localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = !newState));
  }, [micMuted]);

  // ── Toggle camera ──
  const toggleCam = useCallback(() => {
    if (!localStreamRef.current) return;
    const newState = !camOff;
    setCamOff(newState);
    localStreamRef.current.getVideoTracks().forEach((t) => (t.enabled = !newState));
  }, [camOff]);

  // ── Send chat ──
  const sendChat = useCallback((text) => {
    if (!text.trim() || !sessionId) return;
    const msg = {
      type: 'live:chat_message',
      sessionId,
      senderId: user.id,
      senderName: user.username || user.name || 'You',
      text: text.trim(),
    };
    wsSend(msg);
    setChatMessages((prev) => [...prev, { senderName: msg.senderName, text: msg.text, isSelf: true }]);
  }, [sessionId, user, wsSend]);

  // ── Send reaction ──
  const sendReaction = useCallback((emoji) => {
    if (!sessionId) return;
    wsSend({ type: 'live:reaction', sessionId, emoji });
  }, [sessionId, wsSend]);

  // ── WS handlers ──
  const handleWsMessage = useCallback((msg) => {
    switch (msg.type) {
      case 'live:started':
        loadActiveSessions();
        break;
      case 'live:ended':
        setActiveSessions((prev) => prev.filter((s) => s.sessionId !== msg.sessionId));
        if (role === 'viewer' && sessionId === msg.sessionId) {
          // Show ended screen – we can set a flag
          setIsOverlayOpen(false);
        }
        break;
      case 'live:viewer_joined':
        setViewerCount(msg.viewerCount);
        if (role === 'host') {
          // handle RTC offer (simplified – you'd call a function)
          // For full implementation, use WebRTC logic
        }
        break;
      case 'live:viewer_left':
        setViewerCount(msg.viewerCount);
        break;
      case 'live:chat_message':
        if (sessionId === msg.sessionId && msg.senderId !== user?.id) {
          setChatMessages((prev) => [...prev, { senderName: msg.senderName, text: msg.text, isSelf: false }]);
        }
        break;
      case 'live:reaction':
        if (sessionId === msg.sessionId) {
          // Handle emoji float – can be done by the component
        }
        break;
      default:
        break;
    }
  }, [loadActiveSessions, role, sessionId, user]);

  // ── Register WS handlers ──
  useEffect(() => {
    const liveTypes = [
      'live:started', 'live:ended', 'live:viewer_joined',
      'live:viewer_left', 'live:chat_message', 'live:reaction',
      'live:offer', 'live:answer', 'live:ice_candidate'
    ];
    const unsubscribers = liveTypes.map(type =>
      registerHandler(type, handleWsMessage)
    );
    return () => unsubscribers.forEach(fn => fn());
  }, [registerHandler, handleWsMessage]);

  // ── Periodic refresh of active sessions ──
  useEffect(() => {
    loadActiveSessions();
    const interval = setInterval(loadActiveSessions, 30000);
    return () => clearInterval(interval);
  }, [loadActiveSessions]);

  const value = {
    activeSessions,
    isLoadingSessions,
    role,
    sessionId,
    title,
    broadcasterName,
    broadcasterAvatar,
    viewerCount,
    chatMessages,
    localStream: localStreamRef.current,
    remoteStream,
    micMuted,
    camOff,
    isOverlayOpen,
    isSetupOpen,
    openSetup,
    closeSetup,
    startLive,
    watchSession,
    closeLive,
    toggleMic,
    toggleCam,
    sendChat,
    sendReaction,
    loadActiveSessions,
  };

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function useLive() {
  const context = useContext(LiveContext);
  if (!context) {
    throw new Error('useLive must be used within a LiveProvider');
  }
  return context;
}