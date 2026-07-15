// src/components/live/LiveOverlay.jsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useLive } from '@/contexts/LiveContext';
import { useAuth } from '@/lib/auth';

const REACTIONS = ['❤️', '🔥', '👏', '😂'];

// ── Floating heart (for tap likes) ──
function FloatingHeart({ x, y, onComplete }) {
  const [opacity, setOpacity] = useState(1);
  const [translateY, setTranslateY] = useState(0);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const start = performance.now();
    const duration = 1000;
    const animate = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      setTranslateY(-progress * 120);
      setOpacity(1 - progress);
      setScale(0.5 + progress * 0.8);
      if (progress < 1) requestAnimationFrame(animate);
      else onComplete();
    };
    requestAnimationFrame(animate);
  }, [onComplete]);

  return (
    <div
      className="absolute pointer-events-none text-3xl"
      style={{
        left: x,
        top: y,
        transform: `translateY(${translateY}px) scale(${scale})`,
        opacity,
        transition: 'none',
      }}
    >
      ❤️
    </div>
  );
}

export default function LiveOverlay() {
  const { user } = useAuth();
  const {
    role,
    sessionId,
    title,
    broadcasterName,
    broadcasterAvatar,
    viewerCount,
    chatMessages,
    localStream,
    broadcasters,
    isBroadcaster,
    requestingToBroadcast,
    pendingRequests,
    micMuted,
    camOff,
    isOverlayOpen,
    closeLive,
    toggleMic,
    toggleCam,
    sendChat,
    sendReaction,
    watchSession,
    floatingReactions,
    likeCount,
    sendLike,
    requestBroadcast,
    approveRequest,
    rejectRequest,
  } = useLive();

  const [chatInput, setChatInput] = useState('');
  const [ended, setEnded] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [hearts, setHearts] = useState([]);
  const [showRequests, setShowRequests] = useState(false);
  const localVideoRef = useRef(null);
  const chatContainerRef = useRef(null);
  const videoRefs = useRef({});

  const isHost = role === 'host';
  const isViewer = role === 'viewer';

  // Auto-scroll chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Attach local stream to local video
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream]);

  // Attach remote streams to each broadcaster video
  useEffect(() => {
    broadcasters.forEach((b) => {
      const el = videoRefs.current[b.userId];
      if (el && b.stream) {
        el.srcObject = b.stream;
        el.play().catch(() => {});
      }
    });
  }, [broadcasters]);

  // Show "retry" if viewer has no stream after 5 seconds (only if no broadcasters)
  useEffect(() => {
    if (isViewer && broadcasters.length === 0) {
      const timer = setTimeout(() => setLoadingTimeout(true), 5000);
      return () => clearTimeout(timer);
    } else {
      setLoadingTimeout(false);
    }
  }, [isViewer, broadcasters]);

  // Reset ended when overlay opens
  useEffect(() => {
    if (isOverlayOpen) {
      setEnded(false);
      setLoadingTimeout(false);
      setHearts([]);
      setShowRequests(false);
    }
  }, [isOverlayOpen]);

  if (!isOverlayOpen) return null;

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    sendChat(chatInput.trim());
    setChatInput('');
  };

  // ── Handle tap on video (only for viewers) ──
  const handleTap = (e) => {
    if (isBroadcaster) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX || rect.width / 2) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY || rect.height / 2) - rect.top;
    const id = Date.now() + Math.random();
    setHearts((prev) => [...prev, { id, x, y }]);
    sendLike();
  };

  const removeHeart = (id) => {
    setHearts((prev) => prev.filter((h) => h.id !== id));
  };

  const hasStream = broadcasters.some(b => b.stream !== null) || (isBroadcaster && localStream);

  const handleRetry = () => {
    setLoadingTimeout(false);
    if (sessionId) {
      watchSession(sessionId);
    }
  };

  // Determine grid layout for broadcasters
  const gridCols = Math.min(broadcasters.length, 2);
  const gridRows = Math.ceil(broadcasters.length / 2);

  return (
    <div className="fixed inset-0 z-[1000] bg-black flex flex-col">
      {/* ── Video container with tap detection ── */}
      <div
        className="absolute inset-0 bg-black/90 flex items-center justify-center"
        onTouchStart={handleTap}
        onMouseDown={handleTap}
        style={{ cursor: isBroadcaster ? 'default' : 'pointer' }}
      >
        {!hasStream ? (
          <div className="text-center">
            <div className="text-white/50 text-sm mb-3">
              {isBroadcaster ? 'Initializing camera…' : 'Connecting to stream…'}
            </div>
            {isViewer && loadingTimeout && (
              <button
                onClick={handleRetry}
                className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-full text-xs font-medium hover:bg-[var(--color-accent-h)] transition"
              >
                Retry Connection
              </button>
            )}
          </div>
        ) : (
          <div className="w-full h-full">
            {/* Grid of broadcaster videos */}
            <div className={`grid grid-cols-${gridCols} gap-1 w-full h-full`}>
              {broadcasters.map((b) => (
                <div key={b.userId} className="relative bg-black/50">
                  <video
                    ref={el => { if (el) videoRefs.current[b.userId] = el; }}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                    style={{ background: '#000' }}
                  />
                  <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded text-white text-xs">
                    {b.name || 'Unknown'}
                  </div>
                </div>
              ))}
              {/* If no broadcasters, show placeholder */}
              {broadcasters.length === 0 && (
                <div className="col-span-2 flex items-center justify-center text-white/50">
                  Waiting for broadcaster...
                </div>
              )}
            </div>
            {/* Local video picture-in-picture if broadcaster */}
            {isBroadcaster && localStream && (
              <video
                ref={localVideoRef}
                className="absolute bottom-4 right-4 w-48 h-36 object-cover rounded-lg border-2 border-white shadow-lg z-10"
                autoPlay
                playsInline
                muted
              />
            )}
          </div>
        )}

        {/* Floating hearts (tap likes) */}
        {hearts.map((heart) => (
          <FloatingHeart
            key={heart.id}
            x={heart.x}
            y={heart.y}
            onComplete={() => removeHeart(heart.id)}
          />
        ))}

        {/* Floating emoji reactions */}
        {floatingReactions.map((r) => (
          <div
            key={r.id}
            className="absolute pointer-events-none text-5xl animate-float-up"
            style={{
              left: `${r.x}%`,
              bottom: '0%',
              animationDuration: '2.5s',
            }}
          >
            {r.emoji}
          </div>
        ))}
      </div>

      {/* ── Like count ── */}
      <div className="absolute top-20 right-4 z-20 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full text-white text-sm font-bold border border-white/10">
        <svg className="w-4 h-4 text-rose-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
        </svg>
        <span>{likeCount}</span>
      </div>

      {/* ── Gradients ── */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/70 to-transparent pointer-events-none z-10" />
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black/85 to-transparent pointer-events-none z-10" />

      {/* ── Top bar ── */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          {broadcasterAvatar ? (
            <img src={broadcasterAvatar} alt="" className="w-9 h-9 rounded-full border-2 border-[var(--color-rose)] object-cover" />
          ) : (
            <div className="w-9 h-9 rounded-full border-2 border-[var(--color-rose)] bg-[var(--color-surface)]" />
          )}
          <div>
            <div className="text-white font-bold text-sm">{broadcasterName || 'Unknown'}</div>
            <div className="text-white/65 text-xs truncate max-w-[160px]">{title || 'Live stream'}</div>
          </div>
          <span className="flex items-center gap-1.5 bg-[var(--color-rose)] text-white text-[10px] font-extrabold px-2 py-1 rounded-md uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            LIVE
          </span>
          {isBroadcaster && (
            <span className="text-[10px] bg-[var(--color-accent)] text-white px-2 py-0.5 rounded-full">
              Broadcaster
            </span>
          )}
          {/* ── Pending requests dropdown ── */}
          {isBroadcaster && pendingRequests.length > 0 && (
            <div className="relative ml-2">
              <button
                onClick={() => setShowRequests(!showRequests)}
                className="flex items-center gap-1 bg-[var(--color-accent)] px-2 py-1 rounded-full text-xs text-white hover:bg-[var(--color-accent-h)] transition"
              >
                <span className="animate-pulse">●</span>
                {pendingRequests.length} request{pendingRequests.length > 1 ? 's' : ''}
              </button>
              {showRequests && (
                <div className="absolute top-full left-0 mt-2 bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl shadow-xl p-3 w-64 z-30">
                  <div className="text-xs font-bold text-[var(--color-txt2)] mb-2">Pending requests</div>
                  {pendingRequests.map((req) => (
                    <div key={req.userId} className="flex items-center justify-between gap-2 py-1 border-b border-[var(--color-border)] last:border-0">
                      <div className="flex items-center gap-2 min-w-0">
                        {req.avatar ? (
                          <img src={req.avatar} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-[var(--color-surface)] flex items-center justify-center text-xs flex-shrink-0">
                            {req.name?.[0]?.toUpperCase()}
                          </div>
                        )}
                        <span className="text-sm text-[var(--color-txt)] truncate">{req.name || 'Unknown'}</span>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => approveRequest(req.userId)}
                          className="px-2 py-0.5 bg-[var(--color-green)] text-white text-xs rounded hover:bg-[var(--color-green)]/80"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => rejectRequest(req.userId)}
                          className="px-2 py-0.5 bg-[var(--color-rose)] text-white text-xs rounded hover:bg-[var(--color-rose)]/80"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-black/45 backdrop-blur-sm border border-white/10 px-3 py-1.5 rounded-full text-white text-xs font-bold">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span>{viewerCount || 0}</span>
          </div>
          <button onClick={closeLive} className="w-9 h-9 rounded-full bg-black/45 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white hover:bg-white/20 transition"
          title='Close live'
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-4 space-y-3">
        {/* Host / Broadcaster controls */}
        {isBroadcaster && (
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={toggleMic}
              className={`w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white hover:bg-white/20 transition ${micMuted ? 'border-[var(--color-rose)] text-[var(--color-rose)]' : ''}`}
              title={micMuted ? 'Unmute mic' : 'Mute mic'}
            >
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                {micMuted ? (
                  <>
                    <line x1="1" y1="1" x2="23" y2="23" />
                    <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6" />
                    <path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </>
                ) : (
                  <>
                    <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                    <path d="M19 10v2a7 7 0 01-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </>
                )}
              </svg>
            </button>
            <button
              onClick={toggleCam}
              className={`w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white hover:bg-white/20 transition ${camOff ? 'border-[var(--color-rose)] text-[var(--color-rose)]' : ''}`}
              title={camOff ? 'Turn camera on' : 'Turn camera off'}
            >
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                {camOff ? (
                  <>
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </>
                ) : (
                  <>
                    <path d="M23 7l-7 5 7 5V7z" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </>
                )}
              </svg>
            </button>
            <button onClick={closeLive} className="px-4 py-2 bg-[var(--color-rose)] text-white rounded-full font-bold text-sm hover:bg-[var(--color-rose)]/80 transition">
              {role === 'host' ? 'End Stream' : 'Leave'}
            </button>
          </div>
        )}

        {/* Reaction buttons */}
        <div className="flex gap-2">
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => sendReaction(emoji)}
              className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm border border-white/10 text-xl flex items-center justify-center hover:bg-white/20 transition transform hover:scale-110 active:scale-90"
            >
              {emoji}
            </button>
          ))}
          {/* Request to co-host (for viewers) */}
          {isViewer && !isBroadcaster && (
            <button
              onClick={requestBroadcast}
              disabled={requestingToBroadcast}
              className="px-3 py-1 bg-[var(--color-accent)] text-white rounded-full text-xs font-medium hover:bg-[var(--color-accent-h)] transition disabled:opacity-50"
            >
              {requestingToBroadcast ? 'Requesting...' : 'Join as Broadcaster'}
            </button>
          )}
        </div>

        {/* Chat area */}
        <div className="space-y-1.5">
          <div
            ref={chatContainerRef}
            className="max-h-36 overflow-y-auto scrollbar-hide space-y-1"
          >
            {chatMessages.map((msg, idx) => {
              if (msg.isSystem) {
                return (
                  <div key={idx} className="text-center text-xs text-[var(--color-txt3)] italic py-1">
                    {msg.text}
                  </div>
                );
              }
              return (
                <div key={idx} className="flex items-baseline gap-1.5 text-white text-sm animate-fadeUp">
                  <span className={`font-bold text-xs ${msg.isSelf ? 'text-[var(--color-green)]' : 'text-[var(--color-accent)]'}`}>
                    {msg.senderName}:
                  </span>
                  <span className="text-sm leading-tight">{msg.text}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
              placeholder="Say something…"
              maxLength={200}
              className="flex-1 bg-white/10 backdrop-blur-sm border border-white/15 rounded-full px-4 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/30 transition"
            />
            <button
              onClick={handleSendChat}
              className="w-10 h-10 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-white hover:bg-[var(--color-accent-h)] transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {ended && (
        <div className="absolute inset-0 z-30 bg-black/90 flex flex-col items-center justify-center gap-3">
          <div className="text-5xl">📴</div>
          <h3 className="text-white text-2xl font-head font-extrabold">Stream Ended</h3>
          <p className="text-white/55 text-sm">This live stream has ended.</p>
          <button onClick={closeLive} className="mt-2 px-6 py-2 bg-[var(--color-accent)] text-white rounded-full font-bold hover:bg-[var(--color-accent-h)] transition">
            Close
          </button>
        </div>
      )}
    </div>
  );
}