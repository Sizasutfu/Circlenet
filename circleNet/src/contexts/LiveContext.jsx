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

export function LiveProvider({ children }) {
  const { user } = useAuth();
  const { registerHandler, sendMessage: wsSend } = useWs();

  // ── State ──
  const [activeSessions, setActiveSessions] = useState([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [role, setRole] = useState(null); // 'host' | 'viewer' | null
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

  // ── Refs ──
  const localStreamRef = useRef(null);
  const peersRef = useRef({});
  const peerConnRef = useRef(null);

  // ── Check if media devices are supported ──
  const isMediaSupported = useCallback(() => {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }, []);

  // ── Load active sessions ──
  const loadActiveSessions = useCallback(async () => {
    setIsLoadingSessions(true);
    try {
      const res = await apiClient("/api/live/active");
      const sessions = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res)
          ? res
          : [];
      setActiveSessions(sessions);
    } catch (_) {
      console.warn("[Live] Failed to load active sessions");
    } finally {
      setIsLoadingSessions(false);
    }
  }, []);

  // ── Open setup modal with full error handling ──
  const openSetup = useCallback(async () => {
    if (!user) {
      alert("Please log in to go live.");
      return;
    }

    if (!isMediaSupported()) {
      setSetupError(
        "Your browser does not support camera or microphone access.",
      );
      setIsSetupOpen(true);
      return;
    }

    setSetupError(null);
    setIsSetupOpen(true);

    let retries = 0;
    const maxRetries = 2;

    const requestMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setLocalStream(stream);
        localStreamRef.current = stream;
        setSetupError(null);
      } catch (err) {
        console.error("[Live] Camera/mic error:", err);
        if (
          err.name === "NotAllowedError" ||
          err.name === "PermissionDeniedError"
        ) {
          if (retries < maxRetries) {
            retries++;
            await new Promise((r) => setTimeout(r, 600));
            return requestMedia();
          } else {
            setSetupError(
              "Camera and microphone access is blocked. Please allow access in your browser settings and try again. " +
                "If you are using Safari, ensure the site is served over HTTPS.",
            );
            setIsSetupOpen(false);
          }
        } else if (err.name === "NotFoundError") {
          setSetupError(
            "No camera or microphone found. Please connect a device and try again.",
          );
          setIsSetupOpen(false);
        } else if (err.name === "NotReadableError") {
          setSetupError(
            "Your camera or microphone is already in use by another application.",
          );
          setIsSetupOpen(false);
        } else if (err.name === "SecurityError") {
          setSetupError(
            "Camera access is blocked due to security policy. Try using HTTPS or a different browser.",
          );
          setIsSetupOpen(false);
        } else {
          setSetupError(
            "Could not access camera or microphone: " + err.message,
          );
          setIsSetupOpen(false);
        }
      }
    };

    await requestMedia();
  }, [user, isMediaSupported]);

  // ── Close setup ──
  const closeSetup = useCallback(() => {
    setIsSetupOpen(false);
    setSetupError(null);
    if (localStreamRef.current && role !== "host") {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      setLocalStream(null);
      localStreamRef.current = null;
    }
  }, [role]);

  // ── Start live stream (host) ──
  const startLive = useCallback(
    async (titleText) => {
      if (!localStreamRef.current) {
        alert("No camera/mic stream available.");
        return;
      }
      try {
        const res = await apiClient("/api/live/start", {
          method: "POST",
          body: { title: titleText },
        });
        const data = res.data || res;
        setSessionId(data.sessionId);
        setTitle(data.title || titleText);
        setRole("host");
        setBroadcasterName(
          data.broadcasterName || user.name || user.username || "",
        );
        setBroadcasterAvatar(data.broadcasterAvatar || user.picture || "");
        setIsSetupOpen(false);
        setIsOverlayOpen(true);
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        if (videoTrack) videoTrack.enabled = true;
        setCamOff(false);
        wsSend({
          type: "live:started",
          sessionId: data.sessionId,
          broadcasterName: broadcasterName,
          broadcasterAvatar: broadcasterAvatar,
          title: titleText,
          hostId: user.id,
        });
      } catch (err) {
        console.error("[Live] Failed to start:", err);
        alert(err.message || "Could not start stream.");
      }
    },
    [user, wsSend, broadcasterName, broadcasterAvatar],
  );

  // ── Watch a live session (viewer) ──
  const watchSession = useCallback(
    async (sessionId) => {
      if (!user) {
        alert("Please log in to watch.");
        return;
      }
      setSessionId(sessionId);
      setRole("viewer");
      setIsOverlayOpen(true);
      try {
        const res = await apiClient(`/api/live/${sessionId}`);
        const data = res.data || res;
        setBroadcasterName(data.broadcasterName || "");
        setBroadcasterAvatar(data.broadcasterAvatar || "");
        setTitle(data.title || "");
      } catch (_) {}
      wsSend({
        type: "live:viewer_join",
        sessionId,
        viewerId: user.id,
        viewerName: user.username || user.name || null,
      });
    },
    [user, wsSend],
  );

  // ── Close live stream ──
  const closeLive = useCallback(async () => {
    if (role === "host") {
      if (!confirm("End your live stream?")) return;
      try {
        await apiClient("/api/live/end", {
          method: "POST",
          body: { sessionId },
        });
      } catch (_) {}
      Object.values(peersRef.current).forEach((pc) => pc.close());
      peersRef.current = {};
      wsSend({ type: "live:ended", sessionId });
    } else if (role === "viewer") {
      if (peerConnRef.current) {
        peerConnRef.current.close();
        peerConnRef.current = null;
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
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      setLocalStream(null);
      localStreamRef.current = null;
    }
    setMicMuted(false);
    setCamOff(false);
  }, [role, sessionId, user, wsSend]);

  // ── Toggle microphone ──
  const toggleMic = useCallback(() => {
    if (!localStreamRef.current) return;
    const newState = !micMuted;
    setMicMuted(newState);
    localStreamRef.current
      .getAudioTracks()
      .forEach((t) => (t.enabled = !newState));
  }, [micMuted]);

  // ── Toggle camera ──
  const toggleCam = useCallback(() => {
    if (!localStreamRef.current) return;
    const newState = !camOff;
    setCamOff(newState);
    localStreamRef.current
      .getVideoTracks()
      .forEach((t) => (t.enabled = !newState));
  }, [camOff]);

  // ── Send chat message ──
  const sendChat = useCallback(
    (text) => {
      if (!text.trim() || !sessionId) return;
      const msg = {
        type: "live:chat_message",
        sessionId,
        senderId: user.id,
        senderName: user.username || user.name || "You",
        text: text.trim(),
      };
      wsSend(msg);
      setChatMessages((prev) => [
        ...prev,
        { senderName: msg.senderName, text: msg.text, isSelf: true },
      ]);
    },
    [sessionId, user, wsSend],
  );

  // ── Send reaction ──
  const sendReaction = useCallback(
    (emoji) => {
      if (!sessionId) return;
      wsSend({ type: "live:reaction", sessionId, emoji });
    },
    [sessionId, wsSend],
  );

  // ── WebSocket message handler ──
  const handleWsMessage = useCallback(
    (msg) => {
      switch (msg.type) {
        case "live:started":
          loadActiveSessions();
          break;
        case "live:ended":
          setActiveSessions((prev) =>
            prev.filter((s) => s.sessionId !== msg.sessionId),
          );
          if (role === "viewer" && sessionId === msg.sessionId) {
            setIsOverlayOpen(false);
          }
          break;
        case "live:viewer_joined":
          setViewerCount(msg.viewerCount);
          if (role === "host") {
            // WebRTC offer handling (simplified here; full implementation would add track negotiation)
          }
          break;
        case "live:viewer_left":
          setViewerCount(msg.viewerCount);
          break;
        case "live:chat_message":
          if (sessionId === msg.sessionId && msg.senderId !== user?.id) {
            setChatMessages((prev) => [
              ...prev,
              { senderName: msg.senderName, text: msg.text, isSelf: false },
            ]);
          }
          break;
        case "live:reaction":
          if (sessionId === msg.sessionId) {
            // Emoji float – can be handled by the component
          }
          break;
        default:
          break;
      }
    },
    [loadActiveSessions, role, sessionId, user],
  );

  // ── Register WS handlers ──
  useEffect(() => {
    const liveTypes = [
      "live:started",
      "live:ended",
      "live:viewer_joined",
      "live:viewer_left",
      "live:chat_message",
      "live:reaction",
      "live:offer",
      "live:answer",
      "live:ice_candidate",
    ];
    const unsubscribers = liveTypes.map((type) =>
      registerHandler(type, handleWsMessage),
    );
    return () => unsubscribers.forEach((fn) => fn());
  }, [registerHandler, handleWsMessage]);

  // ── Periodic refresh of active sessions ──
  useEffect(() => {
    loadActiveSessions();
    const interval = setInterval(loadActiveSessions, 30000);
    return () => clearInterval(interval);
  }, [loadActiveSessions]);

  // ── Context value ──
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
  if (!context) {
    throw new Error("useLive must be used within a LiveProvider");
  }
  return context;
}
