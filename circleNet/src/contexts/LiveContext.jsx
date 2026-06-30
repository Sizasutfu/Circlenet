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

  // ── State ──
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
  const [floatingReactions, setFloatingReactions] = useState([]);

  // ── Refs ──
  const localStreamRef = useRef(null);
  const peersRef = useRef({}); // host: { viewerId: RTCPeerConnection }, viewer: { sessionId: { pc, hostIdRef } }
  const retryTimersRef = useRef({});
  const reactionTimerRef = useRef(null);
  const livePostIdRef = useRef(null); // track the live post for updating

  const log = (msg, data) => console.log(`[Live:${role || 'none'}] ${msg}`, data || "");

  // ── Add a floating reaction ──
  const addFloatingReaction = useCallback((emoji) => {
    const id = Date.now() + Math.random();
    const x = 5 + Math.random() * 90;
    setFloatingReactions((prev) => [...prev, { id, emoji, x }]);
    if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
    reactionTimerRef.current = setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
    }, 2500);
  }, []);

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
      log("Active sessions loaded", sessions.length);
    } catch (_) {
      console.warn("[Live] Failed to load active sessions");
    } finally {
      setIsLoadingSessions(false);
    }
  }, []);

  // ── Open setup ──
  const openSetup = useCallback(async () => {
    if (!user) {
      alert("Please log in.");
      return;
    }
    if (!isMediaSupported()) {
      setSetupError("Browser doesn't support camera/mic.");
      setIsSetupOpen(true);
      return;
    }
    setSetupError(null);
    setIsSetupOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setLocalStream(stream);
      localStreamRef.current = stream;
      log("Media stream acquired");
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
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      setLocalStream(null);
      localStreamRef.current = null;
    }
  }, [role]);

  // ── Start live stream ──
  const startLive = useCallback(
    async (titleText) => {
      if (!localStreamRef.current) {
        alert("No camera/mic.");
        return;
      }
      try {
        // 1. Start live session on backend
        const res = await apiClient("/api/live/start", {
          method: "POST",
          body: { title: titleText },
        });
        const data = res.data || res;
        const sid = data.sessionId;
        setSessionId(sid);
        setTitle(data.title || titleText);
        setRole("host");
        setBroadcasterName(
          data.broadcasterName || user.name || user.username || ""
        );
        setBroadcasterAvatar(data.broadcasterAvatar || user.picture || "");
        setIsSetupOpen(false);
        setIsOverlayOpen(true);
        const vt = localStreamRef.current.getVideoTracks()[0];
        if (vt) vt.enabled = true;
        setCamOff(false);

        // 2. Create a live post in the feed
        try {
          const postRes = await apiClient("/api/posts", {
            method: "POST",
            body: {
              text: `🔴 I'm live now! ${titleText}`,
              isLive: true,
              liveSessionId: sid,
            },
          });
          const postData = postRes.data || postRes;
          livePostIdRef.current = postData.id;
          log("Live post created", postData.id);
        } catch (err) {
          console.warn("[Live] Failed to create live post:", err);
        }

        // 3. Notify via WebSocket
        wsSend({
          type: "live:started",
          sessionId: sid,
          broadcasterName: broadcasterName,
          broadcasterAvatar: broadcasterAvatar,
          title: titleText,
          hostId: user.id,
        });
        log("Live started", sid);
      } catch (err) {
        console.error("[Live] Failed to start:", err);
        alert(err.message || "Could not start stream.");
      }
    },
    [user, wsSend, broadcasterName, broadcasterAvatar]
  );

  // ── Watch a live session ──
  const watchSession = useCallback(
    async (sid) => {
      if (!user) {
        alert("Please log in.");
        return;
      }
      log("Attempting to watch", sid);
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

      // Create peer connection for viewer
      const pc = new RTCPeerConnection(RTC_CONFIG);
      const hostIdRef = { current: null };
      peersRef.current[sid] = { pc, hostIdRef };

      pc.oniceconnectionstatechange = () => {
        log("ICE connection state", pc.iceConnectionState);
      };
      pc.ontrack = (event) => {
        log("✅ Received remote track!", event.streams[0]);
        setRemoteStream(event.streams[0]);
        if (retryTimersRef.current[sid]) {
          clearTimeout(retryTimersRef.current[sid]);
          delete retryTimersRef.current[sid];
        }
      };
      pc.onicecandidate = (event) => {
        if (event.candidate && hostIdRef.current) {
          log("Sending ICE candidate to host");
          wsSend({
            type: "live:ice_candidate",
            sessionId: sid,
            candidate: event.candidate,
            from: user.id,
            to: hostIdRef.current,
          });
        }
      };

      // Retry if no offer arrives
      const retryTimer = setTimeout(() => {
        if (!remoteStream) {
          log("⏳ No offer received – retrying join");
          wsSend({
            type: "live:viewer_join",
            sessionId: sid,
            viewerId: user.id,
            viewerName: user.username || user.name || null,
          });
          retryTimersRef.current[sid] = setTimeout(() => {
            if (!remoteStream) {
              log("⏳ Still no stream – please retry manually");
            }
          }, 5000);
        }
      }, 3000);
      retryTimersRef.current[sid] = retryTimer;

      wsSend({
        type: "live:viewer_join",
        sessionId: sid,
        viewerId: user.id,
        viewerName: user.username || user.name || null,
      });
    },
    [user, wsSend]
  );

  // ── Close live stream ──
  const closeLive = useCallback(async () => {
    if (role === "host") {
      if (!confirm("End your live stream?")) return;
      try {
        await apiClient("/api/live/end", { method: "POST", body: { sessionId } });
      } catch (_) {}
      Object.values(peersRef.current).forEach((pc) => pc.close?.());
      peersRef.current = {};
      wsSend({ type: "live:ended", sessionId });

      // Update the live post to remove live flag
      if (livePostIdRef.current) {
        try {
          await apiClient(`/api/posts/${livePostIdRef.current}`, {
            method: "PUT",
            body: { isLive: false },
          });
          log("Live post updated (isLive: false)", livePostIdRef.current);
        } catch (_) {}
        livePostIdRef.current = null;
      }
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
      wsSend({
        type: "live:viewer_leave",
        sessionId,
        viewerId: user?.id,
      });
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
    setFloatingReactions([]);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
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
    localStreamRef.current
      .getAudioTracks()
      .forEach((t) => (t.enabled = !newState));
  }, [micMuted]);

  const toggleCam = useCallback(() => {
    if (!localStreamRef.current) return;
    const newState = !camOff;
    setCamOff(newState);
    localStreamRef.current
      .getVideoTracks()
      .forEach((t) => (t.enabled = !newState));
  }, [camOff]);

  // ── Chat & Reactions ──
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
    [sessionId, user, wsSend]
  );

  const sendReaction = useCallback(
    (emoji) => {
      if (!sessionId) return;
      addFloatingReaction(emoji);
      wsSend({ type: "live:reaction", sessionId, emoji });
    },
    [sessionId, wsSend, addFloatingReaction]
  );

  // ── WebSocket message handler ──
  const handleWsMessage = useCallback(
    (msg) => {
      log("Received WS message", msg.type);
      switch (msg.type) {
        case "live:started":
          loadActiveSessions();
          break;

        case "live:ended":
          setActiveSessions((prev) =>
            prev.filter((s) => s.sessionId !== msg.sessionId)
          );
          if (role === "viewer" && sessionId === msg.sessionId)
            setIsOverlayOpen(false);
          break;

        case "live:viewer_joined":
          setViewerCount(msg.viewerCount);
          if (role === "host" && sessionId === msg.sessionId) {
            const viewerId = msg.viewerId;
            log("Viewer joined, creating offer for", viewerId);
            let pc = peersRef.current[viewerId];
            if (!pc) {
              pc = new RTCPeerConnection(RTC_CONFIG);
              peersRef.current[viewerId] = pc;
              if (localStreamRef.current) {
                localStreamRef.current
                  .getTracks()
                  .forEach((track) => pc.addTrack(track, localStreamRef.current));
              }
              pc.onicecandidate = (event) => {
                if (event.candidate) {
                  wsSend({
                    type: "live:ice_candidate",
                    sessionId: msg.sessionId,
                    candidate: event.candidate,
                    from: user.id,
                    to: viewerId,
                  });
                }
              };
              pc.oniceconnectionstatechange = () => {
                log("Host ICE state for viewer", pc.iceConnectionState);
              };
            }
            pc.createOffer()
              .then((offer) => pc.setLocalDescription(offer))
              .then(() => {
                wsSend({
                  type: "live:offer",
                  sessionId: msg.sessionId,
                  offer: pc.localDescription,
                  from: user.id,
                  to: viewerId,
                });
                log("Offer sent to viewer", viewerId);
              })
              .catch((err) => console.error("[Live] Host offer error:", err));
          }
          break;

        case "live:viewer_left":
          setViewerCount(msg.viewerCount);
          if (role === "host") {
            const viewerId = msg.viewerId;
            const pc = peersRef.current[viewerId];
            if (pc) {
              pc.close();
              delete peersRef.current[viewerId];
            }
          }
          break;

        case "live:viewer_count":
          if (sessionId === msg.sessionId) {
            setViewerCount(msg.count);
          }
          break;

        case "live:offer":
          if (role === "viewer" && sessionId === msg.sessionId) {
            const hostId = msg.from;
            const entry = peersRef.current[sessionId];
            if (entry) {
              entry.hostIdRef.current = hostId;
              const pc = entry.pc;
              log("Received offer from host", hostId);
              pc.setRemoteDescription(new RTCSessionDescription(msg.offer))
                .then(() => pc.createAnswer())
                .then((answer) => pc.setLocalDescription(answer))
                .then(() => {
                  wsSend({
                    type: "live:answer",
                    sessionId: msg.sessionId,
                    answer: pc.localDescription,
                    from: user.id,
                    to: hostId,
                  });
                  log("Answer sent to host", hostId);
                })
                .catch((err) => console.error("[Live] Viewer answer error:", err));
            }
          }
          break;

        case "live:answer":
          if (role === "host" && sessionId === msg.sessionId) {
            const viewerId = msg.from;
            const pc = peersRef.current[viewerId];
            if (pc) {
              log("Received answer from viewer", viewerId);
              pc.setRemoteDescription(new RTCSessionDescription(msg.answer))
                .catch((err) => console.error("[Live] Host set remote desc error:", err));
            }
          }
          break;

        case "live:ice_candidate":
          if (role === "host" && sessionId === msg.sessionId) {
            const viewerId = msg.from;
            const pc = peersRef.current[viewerId];
            if (pc && msg.candidate && msg.from !== user?.id) {
              pc.addIceCandidate(new RTCIceCandidate(msg.candidate))
                .catch((err) => console.warn("[Live] Host ICE error:", err));
            }
          } else if (role === "viewer" && sessionId === msg.sessionId) {
            const entry = peersRef.current[sessionId];
            if (entry) {
              const pc = entry.pc;
              if (pc && msg.candidate && msg.from !== user?.id) {
                pc.addIceCandidate(new RTCIceCandidate(msg.candidate))
                  .catch((err) => console.warn("[Live] Viewer ICE error:", err));
              }
            }
          }
          break;

        case "live:reaction":
          if (sessionId === msg.sessionId && msg.from !== user?.id) {
            addFloatingReaction(msg.emoji);
          }
          break;

        case "live:chat_message":
          if (sessionId === msg.sessionId && msg.senderId !== user?.id) {
            setChatMessages((prev) => [
              ...prev,
              { senderName: msg.senderName, text: msg.text, isSelf: false },
            ]);
          }
          break;

        default:
          break;
      }
    },
    [loadActiveSessions, role, sessionId, user, localStreamRef, wsSend, addFloatingReaction]
  );

  // ── Register WS handlers ──
  useEffect(() => {
    const types = [
      "live:started",
      "live:ended",
      "live:viewer_joined",
      "live:viewer_left",
      "live:viewer_count",
      "live:chat_message",
      "live:reaction",
      "live:offer",
      "live:answer",
      "live:ice_candidate",
    ];
    const unsubs = types.map((type) => registerHandler(type, handleWsMessage));
    return () => unsubs.forEach((fn) => fn());
  }, [registerHandler, handleWsMessage]);

  // ── Periodic refresh ──
  useEffect(() => {
    loadActiveSessions();
    const interval = setInterval(loadActiveSessions, 30000);
    return () => clearInterval(interval);
  }, [loadActiveSessions]);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      Object.values(peersRef.current).forEach((pc) => pc.close?.());
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      Object.values(retryTimersRef.current).forEach((t) => clearTimeout(t));
      if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
    };
  }, []);

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
    floatingReactions,
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