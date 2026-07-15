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
  const [broadcasters, setBroadcasters] = useState([]);
  const [isBroadcaster, setIsBroadcaster] = useState(false);
  const [requestingToBroadcast, setRequestingToBroadcast] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]); // array of { userId, name, avatar }
  const [micMuted, setMicMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [setupError, setSetupError] = useState(null);
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [likeCount, setLikeCount] = useState(0);
  const [collaborationEnabled, setCollaborationEnabled] = useState(false);

  const localStreamRef = useRef(null);
  const peersRef = useRef({});
  const retryTimersRef = useRef({});
  const reactionTimerRef = useRef(null);
  const livePostIdRef = useRef(null);

  const log = (msg, data) => console.log(`[Live:${role || 'none'}] ${msg}`, data || "");

  // ── Floating reactions ──
  const addFloatingReaction = useCallback((emoji) => {
    const id = Date.now() + Math.random();
    const x = 5 + Math.random() * 90;
    setFloatingReactions((prev) => [...prev, { id, emoji, x }]);
    if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
    reactionTimerRef.current = setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
    }, 2500);
  }, []);

  // ── Send like (tap) ──
  const sendLike = useCallback(() => {
    if (!sessionId) return;
    setLikeCount((prev) => prev + 1);
    wsSend({ type: "live:like", sessionId });
  }, [sessionId, wsSend]);

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
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
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
    if (localStreamRef.current && role !== "host" && !isBroadcaster) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      setLocalStream(null);
      localStreamRef.current = null;
    }
  }, [role, isBroadcaster]);

  // ── Start live ──
  const startLive = useCallback(
    async (titleText) => {
      if (!localStreamRef.current) {
        alert("No camera/mic.");
        return;
      }
      try {
        const res = await apiClient("/api/live/start", {
          method: "POST",
          body: { title: titleText, collaborationEnabled },
        });
        const data = res.data || res;
        const sid = data.sessionId;
        setSessionId(sid);
        setTitle(data.title || titleText);
        setRole("host");
        setIsBroadcaster(true);
        setBroadcasterName(data.broadcasterName || user.name || user.username || "");
        setBroadcasterAvatar(data.broadcasterAvatar || user.picture || "");
        setBroadcasters([{
          userId: user.id,
          name: data.broadcasterName || user.name || user.username || "",
          avatar: data.broadcasterAvatar || user.picture || "",
          stream: localStreamRef.current,
        }]);
        setIsSetupOpen(false);
        setIsOverlayOpen(true);
        const vt = localStreamRef.current.getVideoTracks()[0];
        if (vt) vt.enabled = true;
        setCamOff(false);

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

        wsSend({
          type: "live:started",
          sessionId: sid,
          broadcasterName: broadcasterName,
          broadcasterAvatar: broadcasterAvatar,
          title: titleText,
          hostId: user.id,
          collaborationEnabled,
        });
        log("Live started", sid);
      } catch (err) {
        console.error("[Live] Failed to start:", err);
        alert(err.message || "Could not start stream.");
      }
    },
    [user, wsSend, broadcasterName, broadcasterAvatar, collaborationEnabled]
  );

  // ── Watch session ──
  const watchSession = useCallback(
    async (sid) => {
      if (!user) {
        alert("Please log in.");
        return;
      }
      log("Attempting to watch", sid);
      setSessionId(sid);
      setRole("viewer");
      setIsBroadcaster(false);
      setIsOverlayOpen(true);
      setRemoteStream(null);
      setLikeCount(0);
      setBroadcasters([]);
      setPendingRequests([]);
      Object.values(peersRef.current).forEach((p) => p.pc.close());
      peersRef.current = {};

      try {
        const res = await apiClient(`/api/live/${sid}`);
        const data = res.data || res;
        setBroadcasterName(data.broadcasterName || "");
        setBroadcasterAvatar(data.broadcasterAvatar || "");
        setTitle(data.title || "");
      } catch (_) {}

      wsSend({
        type: "live:viewer_join",
        sessionId: sid,
        viewerId: user.id,
        viewerName: user.username || user.name || null,
      });
    },
    [user, wsSend]
  );

  // ── Close live ──
  const closeLive = useCallback(async () => {
    if (role === "host") {
      if (!confirm("End your live stream?")) return;
      try {
        await apiClient("/api/live/end", { method: "POST", body: { sessionId } });
      } catch (_) {}
      Object.values(peersRef.current).forEach((p) => p.pc.close());
      peersRef.current = {};
      wsSend({ type: "live:ended", sessionId });

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
    } else {
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
    setIsBroadcaster(false);
    setSessionId(null);
    setTitle("");
    setBroadcasterName("");
    setBroadcasterAvatar("");
    setChatMessages([]);
    setViewerCount(0);
    setRemoteStream(null);
    setBroadcasters([]);
    setPendingRequests([]);
    setFloatingReactions([]);
    setLikeCount(0);
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

  // ── Chat ──
  const sendChat = useCallback(
    (text) => {
      if (!text.trim() || !sessionId) return;
      const msg = {
        type: "live:chat_message",
        sessionId,
        senderId: user.id,
        senderName: user.username || user.name || "You",
        text: text.trim(),
        isSystem: false,
      };
      wsSend(msg);
      setChatMessages((prev) => [
        ...prev,
        { senderName: msg.senderName, text: msg.text, isSelf: true, isSystem: false },
      ]);
    },
    [sessionId, user, wsSend]
  );

  // ── Reactions ──
  const sendReaction = useCallback(
    (emoji) => {
      if (!sessionId) return;
      addFloatingReaction(emoji);
      wsSend({ type: "live:reaction", sessionId, emoji });
      setLikeCount((prev) => prev + 1);
      wsSend({ type: "live:like", sessionId });
    },
    [sessionId, wsSend, addFloatingReaction]
  );

  // ── Request to become broadcaster ──
  const requestBroadcast = useCallback(() => {
    if (!sessionId || !user) return;
    setRequestingToBroadcast(true);
    wsSend({ type: "live:become_broadcaster", sessionId });
  }, [sessionId, user, wsSend]);

  // ── Approve a request ──
  const approveRequest = useCallback((targetUserId) => {
    if (!sessionId || !user) return;
    wsSend({ type: "live:approve_broadcaster", sessionId, targetUserId });
    // Remove from pending locally optimistically
    setPendingRequests(prev => prev.filter(r => r.userId !== targetUserId));
  }, [sessionId, user, wsSend]);

  // ── Reject a request ──
  const rejectRequest = useCallback((targetUserId) => {
    if (!sessionId || !user) return;
    wsSend({ type: "live:reject_broadcaster", sessionId, targetUserId });
    setPendingRequests(prev => prev.filter(r => r.userId !== targetUserId));
  }, [sessionId, user, wsSend]);

  // ── Helper to create peer connection to another broadcaster ──
  const createPeerToBroadcaster = useCallback((targetUserId) => {
    if (!sessionId || !user) return;
    if (peersRef.current[targetUserId]) return;
    const pc = new RTCPeerConnection(RTC_CONFIG);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));
    }
    pc.ontrack = (event) => {
      log(`Received track from broadcaster ${targetUserId}`);
      setBroadcasters(prev => prev.map(b =>
        b.userId === targetUserId ? { ...b, stream: event.streams[0] } : b
      ));
    };
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        wsSend({
          type: "live:ice_candidate",
          sessionId,
          candidate: event.candidate,
          from: user.id,
          to: targetUserId,
        });
      }
    };
    pc.oniceconnectionstatechange = () => {
      log(`ICE state with ${targetUserId}: ${pc.iceConnectionState}`);
    };
    peersRef.current[targetUserId] = { pc, stream: null };
    pc.createOffer()
      .then(offer => pc.setLocalDescription(offer))
      .then(() => {
        wsSend({
          type: "live:offer",
          sessionId,
          offer: pc.localDescription,
          from: user.id,
          to: targetUserId,
        });
        log(`Offer sent to broadcaster ${targetUserId}`);
      })
      .catch(err => console.error(`[Live] Offer error to ${targetUserId}:`, err));
  }, [sessionId, user, wsSend, localStreamRef]);

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
          if ((role === "viewer" || isBroadcaster) && sessionId === msg.sessionId) {
            setIsOverlayOpen(false);
          }
          break;

        case "live:viewer_joined": {
          const { viewerId, viewerName, viewerCount: count } = msg;
          setViewerCount(count);
          if (isBroadcaster && sessionId === msg.sessionId && viewerId !== user?.id) {
            const pc = new RTCPeerConnection(RTC_CONFIG);
            if (localStreamRef.current) {
              localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));
            }
            pc.ontrack = () => {};
            pc.onicecandidate = (event) => {
              if (event.candidate) {
                wsSend({
                  type: "live:ice_candidate",
                  sessionId,
                  candidate: event.candidate,
                  from: user.id,
                  to: viewerId,
                });
              }
            };
            peersRef.current[viewerId] = { pc, stream: null };
            pc.createOffer()
              .then(offer => pc.setLocalDescription(offer))
              .then(() => {
                wsSend({
                  type: "live:offer",
                  sessionId,
                  offer: pc.localDescription,
                  from: user.id,
                  to: viewerId,
                });
                log(`Offer sent to viewer ${viewerId}`);
              })
              .catch(err => console.error(`[Live] Offer to viewer ${viewerId} error:`, err));
          }
          break;
        }

        case "live:viewer_left": {
          setViewerCount(msg.viewerCount);
          if (isBroadcaster && sessionId === msg.sessionId) {
            const viewerId = msg.viewerId;
            const peer = peersRef.current[viewerId];
            if (peer) {
              peer.pc.close();
              delete peersRef.current[viewerId];
            }
          }
          break;
        }

        case "live:viewer_count":
          if (sessionId === msg.sessionId) setViewerCount(msg.count);
          break;

        case "live:like_count":
          if (sessionId === msg.sessionId) setLikeCount(msg.count);
          break;

        case "live:new_broadcaster": {
          const { broadcasterId, broadcasterName, broadcasterAvatar } = msg;
          if (broadcasterId === user?.id) break;
          setBroadcasters(prev => [...prev, { userId: broadcasterId, name: broadcasterName, avatar: broadcasterAvatar, stream: null }]);
          if (isBroadcaster && sessionId === msg.sessionId) {
            createPeerToBroadcaster(broadcasterId);
          }
          break;
        }

        case "live:existing_broadcasters": {
          const { broadcasters: existing } = msg;
          const filtered = existing.filter(b => b.userId !== user?.id);
          setBroadcasters(prev => {
            const existingIds = new Set(prev.map(b => b.userId));
            const toAdd = filtered.filter(b => !existingIds.has(b.userId));
            return [...prev, ...toAdd];
          });
          if (isBroadcaster && sessionId === msg.sessionId) {
            filtered.forEach(b => {
              if (b.userId !== user?.id) {
                createPeerToBroadcaster(b.userId);
              }
            });
          }
          break;
        }

        case "live:current_broadcasters": {
          const { broadcasters: current } = msg;
          setBroadcasters(current.map(b => ({ ...b, stream: null })));
          break;
        }

        case "live:request_broadcast": {
          const { userId: requesterId, userName, userAvatar } = msg;
          // Only show to broadcasters
          if (isBroadcaster && sessionId === msg.sessionId) {
            setPendingRequests(prev => [...prev, { userId: requesterId, name: userName, avatar: userAvatar }]);
          }
          break;
        }

        case "live:request_approved": {
          // This viewer (the requester) got approved
          if (role === "viewer" && sessionId === msg.sessionId) {
            // The user is now a broadcaster; they should refresh the room?
            // We'll reload the session or simply set isBroadcaster true and re-join as broadcaster?
            // The server will send new_broadcaster to all, so we'll get that.
            // Also we should set isBroadcaster true so UI updates.
            setIsBroadcaster(true);
            setRole("broadcaster");
          }
          break;
        }

        case "live:request_rejected": {
          if (role === "viewer" && sessionId === msg.sessionId) {
            alert("Your request to join as broadcaster was declined.");
          }
          break;
        }

        case "live:offer": {
          const { from, offer } = msg;
          if (from === user?.id) break;
          let peer = peersRef.current[from];
          if (!peer) {
            const pc = new RTCPeerConnection(RTC_CONFIG);
            if (localStreamRef.current && isBroadcaster) {
              localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));
            }
            pc.ontrack = (event) => {
              setBroadcasters(prev => prev.map(b =>
                b.userId === from ? { ...b, stream: event.streams[0] } : b
              ));
            };
            pc.onicecandidate = (event) => {
              if (event.candidate) {
                wsSend({
                  type: "live:ice_candidate",
                  sessionId,
                  candidate: event.candidate,
                  from: user.id,
                  to: from,
                });
              }
            };
            peer = { pc, stream: null };
            peersRef.current[from] = peer;
          }
          peer.pc.setRemoteDescription(new RTCSessionDescription(offer))
            .then(() => peer.pc.createAnswer())
            .then(answer => peer.pc.setLocalDescription(answer))
            .then(() => {
              wsSend({
                type: "live:answer",
                sessionId,
                answer: peer.pc.localDescription,
                from: user.id,
                to: from,
              });
              log(`Answer sent to ${from}`);
            })
            .catch(err => console.error(`[Live] Answer error to ${from}:`, err));
          break;
        }

        case "live:answer": {
          const { from, answer } = msg;
          if (from === user?.id) break;
          const peer = peersRef.current[from];
          if (peer) {
            peer.pc.setRemoteDescription(new RTCSessionDescription(answer))
              .catch(err => console.error(`[Live] Set remote desc error from ${from}:`, err));
          }
          break;
        }

        case "live:ice_candidate": {
          const { from, candidate } = msg;
          if (from === user?.id) break;
          const peer = peersRef.current[from];
          if (peer && candidate) {
            peer.pc.addIceCandidate(new RTCIceCandidate(candidate))
              .catch(err => console.warn(`[Live] ICE error from ${from}:`, err));
          }
          break;
        }

        case "live:reaction":
          if (sessionId === msg.sessionId && msg.from !== user?.id) {
            addFloatingReaction(msg.emoji);
          }
          break;

        case "live:chat_message":
          if (sessionId === msg.sessionId) {
            const isSelf = msg.senderId === user?.id;
            setChatMessages((prev) => [
              ...prev,
              {
                senderName: msg.isSystem ? "" : (msg.senderName || "Anonymous"),
                text: msg.text,
                isSelf: isSelf && !msg.isSystem,
                isSystem: !!msg.isSystem,
              },
            ]);
          }
          break;

        case "live:broadcaster_left": {
          const { broadcasterId } = msg;
          setBroadcasters(prev => prev.filter(b => b.userId !== broadcasterId));
          const peer = peersRef.current[broadcasterId];
          if (peer) {
            peer.pc.close();
            delete peersRef.current[broadcasterId];
          }
          break;
        }

        case "live:error":
          alert(msg.text);
          if (msg.text.includes("limit")) {
            setRequestingToBroadcast(false);
          }
          break;

        default:
          break;
      }
    },
    [loadActiveSessions, role, sessionId, user, wsSend, addFloatingReaction, isBroadcaster, createPeerToBroadcaster, localStreamRef]
  );

  // ── Register WS handlers ──
  useEffect(() => {
    const types = [
      "live:started",
      "live:ended",
      "live:viewer_joined",
      "live:viewer_left",
      "live:viewer_count",
      "live:like_count",
      "live:chat_message",
      "live:reaction",
      "live:offer",
      "live:answer",
      "live:ice_candidate",
      "live:new_broadcaster",
      "live:existing_broadcasters",
      "live:current_broadcasters",
      "live:broadcaster_left",
      "live:request_broadcast",
      "live:request_approved",
      "live:request_rejected",
      "live:error",
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

  // ── Cleanup ──
  useEffect(() => {
    return () => {
      Object.values(peersRef.current).forEach((p) => p.pc.close());
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      Object.values(retryTimersRef.current).forEach((t) => clearTimeout(t));
      if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
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
    broadcasters,
    isBroadcaster,
    requestingToBroadcast,
    pendingRequests,
    micMuted,
    camOff,
    isOverlayOpen,
    isSetupOpen,
    setupError,
    floatingReactions,
    likeCount,
    collaborationEnabled,
    setCollaborationEnabled,
    openSetup,
    closeSetup,
    startLive,
    watchSession,
    closeLive,
    toggleMic,
    toggleCam,
    sendChat,
    sendReaction,
    sendLike,
    loadActiveSessions,
    requestBroadcast,
    approveRequest,
    rejectRequest,
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