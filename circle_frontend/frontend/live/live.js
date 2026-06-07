/* ═══════════════════════════════════════════════════════════════
   CircleNet — Live Video  |  live.js
   
   Dependencies (already on page):
     - currentUser        (global, set by main.js after login)
     - api(method, path, body)  (global helper in main.js)
     - WS                 (extended below — wsClient.js must load first)
   
   Files to add in index.html (before </body>):
     <link rel="stylesheet" href="/live/live.css">
     <script src="/live/live.js"></script>

   Nav item to add in sidebar (index.html):
     <div class="nav-item" onclick="Live.openSetup()" id="snav-live">
       <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
         <circle cx="12" cy="12" r="10"/>
         <circle cx="12" cy="12" r="3"/>
         <line x1="12" y1="2" x2="12" y2="5"/>
         <line x1="12" y1="19" x2="12" y2="22"/>
         <line x1="2" y1="12" x2="5" y2="12"/>
         <line x1="19" y1="12" x2="22" y2="12"/>
       </svg>
       <span class="nav-label">Go Live</span>
     </div>

   Backend routes needed:
     POST   /live/start              { title }             → { sessionId, token? }
     POST   /live/end                { sessionId }         → { ok }
     GET    /live/active             (no body)             → [session]
     GET    /live/:sessionId                               → session

   WebSocket events (extend wsClient.js handler switch):
     Inbound  → live:started, live:ended, live:viewer_joined,
                live:viewer_left, live:chat_message, live:reaction,
                live:offer, live:answer, live:ice_candidate
     Outbound → handled via Live._ws.send() below

   WebRTC topology (small audiences, ≤ ~20 viewers):
     Broadcaster  ──[WS signaling]──  Server  ──[WS signaling]──  Viewers
     Each viewer opens a direct RTCPeerConnection to the broadcaster.
     Broadcaster creates an "offer" per viewer; viewer answers.
═══════════════════════════════════════════════════════════════ */

const Live = (() => {
  /* ── Internal state ─────────────────────────── */
  const state = {
    role: null,            // 'host' | 'viewer' | null
    sessionId: null,
    title: '',
    broadcasterName: '',   // populated for viewer in watchSession()
    broadcasterAvatar: '', // populated for viewer in watchSession()
    localStream: null,     // host's MediaStream
    remoteStream: null,    // viewer's received MediaStream
    peers: {},             // host side: { viewerId: RTCPeerConnection }
    peerConn: null,        // viewer side: single RTCPeerConnection
    micMuted: false,
    camOff: false,
    viewerCount: 0,
    chatMessages: [],
  };

  /* ── ICE server config (add TURN for production) */
  const ICE_CONFIG = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      // Add TURN servers here for reliable cross-NAT connections:
      // { urls: 'turn:your.turn.server', username: '…', credential: '…' }
    ],
  };

  /* ── DOM references (resolved lazily) ──────── */
  const el = {};
  function $(id) {
    if (!el[id]) el[id] = document.getElementById(id);
    return el[id];
  }

  /* ══════════════════════════════════════════════
     SETUP MODAL  (host flow)
  ══════════════════════════════════════════════ */
  async function openSetup() {
    if (!currentUser) { alert('Please log in to go live.'); return; }

    // Inject modal HTML on first call
    if (!document.getElementById('live-setup-modal')) _injectHTML();

    const modal = $('live-setup-modal');
    modal.classList.add('open');

    // Start preview stream
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      state.localStream = stream;
      const preview = $('live-setup-preview-video');
      if (preview) { preview.srcObject = stream; preview.play().catch(() => {}); }
      $('live-go-btn').disabled = false;
    } catch (err) {
      console.error('[Live] Camera/mic access denied:', err);
      $('live-go-btn').disabled = true;
      $('live-setup-status').textContent = 'Camera or microphone access was denied.';
    }
  }

  function closeSetup() {
    const modal = $('live-setup-modal');
    if (modal) modal.classList.remove('open');
    // Stop preview if not yet gone live
    if (state.role !== 'host') _stopLocalStream();
  }

  async function startLive() {
  const titleEl = $('live-title-input');
  const title = titleEl ? titleEl.value.trim() : '';
  if (!title) { titleEl && titleEl.focus(); return; }

  const btn = $('live-go-btn');
  btn.disabled = true;
  btn.textContent = 'Starting…';

  try {
    const response = await api('POST', '/api/live/start', { title });
    const { sessionId, title: streamTitle, broadcasterName, broadcasterAvatar } = response.data;
    
    state.sessionId = sessionId;
    state.title = streamTitle;
    state.role = 'host';
    state.broadcasterName = broadcasterName || currentUser.name || currentUser.username || '';
    state.broadcasterAvatar = broadcasterAvatar || currentUser.picture || '';
    
    closeSetup();
    _openOverlay('host');
  } catch (err) {
    console.error('[Live] start failed:', err);
    btn.disabled = false;
    btn.textContent = '🔴 Go Live';
    $('live-setup-status').textContent = err.message || 'Could not start stream.';
  }
}

  /* ══════════════════════════════════════════════
     VIEWER  —  open a session to watch
  ══════════════════════════════════════════════ */
  async function watchSession(sessionId) {
    if (!currentUser) { alert('Please log in to watch.'); return; }
    state.sessionId = sessionId;
    state.role = 'viewer';

    // Fetch session metadata so the overlay shows broadcaster name + title (bug #3)
    try {
      const res = await api('GET', `/api/live/${sessionId}`);
      const session = res.data || res; // unwrap sendOk envelope { status, data }
      state.broadcasterName   = session.broadcasterName  || '';
      state.broadcasterAvatar = session.broadcasterAvatar || '';
      state.title             = session.title            || '';
    } catch (_) { /* non-fatal — overlay shows blanks */ }

    if (!document.getElementById('live-setup-modal')) _injectHTML();

    _openOverlay('viewer');

    // Tell the server we joined (it will relay to host for WebRTC offer)
    // Include viewerName so the host's join banner shows the real name (bug #4)
    _wsSend({
      type:       'live:viewer_join',
      sessionId,
      viewerId:   currentUser.id,
      viewerName: currentUser.username || currentUser.name || null,
    });
  }

  /* ══════════════════════════════════════════════
     OVERLAY  (fullscreen live UI)
  ══════════════════════════════════════════════ */
  function _openOverlay(role) {
    const overlay = $('live-overlay');
    overlay.classList.add('live-active');

    const videoEl = $('live-video-el');

    if (role === 'host') {
      // Mirror local stream into the video element
      videoEl.srcObject = state.localStream;
      videoEl.muted = true; // prevent echo
      videoEl.play().catch(() => {});
      $('live-host-controls').style.display = 'flex';
      $('live-viewer-follow-btn') && ($('live-viewer-follow-btn').style.display = 'none');
    } else {
      // Viewer: video will be set when remote track arrives
      $('live-host-controls').style.display = 'none';
      videoEl.muted = false;
    }

    _updateViewerCount(state.viewerCount);
    _updateSessionMeta();
  }

  async function closeLive() {
    if (state.role === 'host') {
      // Ask for confirmation
      if (!confirm('End your live stream?')) return;
      await _endLiveAsHost(); // must await so sessionId is still set during the API call (bug #7)
    } else {
      _leaveAsViewer();
    }
    _teardownOverlay();
  }

  function _teardownOverlay() {
    $('live-overlay').classList.remove('live-active');
    $('live-ended-screen').classList.remove('show');
    state.role = null;
    state.sessionId = null;
    state.title = '';
    state.broadcasterName = '';
    state.broadcasterAvatar = '';
    state.chatMessages = [];
    state.viewerCount = 0;
    state.peers = {};
    state.peerConn = null;
    _stopLocalStream();
    _clearChat();
  }

  async function _endLiveAsHost() {
    // Close all peer connections
    Object.values(state.peers).forEach(pc => pc.close());
    state.peers = {};
    try {
      await api('POST', '/api/live/end', { sessionId: state.sessionId });
    } catch (_) { /* best-effort */ }
    _wsSend({ type: 'live:ended', sessionId: state.sessionId });
  }

  function _leaveAsViewer() {
    if (state.peerConn) { state.peerConn.close(); state.peerConn = null; }
    _wsSend({ type: 'live:viewer_leave', sessionId: state.sessionId, viewerId: currentUser.id });
  }

  /* ══════════════════════════════════════════════
     HOST CONTROLS
  ══════════════════════════════════════════════ */
  function toggleMic() {
    if (!state.localStream) return;
    state.micMuted = !state.micMuted;
    state.localStream.getAudioTracks().forEach(t => { t.enabled = !state.micMuted; });
    const btn = $('live-mic-btn');
    btn.classList.toggle('muted', state.micMuted);
    btn.title = state.micMuted ? 'Unmute microphone' : 'Mute microphone';
    btn.querySelector('svg').innerHTML = state.micMuted
      ? '<line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/><path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>'
      : '<path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>';
  }

  function toggleCam() {
    if (!state.localStream) return;
    state.camOff = !state.camOff;
    state.localStream.getVideoTracks().forEach(t => { t.enabled = !state.camOff; });
    const btn = $('live-cam-btn');
    btn.classList.toggle('cam-off', state.camOff);
    btn.title = state.camOff ? 'Turn camera on' : 'Turn camera off';
  }

  /* ══════════════════════════════════════════════
     CHAT
  ══════════════════════════════════════════════ */
  function sendChat() {
    const input = $('live-chat-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text || !state.sessionId) return;
    input.value = '';

    const msg = {
      type: 'live:chat_message',
      sessionId: state.sessionId,
      senderId: currentUser.id,
      senderName: currentUser.username || currentUser.name || 'You',
      text,
    };
    _wsSend(msg);
    // Optimistically render own message immediately
    _appendChatMessage(msg.senderName, text, true);
  }

  function _appendChatMessage(name, text, isSelf = false) {
    const container = $('live-chat-messages');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'live-chat-msg';
    div.innerHTML = `<span class="live-chat-msg__name" style="${isSelf ? 'color:var(--green)' : ''}">${_esc(name)}</span><span class="live-chat-msg__text">${_esc(text)}</span>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;

    // Keep last 60 messages to avoid DOM bloat
    const msgs = container.querySelectorAll('.live-chat-msg');
    if (msgs.length > 60) msgs[0].remove();
  }

  function _clearChat() {
    const container = $('live-chat-messages');
    if (container) container.innerHTML = '';
  }

  /* ══════════════════════════════════════════════
     REACTIONS
  ══════════════════════════════════════════════ */
  const REACTIONS = ['❤️', '🔥', '👏', '😂'];

  function sendReaction(emoji) {
    _floatEmoji(emoji);
    if (state.sessionId) {
      _wsSend({ type: 'live:reaction', sessionId: state.sessionId, emoji });
    }
  }

  function _floatEmoji(emoji) {
    const canvas = $('live-reaction-canvas');
    if (!canvas) return;
    const span = document.createElement('span');
    span.className = 'live-floating-emoji';
    span.textContent = emoji;
    // Randomise horizontal start position
    const x = 20 + Math.random() * 60; // percent
    span.style.left = x + '%';
    span.style.bottom = '80px';
    canvas.appendChild(span);
    span.addEventListener('animationend', () => span.remove());
  }

  /* ══════════════════════════════════════════════
     VIEWER COUNT + META
  ══════════════════════════════════════════════ */
  function _updateViewerCount(n) {
    state.viewerCount = n;
    const el = $('live-viewer-count-num');
    if (el) el.textContent = n;
  }

  function _updateSessionMeta() {
    const nameEl   = $('live-broadcaster-name-el');
    const titleEl  = $('live-stream-title-el');
    const avatarEl = $('live-broadcaster-avatar-el');
    if (nameEl)   nameEl.textContent  = state.broadcasterName  || currentUser?.name || currentUser?.username || '';
    if (titleEl)  titleEl.textContent = state.title            || '';
    if (avatarEl) {
      if (state.broadcasterAvatar) {
        avatarEl.src   = state.broadcasterAvatar;
        avatarEl.style.display = '';
      } else {
        avatarEl.src   = '';
        avatarEl.style.display = 'none';
      }
    }
  }

  /* ══════════════════════════════════════════════
     WEBRTC — HOST SIDE
     Server tells host a viewer joined → host creates offer
  ══════════════════════════════════════════════ */
  async function _handleViewerJoined(viewerId) {
    if (state.role !== 'host') return;

    const pc = new RTCPeerConnection(ICE_CONFIG);
    state.peers[viewerId] = pc;

    // Add local tracks to the connection
    state.localStream.getTracks().forEach(track => {
      pc.addTrack(track, state.localStream);
    });

    // Send ICE candidates to this viewer via WS
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        _wsSend({ type: 'live:ice_candidate', sessionId: state.sessionId, to: viewerId, candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        pc.close();
        delete state.peers[viewerId];
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    _wsSend({ type: 'live:offer', sessionId: state.sessionId, to: viewerId, sdp: pc.localDescription });
  }

  async function _handleAnswer(viewerId, sdp) {
    const pc = state.peers[viewerId];
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
  }

  async function _handleHostIce(viewerId, candidate) {
    const pc = state.peers[viewerId];
    if (!pc) return;
    try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (_) {}
  }

  /* ══════════════════════════════════════════════
     WEBRTC — VIEWER SIDE
     Receives offer from host → sends answer
  ══════════════════════════════════════════════ */
  async function _handleOffer(hostId, sdp) {
    if (state.role !== 'viewer') return;

    const pc = new RTCPeerConnection(ICE_CONFIG);
    state.peerConn = pc;

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        _wsSend({ type: 'live:ice_candidate', sessionId: state.sessionId, to: hostId, candidate });
      }
    };

    pc.ontrack = (event) => {
      const videoEl = $('live-video-el');
      if (!videoEl) return;
      if (!state.remoteStream) state.remoteStream = new MediaStream();
      state.remoteStream.addTrack(event.track);
      videoEl.srcObject = state.remoteStream;
      videoEl.play().catch(() => {});
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        // Show reconnect hint
        _showJoinBanner('Connection lost. Try rejoining.');
      }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    _wsSend({ type: 'live:answer', sessionId: state.sessionId, to: hostId, sdp: pc.localDescription });
  }

  async function _handleViewerIce(candidate) {
    if (!state.peerConn) return;
    try { await state.peerConn.addIceCandidate(new RTCIceCandidate(candidate)); } catch (_) {}
  }

  /* ══════════════════════════════════════════════
     WEBSOCKET INTEGRATION
     Attach to the existing WS client in wsClient.js.
     wsClient.js should call Live.handleWsMessage(msg)
     from within its onmessage handler.
  ══════════════════════════════════════════════ */
  function handleWsMessage(msg) {
    // Ensure the overlay HTML is in the DOM so any event can reference it
    if (!document.getElementById('live-setup-modal')) _injectHTML();

    switch (msg.type) {

      /* ── Broadcast notifications ── */
      case 'live:started':
        // Don't show a toast or card for the host's own stream
        if (currentUser && msg.hostId === currentUser.id) break;
        _showLiveToast(msg);
        _addFeedCard(msg);
        break;

      case 'live:ended':
        _removeFeedCard(msg.sessionId);
        if (state.role === 'viewer' && state.sessionId === msg.sessionId) {
          _showEndedScreen();
        }
        break;

      /* ── Viewer count ── */
      case 'live:viewer_joined':
        _updateViewerCount(msg.viewerCount);
        if (state.role === 'host') {
          _handleViewerJoined(msg.viewerId);
          _showJoinBanner(`${msg.viewerName || 'Someone'} joined`);
        }
        break;

      case 'live:viewer_left':
        _updateViewerCount(msg.viewerCount);
        break;

      /* ── Chat ── */
      case 'live:chat_message':
        if (state.sessionId === msg.sessionId) {
          // Avoid duplicating own optimistic message
          if (msg.senderId !== currentUser?.id) {
            _appendChatMessage(msg.senderName, msg.text);
          }
        }
        break;

      /* ── Reactions ── */
      case 'live:reaction':
        if (state.sessionId === msg.sessionId) {
          _floatEmoji(msg.emoji);
        }
        break;

      /* ── WebRTC signaling ── */
      case 'live:offer':
        _handleOffer(msg.from, msg.sdp);
        break;

      case 'live:answer':
        _handleAnswer(msg.from, msg.sdp);
        break;

      case 'live:ice_candidate':
        if (state.role === 'host') {
          _handleHostIce(msg.from, msg.candidate);
        } else {
          _handleViewerIce(msg.candidate);
        }
        break;
    }
  }

  /* ──────────────────────────────────────────── */
  function _wsSend(payload) {
    // Assumes wsClient.js exposes a global `WS` object with a .send() method.
    // Adjust to match your actual wsClient.js API:
    if (window.WS && window.WS.send) {
      window.WS.send(payload);
    } else {
      console.warn('[Live] WS not ready. Could not send:', payload);
    }
  }

  /* ══════════════════════════════════════════════
     FEED CARDS
  ══════════════════════════════════════════════ */
  function _ensureFeedStrip() {
    let strip = document.getElementById('live-feed-strip');
    if (!strip) {
      strip = document.createElement('div');
      strip.id = 'live-feed-strip';
      strip.className = 'live-feed-strip';
      // Insert above the posts feed — matches the actual #feed-list container in index.html
      const feed = document.getElementById('feed-list')
                || document.getElementById('posts-feed')
                || document.querySelector('.feed-col');
      if (feed) feed.prepend(strip);
    }
    return strip;
  }

  function _addFeedCard(session) {
    const strip = _ensureFeedStrip();
    if (document.getElementById(`live-card-${session.sessionId}`)) return;

    const card = document.createElement('div');
    card.id = `live-card-${session.sessionId}`;
    card.className = 'live-feed-card';
    card.onclick = () => Live.watchSession(session.sessionId);
    card.innerHTML = `
      <div class="live-feed-card__thumb">
        <div class="live-feed-card__thumb-placeholder">
          <svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" width="32" height="32"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
        </div>
        <div class="live-feed-card__overlay">
          <span class="live-badge"><span class="live-badge__dot"></span>LIVE</span>
        </div>
        <div class="live-feed-card__viewers">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="10" height="10"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          <span id="live-card-viewers-${session.sessionId}">${session.viewerCount || 0}</span>
        </div>
      </div>
      <div class="live-feed-card__meta">
        <div class="live-feed-card__name">${_esc(session.broadcasterName || '')}</div>
        <div class="live-feed-card__title">${_esc(session.title || 'Live stream')}</div>
      </div>
    `;
    strip.prepend(card);
  }

  function _removeFeedCard(sessionId) {
    const card = document.getElementById(`live-card-${sessionId}`);
    if (card) card.remove();
    // Remove strip if empty
    const strip = document.getElementById('live-feed-strip');
    if (strip && !strip.children.length) strip.remove();
  }

  /* ══════════════════════════════════════════════
     TOASTS + BANNERS
  ══════════════════════════════════════════════ */
  function _showLiveToast(session) {
    let toast = document.getElementById('live-global-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'live-global-toast';
      toast.className = 'live-toast';
      toast.innerHTML = `
        <img class="live-toast__avatar" id="live-toast-avatar" src="" alt="">
        <div class="live-toast__text" id="live-toast-text"></div>
        <span class="live-toast__badge"><span class="live-badge"><span class="live-badge__dot"></span>LIVE</span></span>
      `;
      document.body.appendChild(toast);
    }

    // Update content
    const avatarEl = document.getElementById('live-toast-avatar');
    const textEl   = document.getElementById('live-toast-text');
    if (avatarEl) avatarEl.src = session.broadcasterAvatar || '';
    if (textEl)   textEl.innerHTML = `<strong>${_esc(session.broadcasterName || 'Someone')}</strong> just went live`;

    // Re-bind onclick every time so it always opens the current session,
    // not the one that was live when the toast element was first created (stale closure fix)
    toast.onclick = () => {
      toast.classList.remove('show');
      Live.watchSession(session.sessionId);
    };

    toast.classList.add('show');
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => toast.classList.remove('show'), 5000);
  }

  function _showJoinBanner(text) {
    const existing = document.querySelector('.live-join-banner');
    if (existing) existing.remove();
    const banner = document.createElement('div');
    banner.className = 'live-join-banner';
    banner.textContent = text;
    const overlay = $('live-overlay');
    if (overlay) overlay.appendChild(banner);
    banner.addEventListener('animationend', (e) => {
      if (e.animationName === 'bannerOut') banner.remove();
    });
  }

  function _showEndedScreen() {
    const screen = $('live-ended-screen');
    if (screen) screen.classList.add('show');
  }

  /* ══════════════════════════════════════════════
     LOAD ACTIVE STREAMS ON PAGE LOAD
  ══════════════════════════════════════════════ */
 async function loadActiveSessions() {
  try {
    const res = await api('GET', '/api/live/active');
    const sessions = Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []); // unwrap sendOk envelope
    const strip = _ensureFeedStrip();
    const existingCards = new Set([...strip.querySelectorAll('.live-feed-card')].map(c => c.id));

    // Remove cards that are no longer active
    for (const cardId of existingCards) {
      const sessionId = cardId.replace('live-card-', '');
      if (!sessions.some(s => s.sessionId === sessionId)) {
        const card = document.getElementById(cardId);
        if (card) card.remove();
      }
    }

    // Add new or update existing cards
    sessions.forEach(s => {
      const card = document.getElementById(`live-card-${s.sessionId}`);
      if (card) {
        // update viewer count
        const viewerSpan = card.querySelector(`#live-card-viewers-${s.sessionId}`);
        if (viewerSpan) viewerSpan.textContent = s.viewerCount || 0;
      } else {
        _addFeedCard(s);
      }
    });

    // If strip becomes empty, hide it
    if (!strip.children.length) strip.remove();
  } catch (_) { /* silent */ }
}
  /* ══════════════════════════════════════════════
     HTML INJECTION  (keeps index.html clean)
  ══════════════════════════════════════════════ */
  function _injectHTML() {
    // ── Setup modal ──
    const setupModal = document.createElement('div');
    setupModal.id = 'live-setup-modal';
    setupModal.innerHTML = `
      <div class="live-setup-card">
        <h2>Go Live</h2>
        <p>Share a live moment with your Circle. Your camera and microphone will be used.</p>
        <div class="live-setup-preview">
          <video id="live-setup-preview-video" autoplay muted playsinline></video>
        </div>
        <input
          id="live-title-input"
          class="live-title-input"
          type="text"
          placeholder="What's happening? (e.g. Studio session, Q&A…)"
          maxlength="80"
        />
        <p id="live-setup-status" style="font-size:12px;color:var(--rose);min-height:16px;margin-bottom:10px;"></p>
        <button id="live-go-btn" class="live-go-btn" onclick="Live.startLive()" disabled>
          <svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>
          Go Live
        </button>
        <button class="live-setup-cancel" onclick="Live.closeSetup()">Cancel</button>
      </div>
    `;
    document.body.appendChild(setupModal);

    // ── Full-screen overlay ──
    const overlay = document.createElement('div');
    overlay.id = 'live-overlay';
    overlay.innerHTML = `
      <video id="live-video-el" autoplay playsinline></video>

      <div id="live-reaction-canvas"></div>
      <div class="live-veil-top"></div>
      <div class="live-veil-bottom"></div>

      <!-- Top bar -->
      <div class="live-top-bar">
        <div class="live-top-left">
          <img class="live-broadcaster-avatar" id="live-broadcaster-avatar-el" src="" alt="">
          <div class="live-broadcaster-info">
            <span class="live-broadcaster-name" id="live-broadcaster-name-el"></span>
            <span class="live-stream-title" id="live-stream-title-el"></span>
          </div>
          <span class="live-badge" style="margin-left:4px"><span class="live-badge__dot"></span>LIVE</span>
        </div>
        <div class="live-top-right">
          <div class="live-viewer-count">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="13" height="13"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            <span id="live-viewer-count-num">0</span>
          </div>
          <button class="live-close-btn" onclick="Live.closeLive()" title="Leave stream">
            <svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>

      <!-- Bottom area -->
      <div class="live-bottom-bar">

        <!-- Host-only controls -->
        <div id="live-host-controls" class="live-host-controls" style="display:none;">
          <button id="live-mic-btn" class="live-ctrl-btn" onclick="Live.toggleMic()" title="Mute microphone">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="18" height="18">
              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
              <path d="M19 10v2a7 7 0 01-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </button>
          <button id="live-cam-btn" class="live-ctrl-btn" onclick="Live.toggleCam()" title="Turn camera off">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="18" height="18">
              <path d="M23 7l-7 5 7 5V7z"/>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
          </button>
          <button class="live-end-btn" onclick="Live.closeLive()">End Stream</button>
        </div>

        <!-- Reactions -->
        <div class="live-reactions-row">
          ${REACTIONS.map(e => `<button class="live-reaction-btn" onclick="Live.sendReaction('${e}')">${e}</button>`).join('')}
        </div>

        <!-- Chat -->
        <div id="live-chat-messages" class="live-chat-messages"></div>
        <div class="live-chat-row">
          <input
            id="live-chat-input"
            class="live-chat-input"
            type="text"
            placeholder="Say something…"
            maxlength="200"
            onkeydown="if(event.key==='Enter')Live.sendChat()"
          />
          <button class="live-chat-send-btn" onclick="Live.sendChat()">
            <svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" width="16" height="16"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>

      <!-- Stream ended screen (viewer only) -->
      <div id="live-ended-screen" class="live-ended-screen">
        <div class="live-ended-icon">📴</div>
        <h3>Stream Ended</h3>
        <p>This live stream has ended.</p>
        <button class="live-ended-close" onclick="Live._teardownOverlay()">Close</button>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  /* ══════════════════════════════════════════════
     HELPERS
  ══════════════════════════════════════════════ */
  function _stopLocalStream() {
    if (state.localStream) {
      state.localStream.getTracks().forEach(t => t.stop());
      state.localStream = null;
    }
  }

  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ══════════════════════════════════════════════
     PUBLIC API
  ══════════════════════════════════════════════ */
  return {
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

    // Exposed for the "ended screen" close button
    _teardownOverlay,

    // Exposed so the startup block can inject HTML eagerly
    _injectIfNeeded: () => { if (!document.getElementById('live-setup-modal')) _injectHTML(); },
  };
})();

/* ══════════════════════════════════════════════
   WS INTEGRATION PATCH
   
   In wsClient.js, inside your onmessage handler's
   switch or if-chain, add:

     case 'live:started':
     case 'live:ended':
     case 'live:viewer_joined':
     case 'live:viewer_left':
     case 'live:chat_message':
     case 'live:reaction':
     case 'live:offer':
     case 'live:answer':
     case 'live:ice_candidate':
       if (window.Live) Live.handleWsMessage(msg);
       break;

   That's the only change needed to wsClient.js.
══════════════════════════════════════════════ */

/* Auto-load active sessions once the user is authenticated.
   Also inject the overlay HTML immediately so WS events can reference
   DOM elements before the user has clicked anything. */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    Live._injectIfNeeded();
    Live.loadActiveSessions();
  });
} else {
  Live._injectIfNeeded();
  Live.loadActiveSessions();
}