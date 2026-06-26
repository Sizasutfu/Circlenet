// src/contexts/LiveContext.jsx
'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';

const LiveContext = createContext();

// ── ICE server configuration ──
const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

// ── Reactions ──
const REACTIONS = ['❤️', '🔥', '👏', '😂'];

export function LiveProvider({ children }) {
  const { user } = useAuth();

  // ── State ──
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
  const [activeSessions, setActiveSessions] = useState([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  // ── Refs for WebRTC peers ──
  const peersRef = useRef({}); // host: { viewerId: RTCPeerConnection }
  const peerConnRef = useRef(null); // viewer: single RTCPeerConnection
  const pendingOfferRef = useRef(null);
  const pendingIceCandidatesRef = useRef([]);
  const localStreamRef = useRef(null);
  const wsRef = useRef(null);

  // ── Load active sessions ──
  const loadActiveSessions = useCallback(async () => {
    setIsLoadingSessions(true);
    try {
      const res = await apiClient('/api/live/active');
      const sessions = Array.isArray(res.data) ? res.data : Array.isArray(res) ? res : [];
      setActiveSessions(sessions);
    } catch (err) {
      console.error('Failed to load active sessions:', err);
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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setLocalStream(stream);
      localStreamRef.current = stream;
    } catch (err) {
      console.error('Camera/mic access denied:', err);
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
    } catch (err) {
      console.error('Failed to start live:', err);
      alert(err.message || 'Could not start stream.');
    }
  }, [user]);

  // ── Watch a session (viewer) ──
  const watchSession = useCallback(async (sessionId) => {
    if (!user) {
      alert('Please log in to watch.');
      return;
    }
    setSessionId(sessionId);
    setRole('viewer');
    setIsOverlayOpen(true);
    // Fetch session metadata
    try {
      const res = await apiClient(`/api/live/${sessionId}`);
      const data = res.data || res;
      setBroadcasterName(data.broadcasterName || '');
      setBroadcasterAvatar(data.broadcasterAvatar || '');
      setTitle(data.title || '');
    } catch (_) {}

    // Send viewer_join via WebSocket
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'live:viewer_join',
        sessionId,
        viewerId: user.id,
        viewerName: user.username || user.name || null,
      }));
    }

    // Process any pending offer
    if (pendingOfferRef.current) {
      const { hostId, sdp } = pendingOfferRef.current;
      pendingOfferRef.current = null;
      handleOffer(hostId, sdp);
    }
  }, [user]);

  // ── Close live stream ──
  const closeLive = useCallback(async () => {
    if (role === 'host') {
      if (!confirm('End your live stream?')) return;
      try {
        await apiClient('/api/live/end', {
          method: 'POST',
          body: JSON.stringify({ sessionId }),
        });
      } catch (_) {}
      // Close all peer connections
      Object.values(peersRef.current).forEach((pc) => pc.close());
      peersRef.current = {};
      if (wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'live:ended',
          sessionId,
        }));
      }
    } else if (role === 'viewer') {
      if (peerConnRef.current) {
        peerConnRef.current.close();
        peerConnRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'live:viewer_leave',
          sessionId,
          viewerId: user?.id,
        }));
      }
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
  }, [role, sessionId, user]);

  // ── Toggle mic ──
  const toggleMic = useCallback(() => {
    if (!localStreamRef.current) return;
    const newState = !micMuted;
    setMicMuted(newState);
    localStreamRef.current.getAudioTracks().forEach((t) => {
      t.enabled = !newState;
    });
  }, [micMuted]);

  // ── Toggle camera ──
  const toggleCam = useCallback(() => {
    if (!localStreamRef.current) return;
    const newState = !camOff;
    setCamOff(newState);
    localStreamRef.current.getVideoTracks().forEach((t) => {
      t.enabled = !newState;
    });
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
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify(msg));
    }
    // Optimistically add to chat
    setChatMessages((prev) => [...prev, { senderName: msg.senderName, text: msg.text, isSelf: true }]);
  }, [sessionId, user]);

  // ── Send reaction ──
  const sendReaction = useCallback((emoji) => {
    // Emoji floats on client side (handled by component)
    if (wsRef.current && sessionId) {
      wsRef.current.send(JSON.stringify({
        type: 'live:reaction',
        sessionId,
        emoji,
      }));
    }
  }, [sessionId]);

  // ── WebRTC: Host side ──
  const handleViewerJoined = useCallback(async (viewerId) => {
    if (role !== 'host') return;
    if (!localStreamRef.current || localStreamRef.current.getTracks().length === 0) return;

    const pc = new RTCPeerConnection(ICE_CONFIG);
    peersRef.current[viewerId] = pc;

    localStreamRef.current.getTracks().forEach((track) => {
      if (track.readyState === 'live') {
        pc.addTrack(track, localStreamRef.current);
      }
    });

    pc.onicecandidate = ({ candidate }) => {
      if (candidate && wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'live:ice_candidate',
          sessionId,
          to: viewerId,
          candidate,
        }));
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        pc.restartIce();
      }
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        pc.close();
        delete peersRef.current[viewerId];
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'live:offer',
        sessionId,
        to: viewerId,
        sdp: pc.localDescription,
      }));
    }
  }, [role, sessionId]);

  const handleAnswer = useCallback(async (viewerId, sdp) => {
    const pc = peersRef.current[viewerId];
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
  }, []);

  const handleHostIce = useCallback(async (viewerId, candidate) => {
    const pc = peersRef.current[viewerId];
    if (!pc) return;
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (_) {}
  }, []);

  // ── WebRTC: Viewer side ──
  const handleOffer = useCallback(async (hostId, sdp) => {
    if (role !== 'viewer') {
      pendingOfferRef.current = { hostId, sdp };
      return;
    }
    const pc = new RTCPeerConnection(ICE_CONFIG);
    peerConnRef.current = pc;

    pc.onicecandidate = ({ candidate }) => {
      if (candidate && wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'live:ice_candidate',
          sessionId,
          to: hostId,
          candidate,
        }));
      }
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      } else {
        const stream = new MediaStream([event.track]);
        setRemoteStream(stream);
      }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    // Add pending ICE candidates
    for (const candidate of pendingIceCandidatesRef.current) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (_) {}
    }
    pendingIceCandidatesRef.current = [];
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'live:answer',
        sessionId,
        to: hostId,
        sdp: pc.localDescription,
      }));
    }
  }, [role, sessionId]);

  const handleViewerIce = useCallback(async (candidate) => {
    if (peerConnRef.current) {
      try {
        await peerConnRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (_) {}
    } else {
      pendingIceCandidatesRef.current.push(candidate);
    }
  }, []);

  // ── WebSocket message handler ──
  const handleWsMessage = useCallback((msg) => {
    switch (msg.type) {
      case 'live:started':
        // Add to active sessions (handled by periodic refresh)
        loadActiveSessions();
        // Show toast (handled by LiveToast component)
        break;

      case 'live:ended':
        setActiveSessions((prev) => prev.filter((s) => s.sessionId !== msg.sessionId));
        if (role === 'viewer' && sessionId === msg.sessionId) {
          // Show ended screen
          setIsOverlayOpen(false);
          // Could set a flag to show ended screen in overlay
        }
        break;

      case 'live:viewer_joined':
        setViewerCount(msg.viewerCount);
        if (role === 'host') {
          handleViewerJoined(msg.viewerId);
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
          // Emoji float handled by component
        }
        break;

      case 'live:offer':
        handleOffer(msg.from, msg.sdp);
        break;

      case 'live:answer':
        handleAnswer(msg.from, msg.sdp);
        break;

      case 'live:ice_candidate':
        if (role === 'host') {
          handleHostIce(msg.from, msg.candidate);
        } else {
          handleViewerIce(msg.candidate);
        }
        break;

      default:
        break;
    }
  }, [role, sessionId, user, loadActiveSessions, handleViewerJoined, handleOffer, handleAnswer, handleHostIce, handleViewerIce]);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      Object.values(peersRef.current).forEach((pc) => pc.close());
      if (peerConnRef.current) peerConnRef.current.close();
    };
  }, []);

  const value = {
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
    activeSessions,
    isLoadingSessions,
    REACTIONS,
    openSetup,
    closeSetup,
    startLive,
    watchSession,
    closeLive,
    toggleMic,
    toggleCam,
    sendChat,
    sendReaction,
    handleWsMessage,
    loadActiveSessions,
    setChatMessages,
    setViewerCount,
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