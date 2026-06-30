// src/contexts/LiveContext.jsx
"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useAuth } from "@/lib/auth";
import { apiClient } from "@/lib/api";
import { useWs } from "@/contexts/WsContext";

const LiveContext = createContext();

const RTC_CONFIG = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export function LiveProvider({ children }) {
  const { user } = useAuth();
  const { sendMessage: wsSend, registerHandler } = useWs();

  const [activeSessions, setActiveSessions] = useState([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [role, setRole] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [title, setTitle] = useState("");
  const [broadcasterName, setBroadcasterName] = useState("");
  const [broadcasterAvatar, setBroadcasterAvatar] = useState("");
  const [viewerCount, setViewerCount] = useState(0);
  const [chatMessages, setChatMessages] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [micMuted, setMicMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [setupError, setSetupError] = useState(null);

  const localStreamRef = useRef(null);
  const peersRef = useRef({});
  const retryTimersRef = useRef({});

  const log = (msg, data) => console.log(`[Live:${role || 'none'}] ${msg}`, data || '');

  // ── Media support ──
  const isMediaSupported = useCallback(() => {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }, []);

  // ── Load active sessions ──
  const loadActiveSessions = useCallback(async () => {
    setIsLoadingSessions(true);
    try {
      const res = await apiClient("/api/live/active");
      const sessions = Array.isArray(res.data) ? res.data : Array.isArray(res) ? res : [];
      setActiveSessions(sessions);
      log('Active sessions loaded', sessions.length);
    } catch (_) {
      console.warn("[Live] Failed to load active sessions");
    } finally {
      setIsLoadingSessions(false);
    }
  }, []);

  // ── Open setup ──
  const openSetup = useCallback(async () => {
    if (!user) { alert("Please log in."); return; }
    if (!isMediaSupported()) {
      setSetupError("Browser doesn't support camera/mic.");
      setIsSetupOpen(true);
      return;
    }
    setSetupError(null);
    setIsSetupOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      localStreamRef.current = stream;
      log('Media stream acquired');
    } catch (err) {
      console.error("[Live] Camera/mic error:", err);
      setSetupError("Could not access camera/microphone: " + err.message);
      setIsSetupOpen(false);
    }
  }, [user, isMediaSupported]);

  // ── Close setup ──
  const closeSetup = useCallback(() => {
    setIsSetupOpen(false);
    setSetupError(null);
    if (localStreamRef.current && role !== "host") {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      setLocalStream(null);
      localStreamRef.current = null;
    }
  }, [role]);

  // ── Start live ──
  const startLive = useCallback(async (titleText) => {
    if (!localStreamRef.current) { alert("No camera/mic."); return; }
    try {
      const res = await apiClient("/api/live/start", { method: "POST", body: { title: titleText } });
      const data = res.data || res;
      const sid = data.sessionId;
      setSessionId(sid);
      setTitle(data.title || titleText);
      setRole("host");
      setBroadcasterName(data.broadcasterName || user.name || user.username || "");
      setBroadcasterAvatar(data.broadcasterAvatar || user.picture || "");
      setIsSetupOpen(false);
      setIsOverlayOpen(true);
      const vt = localStreamRef.current.getVideoTracks()[0];
      if (vt) vt.enabled = true;
      setCamOff(false);
      wsSend({ type: "live:started", sessionId: sid, broadcasterName, broadcasterAvatar, title: titleText, hostId: user.id });
      log('Live started', sid);
    } catch (err) {
      console.error("[Live] Failed to start:", err);
      alert(err.message || "Could not start stream.");
    }
  }, [user, wsSend, broadcasterName, broadcasterAvatar]);

  // ── Watch session ──
  const watchSession = useCallback(async (sid) => {
    if (!user) { alert("Please log in."); return; }
    log('Attempting to watch', sid);
    setSessionId(sid);
    setRole("viewer");
    setIsOverlayOpen(true);
    setRemoteStream(null);

    try {
      const res = await apiClient(`/api/live/${sid}`);
      const data = res.data || res;
      setBroadcasterName(data.broadcasterName || "");
      setBroadcasterAvatar(data.broadcasterAvatar || "");
      setTitle(data.title || "");
    } catch (_) {}

    // Create peer connection (viewer)
    const pc = new RTCPeerConnection(RTC_CONFIG);
    peersRef.current[sid] = pc;

    pc.oniceconnectionstatechange = () => {
      log('ICE connection state', pc.iceConnectionState);
    };
    pc.ontrack = (event) => {
      log('✅ Received remote track!', event.streams[0]);
      setRemoteStream(event.streams[0]);
      if (retryTimersRef.current[sid]) {
        clearTimeout(retryTimersRef.current[sid]);
        delete retryTimersRef.current[sid];
      }
    };
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        log('Sending ICE candidate to host');
        wsSend({
          type: "live:ice_candidate",
          sessionId: sid,
          candidate: event.candidate,
          from: user.id,
          to: null, // will be filled when we know hostId; we'll send after receiving offer
        });
      }
    };

    // We don't know hostId yet; will set when we receive offer (which includes `from`)
    // So we'll modify the onicecandidate to use a variable hostId.
    // We'll override it after receiving the offer.
    // Let's store hostId in a ref.
    const hostIdRef = { current: null };
    // Override the onicecandidate to use hostIdRef.
    pc.onicecandidate = (event) => {
      if (event.candidate && hostIdRef.current) {
        log('Sending ICE candidate to host');
        wsSend({
          type: "live:ice_candidate",
          sessionId: sid,
          candidate: event.candidate,
          from: user.id,
          to: hostIdRef.current,
        });
      }
    };

    // Store the peer and hostIdRef
    peersRef.current[sid] = { pc, hostIdRef };

    // Wait for host's offer (we will not send one)
    // Set a timeout to retry join if no offer arrives
    const retryTimer = setTimeout(() => {
      if (!remoteStream) {
        log('⏳ No offer received – retrying join');
        wsSend({ type: "live:viewer_join", sessionId: sid, viewerId: user.id, viewerName: user.username || user.name || null });
        retryTimersRef.current[sid] = setTimeout(() => {
          if (!remoteStream) {
            log('⏳ Still no stream – please retry manually');
          }
        }, 5000);
      }
    }, 3000);
    retryTimersRef.current[sid] = retryTimer;

    wsSend({ type: "live:viewer_join", sessionId: sid, viewerId: user.id, viewerName: user.username || user.name || null });
  }, [user, wsSend]);

  // ── Close live ──
  const closeLive = useCallback(async () => {
    if (role === "host") {
      if (!confirm("End your live stream?")) return;
      try {
        await apiClient("/api/live/end", { method: "POST", body: { sessionId } });
      } catch (_) {}
      Object.values(peersRef.current).forEach(pc => pc.close());
      peersRef.current = {};
      wsSend({ type: "live:ended", sessionId });
    } else if (role === "viewer") {
      const entry = peersRef.current[sessionId];
      if (entry) {
        entry.pc.close();
        delete peersRef.current[sessionId];
      }
      if (retryTimersRef.current[sessionId]) {
        clearTimeout(retryTimersRef.current[sessionId]);
        delete retryTimersRef.current[sessionId];
      }
      wsSend({ type: "live:viewer_leave", sessionId, viewerId: user?.id });
    }
    setIsOverlayOpen(false);
    setRole(null);
    setSessionId(null);
    setTitle("");
    setBroadcasterName("");
    setBroadcasterAvatar("");
    setChatMessages([]);
    setViewerCount(0);
    setRemoteStream(null);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      setLocalStream(null);
      localStreamRef.current = null;
    }
    setMicMuted(false);
    setCamOff(false);
  }, [role, sessionId, user, wsSend]);

  // ── Toggles ──
  const toggleMic = useCallback(() => {
    if (!localStreamRef.current) return;
    const newState = !micMuted;
    setMicMuted(newState);
    localStreamRef.current.getAudioTracks().forEach(t => t.enabled = !newState);
  }, [micMuted]);

  const toggleCam = useCallback(() => {
    if (!localStreamRef.current) return;
    const newState = !camOff;
    setCamOff(newState);
    localStreamRef.current.getVideoTracks().forEach(t => t.enabled = !newState);
  }, [camOff]);

  // ── Chat & Reactions ──
  const sendChat = useCallback((text) => {
    if (!text.trim() || !sessionId) return;
    const msg = { type: "live:chat_message", sessionId, senderId: user.id, senderName: user.username || user.name || "You", text: text.trim() };
    wsSend(msg);
    setChatMessages(prev => [...prev, { senderName: msg.senderName, text: msg.text, isSelf: true }]);
  }, [sessionId, user, wsSend]);

  const sendReaction = useCallback((emoji) => {
    if (!sessionId) return;
    wsSend({ type: "live:reaction", sessionId, emoji });
  }, [sessionId, wsSend]);

  // ── WebSocket message handler ──
  const handleWsMessage = useCallback((msg) => {
    log('Received WS message', msg.type);
    switch (msg.type) {
      case "live:started":
        loadActiveSessions();
        break;
      case "live:ended":
        setActiveSessions(prev => prev.filter(s => s.sessionId !== msg.sessionId));
        if (role === "viewer" && sessionId === msg.sessionId) setIsOverlayOpen(false);
        break;
      case "live:viewer_joined":
        setViewerCount(msg.viewerCount);
        // Host: create offer for this viewer
        if (role === "host" && sessionId === msg.sessionId) {
          const viewerId = msg.viewerId;
          log('Viewer joined, creating offer for', viewerId);
          let pc = peersRef.current[viewerId];
          if (!pc) {
            pc = new RTCPeerConnection(RTC_CONFIG);
            peersRef.current[viewerId] = pc;
            if (localStreamRef.current) {
              localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));
            }
            pc.onicecandidate = (event) => {
              if (event.candidate) {
                wsSend({
                  type: "live:ice_candidate",
                  sessionId: msg.sessionId,
                  candidate: event.candidate,
                  from: user.id,
                  to: viewerId, // send candidate to this viewer
                });
              }
            };
            pc.oniceconnectionstatechange = () => {
              log('Host ICE state for viewer', pc.iceConnectionState);
            };
          }
          pc.createOffer()
            .then(offer => pc.setLocalDescription(offer))
            .then(() => {
              wsSend({
                type: "live:offer",
                sessionId: msg.sessionId,
                offer: pc.localDescription,
                from: user.id,
                to: viewerId, // send offer specifically to this viewer
              });
              log('Offer sent to viewer', viewerId);
            })
            .catch(err => console.error("[Live] Host offer error:", err));
        }
        break;
      case "live:viewer_left":
        setViewerCount(msg.viewerCount);
        if (role === "host") {
          const viewerId = msg.viewerId;
          const pc = peersRef.current[viewerId];
          if (pc) { pc.close(); delete peersRef.current[viewerId]; }
        }
        break;
      case "live:offer":
        // Viewer receives offer from host
        if (role === "viewer" && sessionId === msg.sessionId) {
          const hostId = msg.from; // host's userId
          const entry = peersRef.current[sessionId];
          if (entry) {
            const { pc, hostIdRef } = entry;
            hostIdRef.current = hostId; // store hostId for ICE candidates
            log('Received offer from host', hostId);
            pc.setRemoteDescription(new RTCSessionDescription(msg.offer))
              .then(() => pc.createAnswer())
              .then(answer => pc.setLocalDescription(answer))
              .then(() => {
                wsSend({
                  type: "live:answer",
                  sessionId: msg.sessionId,
                  answer: pc.localDescription,
                  from: user.id,
                  to: hostId, // send answer back to host
                });
                log('Answer sent to host', hostId);
              })
              .catch(err => console.error("[Live] Viewer answer error:", err));
          }
        }
        break;
      case "live:answer":
        if (role === "host" && sessionId === msg.sessionId) {
          const viewerId = msg.from;
          const pc = peersRef.current[viewerId];
          if (pc) {
            log('Received answer from viewer', viewerId);
            pc.setRemoteDescription(new RTCSessionDescription(msg.answer))
              .catch(err => console.error("[Live] Host set remote desc error:", err));
          }
        }
        break;
      case "live:ice_candidate":
        if (role === "host" && sessionId === msg.sessionId) {
          const viewerId = msg.from;
          const pc = peersRef.current[viewerId];
          if (pc && msg.candidate && msg.from !== user?.id) {
            pc.addIceCandidate(new RTCIceCandidate(msg.candidate))
              .catch(err => console.warn("[Live] Host ICE error:", err));
          }
        } else if (role === "viewer" && sessionId === msg.sessionId) {
          const entry = peersRef.current[sessionId];
          if (entry) {
            const pc = entry.pc;
            if (pc && msg.candidate && msg.from !== user?.id) {
              pc.addIceCandidate(new RTCIceCandidate(msg.candidate))
                .catch(err => console.warn("[Live] Viewer ICE error:", err));
            }
          }
        }
        break;
      case "live:chat_message":
        if (sessionId === msg.sessionId && msg.senderId !== user?.id) {
          setChatMessages(prev => [...prev, { senderName: msg.senderName, text: msg.text, isSelf: false }]);
        }
        break;
      default: break;
    }
  }, [loadActiveSessions, role, sessionId, user, localStreamRef, wsSend]);

  // ── Register handlers ──
  useEffect(() => {
    const types = ["live:started","live:ended","live:viewer_joined","live:viewer_left","live:chat_message","live:reaction","live:offer","live:answer","live:ice_candidate"];
    const unsubs = types.map(type => registerHandler(type, handleWsMessage));
    return () => unsubs.forEach(fn => fn());
  }, [registerHandler, handleWsMessage]);

  // ── Periodic refresh ──
  useEffect(() => {
    loadActiveSessions();
    const interval = setInterval(loadActiveSessions, 30000);
    return () => clearInterval(interval);
  }, [loadActiveSessions]);

  // ── Cleanup ──
  useEffect(() => {
    return () => {
      Object.values(peersRef.current).forEach(pc => pc.close && pc.close());
      if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
      Object.values(retryTimersRef.current).forEach(t => clearTimeout(t));
    };
  }, []);

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
    setupError,
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
  if (!context) throw new Error("useLive must be used within a LiveProvider");
  return context;
}