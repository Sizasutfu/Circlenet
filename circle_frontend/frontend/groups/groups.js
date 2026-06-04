
// ═══════════════════════════════════════════════════════════
//  GROUPS
// ═══════════════════════════════════════════════════════════

// ── State ────────────────────────────────────────────────
let _groupsPage = 1;
let _groupsHasMore = false;
let _groupsLoading = false;
let _groupsList = []; // cached trending list
let _currentGroup = null; // group object currently open in detail view
let _groupFeedPage = 1;
let _groupFeedHasMore = false;

// ── Group compose state ───────────────────────────────────
let _groupComposePendingImage = null;
let _groupComposePendingVideo = null;
let _groupFeedLoading = false;
let _groupFeedPosts = [];
let _activeGroupTab = "feed";

// ── Gradient palette for placeholder covers ──────────────
const GROUP_GRADIENTS = [
  "linear-gradient(160deg,#16151f 0%,#1e1c2a 100%)", // violet tint
  "linear-gradient(160deg,#131a1e 0%,#192025 100%)", // teal tint
  "linear-gradient(160deg,#1e1518 0%,#251c20 100%)", // rose tint
  "linear-gradient(160deg,#1a1710 0%,#221e14 100%)", // amber tint
  "linear-gradient(160deg,#121620 0%,#181d28 100%)", // blue tint
  "linear-gradient(160deg,#141a18 0%,#1b2220 100%)", // green tint
];

function _groupGradient(topic) {
  // deterministic pick based on topic string
  let h = 0;
  for (let i = 0; i < (topic || "").length; i++)
    h = (h * 31 + topic.charCodeAt(i)) & 0xffff;
  return GROUP_GRADIENTS[h % GROUP_GRADIENTS.length];
}

// ── Cover image / placeholder helper ────────────────────
function _groupCoverHtml(group, height = 72) {
  if (group.coverImage) {
    return `<img src="${escHtml(group.coverImage)}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0"/>`;
  }
  // Default topic icon placeholder
  const grad = _groupGradient(group.topic);
  return `<div class="group-card-cover-placeholder" style="background:${grad}">
          <svg width="${height < 100 ? 24 : 40}" height="${height < 100 ? 24 : 40}" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 00-3-3.87"/>
            <path d="M16 3.13a4 4 0 010 7.75"/>
          </svg>
        </div>`;
}

// ── Format large numbers ─────────────────────────────────
function _fmtNum(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n || 0);
}

// ── Build a single group card for the grid ───────────────
function _buildGroupCard(group) {
  const joined = !!group.isMember;
  const btnLabel = joined ? "✓ Joined" : "Join";
  const btnClass = joined ? "joined" : "join";
  const grad = _groupGradient(group.topic);
  return `
          <div class="group-card" onclick="openGroup(${group.id})">
            <div class="group-card-cover" style="background:${grad};position:relative">
              ${_groupCoverHtml(group, 72)}
            </div>
            <div class="group-card-body">
              <div class="group-card-name">${escHtml(group.displayName || "#" + group.topic)}</div>
              <div class="group-card-desc">${escHtml(group.description || "")}</div>
              <div class="group-card-meta">
                <span>
                  <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                  ${_fmtNum(group.memberCount)}
                </span>
                <span>
                  <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M5.636 5.636a9 9 0 000 12.728M8.464 8.464a5 5 0 000 7.072M12 13a1 1 0 100-2 1 1 0 000 2z"/></svg>
                  ${_fmtNum(group.postCount)}
                </span>
              </div>
              <button
                class="group-card-join-btn ${btnClass}"
                data-group-id="${group.id}"
                onclick="event.stopPropagation(); cardJoinGroup(this, ${group.id})"
              >${btnLabel}</button>
            </div>
          </div>`;
}

// ── My Groups strip ──────────────────────────────────────
async function _loadMyGroups() {
  if (!currentUser) return;
  try {
    const res = await api("GET", "/api/groups/mine");
    const groups = res.data || [];
    const wrap = document.getElementById("my-groups-wrap");
    const strip = document.getElementById("my-groups-strip");
    if (!groups.length) {
      if (wrap) wrap.style.display = "none";
      return;
    }
    if (wrap) wrap.style.display = "block";
    strip.innerHTML = groups
      .map((g) => {
        const grad = _groupGradient(g.topic);
        const iconHtml = g.coverImage
          ? `<img src="${escHtml(g.coverImage)}" alt="" style="width:100%;height:100%;object-fit:cover"/>`
          : `<div style="width:100%;height:100%;background:${grad};display:grid;place-items:center">
                  <svg width="22" height="22" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                </div>`;
        return `<div class="my-group-chip" onclick="openGroup(${g.id})">
              <div class="my-group-chip-icon">${iconHtml}</div>
              <div class="my-group-chip-name">${escHtml(g.displayName || "#" + g.topic)}</div>
            </div>`;
      })
      .join("");
  } catch (_) {
    /* silent */
  }
}

// ── Load trending groups ─────────────────────────────────
async function loadGroups(reset = false) {
  if (_groupsLoading) return;
  if (reset) {
    _groupsPage = 1;
    _groupsHasMore = false;
    _groupsList = [];
  }

  _groupsLoading = true;
  const grid = document.getElementById("groups-grid");
  const lmBtn = document.getElementById("groups-load-more");

  if (_groupsPage === 1) {
    grid.innerHTML = `
            <div class="group-skel-card"><div class="group-skel-cover"></div><div class="group-skel-body"><div class="group-skel-line w-60"></div><div class="group-skel-line w-80"></div><div class="group-skel-btn"></div></div></div>
            <div class="group-skel-card"><div class="group-skel-cover"></div><div class="group-skel-body"><div class="group-skel-line w-60"></div><div class="group-skel-line w-80"></div><div class="group-skel-btn"></div></div></div>
            <div class="group-skel-card"><div class="group-skel-cover"></div><div class="group-skel-body"><div class="group-skel-line w-60"></div><div class="group-skel-line w-80"></div><div class="group-skel-btn"></div></div></div>
            <div class="group-skel-card"><div class="group-skel-cover"></div><div class="group-skel-body"><div class="group-skel-line w-60"></div><div class="group-skel-line w-80"></div><div class="group-skel-btn"></div></div></div>`;
    if (lmBtn) lmBtn.style.display = "none";
    _loadMyGroups();
  }

  try {
    const userId = currentUser ? currentUser.id : null;
    const qs = `?page=${_groupsPage}&limit=12${userId ? "" : ""}`;
    const res = await api("GET", "/api/groups" + qs);
    const { groups, hasMore } = res.data || { groups: [], hasMore: false };

    _groupsList = _groupsPage === 1 ? groups : [..._groupsList, ...groups];
    _groupsHasMore = hasMore;
    _groupsPage++;

    if (_groupsPage === 2) {
      // First load
      if (!groups.length) {
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:32px;color:var(--txt3);font-size:14px">No groups yet — topics need ${30} posts in 7 days to get one.</div>`;
      } else {
        grid.innerHTML = groups.map(_buildGroupCard).join("");
      }
    } else {
      // Append
      const frag = document.createElement("div");
      frag.innerHTML = groups.map(_buildGroupCard).join("");
      while (frag.firstChild) grid.appendChild(frag.firstChild);
    }

    if (lmBtn) lmBtn.style.display = hasMore ? "block" : "none";
  } catch (err) {
    if (_groupsPage === 1) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:32px;color:var(--rose);font-size:14px">Could not load groups.</div>`;
    }
  } finally {
    _groupsLoading = false;
  }
}

function loadMoreGroups() {
  loadGroups();
}

// ── Join / Leave from grid card ──────────────────────────
// ── Group compose functions ───────────────────────────────

function groupComposeInput(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 140) + "px";
  const text = el.value.trim();
  const btn = document.getElementById("group-compose-submit");
  if (btn)
    btn.disabled =
      !text && !_groupComposePendingImage && !_groupComposePendingVideo;
}

function groupComposePickImage(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  _groupComposePendingImage = file;
  _groupComposePendingVideo = null;
  const reader = new FileReader();
  reader.onload = (e) => {
    const preview = document.getElementById("group-compose-media-preview");
    const img = document.getElementById("group-compose-img-preview");
    const vid = document.getElementById("group-compose-vid-preview");
    img.src = e.target.result;
    img.style.display = "";
    vid.style.display = "none";
    vid.src = "";
    preview.classList.add("has-media");
  };
  reader.readAsDataURL(file);
  const btn = document.getElementById("group-compose-submit");
  if (btn) btn.disabled = false;
  // reset so the same file can be re-selected
  event.target.value = "";
}

function groupComposePickVideo(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  _groupComposePendingVideo = file;
  _groupComposePendingImage = null;
  const url = URL.createObjectURL(file);
  const preview = document.getElementById("group-compose-media-preview");
  const img = document.getElementById("group-compose-img-preview");
  const vid = document.getElementById("group-compose-vid-preview");
  img.style.display = "none";
  img.src = "";
  vid.src = url;
  vid.style.display = "";
  preview.classList.add("has-media");
  const btn = document.getElementById("group-compose-submit");
  if (btn) btn.disabled = false;
  event.target.value = "";
}

function groupComposeRemoveMedia() {
  _groupComposePendingImage = null;
  _groupComposePendingVideo = null;
  const preview = document.getElementById("group-compose-media-preview");
  const img = document.getElementById("group-compose-img-preview");
  const vid = document.getElementById("group-compose-vid-preview");
  img.style.display = "none";
  img.src = "";
  vid.style.display = "none";
  vid.src = "";
  preview.classList.remove("has-media");
  const text =
    document.getElementById("group-compose-text")?.value.trim() || "";
  const btn = document.getElementById("group-compose-submit");
  if (btn) btn.disabled = !text;
}

function _groupComposeReset() {
  const ta = document.getElementById("group-compose-text");
  if (ta) {
    ta.value = "";
    ta.style.height = "auto";
  }
  groupComposeRemoveMedia();
}

async function groupComposeSubmit() {
  if (!currentUser || !_currentGroup?.isMember) return;
  const text =
    document.getElementById("group-compose-text")?.value.trim() || "";
  if (!text && !_groupComposePendingImage && !_groupComposePendingVideo) {
    showToast("Write something or add a photo/video!");
    return;
  }
  const btn = document.getElementById("group-compose-submit");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Posting…";
  }

  try {
    const fd = new FormData();
    fd.append("text", text);
    fd.append("groupId", String(_currentGroup.id));
    if (_groupComposePendingImage instanceof File)
      fd.append("image", _groupComposePendingImage);
    if (_groupComposePendingVideo instanceof File)
      fd.append("video", _groupComposePendingVideo);

    const res = await api("POST", "/api/posts", fd);
    const newPost = res.data;
    // groupName/groupTopic come back from the server; ensure they're set
    // so the badge renders correctly on the optimistically-prepended card.
    if (!newPost.groupName && _currentGroup) {
      newPost.groupName = _currentGroup.displayName;
      newPost.groupTopic = _currentGroup.topic;
    }
    PostCache.putPost(newPost);

    // Prepend to the group feed list immediately
    const feedList = document.getElementById("group-detail-feed-list");
    if (feedList) {
      const cardHtml = buildPostCard(newPost, true);
      feedList.insertAdjacentHTML("afterbegin", cardHtml);
      observePostCards(feedList);
    }

    showToast("Posted to group! ✨");
    _groupComposeReset();
  } catch (e) {
    showToast("Error: " + e.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Post";
    }
  }
}

async function cardJoinGroup(btn, groupId) {
  if (!currentUser) {
    showToast("Log in to join groups.");
    goTo("login");
    return;
  }
  const joined = btn.classList.contains("joined");
  const orig = btn.textContent;
  btn.disabled = true;
  btn.textContent = "…";
  try {
    if (joined) {
      await api("DELETE", `/api/groups/${groupId}/join`);
      btn.className = "group-card-join-btn join";
      btn.textContent = "Join";
      // Update local cached group
      const g = _groupsList.find((g) => g.id === groupId);
      if (g) {
        g.isMember = false;
        g.memberCount = Math.max(0, (g.memberCount || 1) - 1);
      }
      if (_currentGroup && _currentGroup.id === groupId) {
        _currentGroup.isMember = false;
        _currentGroup.memberCount = Math.max(
          0,
          (_currentGroup.memberCount || 1) - 1,
        );
        _refreshGroupDetailHeader();
      }
      _loadMyGroups();
      showToast("Left group.");
    } else {
      await api("POST", `/api/groups/${groupId}/join`);
      btn.className = "group-card-join-btn joined";
      btn.textContent = "✓ Joined";
      const g = _groupsList.find((g) => g.id === groupId);
      if (g) {
        g.isMember = true;
        g.memberCount = (g.memberCount || 0) + 1;
      }
      if (_currentGroup && _currentGroup.id === groupId) {
        _currentGroup.isMember = true;
        _currentGroup.memberCount = (_currentGroup.memberCount || 0) + 1;
        _refreshGroupDetailHeader();
        _renderGroupJoinNudge();
      }
      _loadMyGroups();
      showToast("Joined! 🎉");
    }
  } catch (e) {
    btn.textContent = orig;
    showToast("Error: " + e.message);
  } finally {
    btn.disabled = false;
  }
}

// ── Open group detail view ───────────────────────────────
async function openGroup(groupId) {
  // Optimistically navigate immediately
  _currentGroup = null;
  _groupFeedPage = 1;
  _groupFeedHasMore = false;
  _groupFeedPosts = [];
  _activeGroupTab = "feed";
  _groupComposeReset();

  // Reset UI to loading state
  document.getElementById("group-detail-name").textContent = "—";
  document.getElementById("group-detail-desc").textContent = "";
  document.getElementById("group-detail-stats").innerHTML = "";
  document.getElementById("group-detail-banner").innerHTML = "";
  document.getElementById("group-detail-feed-list").innerHTML = currentUser
    ? `<div class="group-skel-card" style="height:120px;margin-bottom:10px"></div>
             <div class="group-skel-card" style="height:120px;margin-bottom:10px"></div>
             <div class="group-skel-card" style="height:120px"></div>`
    : "";
  document.getElementById("group-join-nudge-wrap").innerHTML = "";
  document.getElementById("gdtab-feed").classList.add("active");
  document.getElementById("gdtab-about").classList.remove("active");
  document.getElementById("group-detail-feed-panel").style.display = "block";
  document.getElementById("group-detail-about-panel").style.display = "none";

  const joinBtn = document.getElementById("group-detail-join-btn");
  joinBtn.textContent = "…";
  joinBtn.disabled = true;

  goTo("group-detail", { groupId });

  try {
    const res = await api("GET", `/api/groups/${groupId}`);
    _currentGroup = res.data || res;

    _refreshGroupDetailHeader();
    _renderGroupJoinNudge();
    await _loadGroupFeed(true);
  } catch (e) {
    // Don't navigate away for auth errors on the feed — the feed
    // function handles those itself. Only bail if the group itself 404s.
    if (e.message && e.message.toLowerCase().includes("session expired"))
      return;
    showToast("Could not load group: " + e.message);
    goBack();
  }
}

function _refreshGroupDetailHeader() {
  const g = _currentGroup;
  if (!g) return;

  // ── Update page title with real group name ───────────────
  _setPageTitle((g.displayName || "#" + g.topic) + " · Group");

  // Banner
  const banner = document.getElementById("group-detail-banner");
  const grad = _groupGradient(g.topic);
  banner.style.background = grad;
  banner.innerHTML = _groupCoverHtml(g, 140);

  document.getElementById("group-detail-name").textContent =
    g.displayName || "#" + g.topic;
  document.getElementById("group-detail-desc").textContent =
    g.description || "";
  document.getElementById("group-detail-stats").innerHTML = `
          <span>
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
            ${_fmtNum(g.memberCount)} members
          </span>
          <span>
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M5.636 5.636a9 9 0 000 12.728M8.464 8.464a5 5 0 000 7.072M12 13a1 1 0 100-2 1 1 0 000 2z"/></svg>
            ${_fmtNum(g.postCount)} posts / 7d
          </span>`;

  // About panel
  document.getElementById("group-about-desc").textContent = g.description || "";
  document.getElementById("group-about-stats").innerHTML = `
          <div style="display:flex;gap:10px;font-size:13px;color:var(--txt2)">
            <span style="font-weight:700;color:var(--txt)">${_fmtNum(g.memberCount)}</span> members
          </div>
          <div style="display:flex;gap:10px;font-size:13px;color:var(--txt2)">
            <span style="font-weight:700;color:var(--txt)">${_fmtNum(g.postCount)}</span> posts in last 7 days
          </div>
          <div style="font-size:12px;color:var(--txt3);margin-top:4px">Group topic: <strong style="color:var(--accent)">#${escHtml(g.topic)}</strong></div>`;

  // Join button
  const joinBtn = document.getElementById("group-detail-join-btn");
  joinBtn.disabled = false;
  if (g.isMember) {
    joinBtn.className = "group-join-btn joined";
    joinBtn.textContent = "✓ Joined";
  } else {
    joinBtn.className = "group-join-btn join";
    joinBtn.textContent = "Join";
  }
}

function _renderGroupJoinNudge() {
  const wrap = document.getElementById("group-join-nudge-wrap");
  const composeBox = document.getElementById("group-compose-box");
  if (!wrap || !_currentGroup) return;

  // Show compose box only to members
  if (composeBox) {
    composeBox.style.display =
      currentUser && _currentGroup.isMember ? "" : "none";
    // Seed the avatar with the current user's initial / picture
    if (currentUser && _currentGroup.isMember) {
      const av = document.getElementById("group-compose-av");
      if (av) {
        const color = stringToColor(currentUser.name || "");
        if (currentUser.picture) {
          av.style.background = "transparent";
          av.innerHTML = `<img src="${currentUser.picture}" alt="${escHtml((currentUser.name || "?").charAt(0))}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block"/>`;
        } else {
          av.style.background = color;
          av.textContent = (currentUser.name || "?").charAt(0).toUpperCase();
        }
      }
    }
  }

  if (_currentGroup.isMember || !currentUser) {
    // Non-member logged-out users can read — show a gentle nudge
    if (!currentUser) {
      wrap.innerHTML = `
              <div class="group-join-nudge">
                <div class="group-join-nudge-icon">
                  <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                </div>
                <div class="group-join-nudge-body">
                  <div class="group-join-nudge-title">You're viewing as a guest</div>
                  <div class="group-join-nudge-sub">Log in and join to like, comment, and post in this group.</div>
                  <div style="display:flex;gap:8px">
                    <button class="login-nudge-btn-primary" onclick="goTo('login')">Log in</button>
                    <button class="login-nudge-btn-secondary" onclick="goTo('register')">Sign up</button>
                  </div>
                </div>
              </div>`;
    } else if (!_currentGroup.isMember) {
      wrap.innerHTML = `
              <div class="group-join-nudge">
                <div class="group-join-nudge-icon">
                  <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                </div>
                <div class="group-join-nudge-body">
                  <div class="group-join-nudge-title">Join to engage</div>
                  <div class="group-join-nudge-sub">Members can like, comment, and post in this group.</div>
                  <button class="login-nudge-btn-primary" onclick="toggleGroupMembership()">Join group</button>
                </div>
              </div>`;
    } else {
      wrap.innerHTML = "";
    }
  } else {
    wrap.innerHTML = "";
  }
}

// ── Toggle join/leave from detail view button ────────────
async function toggleGroupMembership() {
  if (!currentUser) {
    showToast("Log in to join groups.");
    goTo("login");
    return;
  }
  if (!_currentGroup) return;
  const joinBtn = document.getElementById("group-detail-join-btn");
  const joined = _currentGroup.isMember;
  joinBtn.disabled = true;
  joinBtn.textContent = "…";
  try {
    const groupId = _currentGroup.id;
    if (joined) {
      await api("DELETE", `/api/groups/${groupId}/join`);
      _currentGroup.isMember = false;
      _currentGroup.memberCount = Math.max(
        0,
        (_currentGroup.memberCount || 1) - 1,
      );
      showToast("Left group.");
    } else {
      await api("POST", `/api/groups/${groupId}/join`);
      _currentGroup.isMember = true;
      _currentGroup.memberCount = (_currentGroup.memberCount || 0) + 1;
      showToast("Joined! 🎉");
    }
    // Sync card in the grid list
    const g = _groupsList.find((g) => g.id === groupId);
    if (g) {
      g.isMember = _currentGroup.isMember;
      g.memberCount = _currentGroup.memberCount;
    }
    _loadMyGroups();
    _refreshGroupDetailHeader();
    _renderGroupJoinNudge();
  } catch (e) {
    showToast("Error: " + e.message);
  } finally {
    joinBtn.disabled = false;
  }
}

// ── Group detail tabs ────────────────────────────────────
function switchGroupTab(tab) {
  _activeGroupTab = tab;
  document
    .getElementById("gdtab-feed")
    .classList.toggle("active", tab === "feed");
  document
    .getElementById("gdtab-about")
    .classList.toggle("active", tab === "about");
  document.getElementById("group-detail-feed-panel").style.display =
    tab === "feed" ? "block" : "none";
  document.getElementById("group-detail-about-panel").style.display =
    tab === "about" ? "block" : "none";
  // Sync URL: add ?tab=about, strip for default (feed)
  const base = window.location.pathname;
  const url = tab === "feed" ? base : `${base}?tab=${tab}`;
  history.replaceState({ ...history.state, groupTab: tab }, "", url);
}

// ── Group feed ───────────────────────────────────────────
async function _loadGroupFeed(reset = false) {
  if (!_currentGroup) return;

  // Feed endpoint requires auth — show a login nudge for guests
  if (!currentUser) {
    const feedList = document.getElementById("group-detail-feed-list");
    feedList.innerHTML = `
            <div class="login-nudge" style="margin-top:8px">
              <div class="login-nudge-icon">
                <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
              </div>
              <div class="login-nudge-body">
                <div class="login-nudge-title">Log in to see this group's feed</div>
                <div class="login-nudge-sub">Members share posts tagged with this topic. Join the conversation!</div>
                <div class="login-nudge-actions">
                  <button class="login-nudge-btn-primary" onclick="goTo('login')">Log in</button>
                  <button class="login-nudge-btn-secondary" onclick="goTo('register')">Sign up</button>
                </div>
              </div>
            </div>`;
    return;
  }

  if (_groupFeedLoading) return;
  if (!reset && !_groupFeedHasMore) return;

  if (reset) {
    _groupFeedPage = 1;
    _groupFeedHasMore = false;
    _groupFeedPosts = [];
  }

  _groupFeedLoading = true;
  const feedList = document.getElementById("group-detail-feed-list");
  const loader = document.getElementById("group-feed-loader");
  if (loader) loader.style.display = reset ? "none" : "block";

  try {
    const res = await api(
      "GET",
      `/api/groups/${_currentGroup.id}/feed?page=${_groupFeedPage}&limit=20`,
    );
    const { posts: newPosts, hasMore } = res.data || {
      posts: [],
      hasMore: false,
    };

    // Merge into PostCache so post cards work (likes, comments, etc.)
    newPosts.forEach((p) => {
      p.likes = Array.isArray(p.likes) ? p.likes : [];
      p.reposts = Array.isArray(p.reposts) ? p.reposts : [];
      p.comments = Array.isArray(p.comments) ? p.comments : [];
      PostCache.putPost(p);
      if (!posts.find((fp) => fp.id === p.id)) posts.unshift(p);
    });

    _groupFeedPosts = reset ? newPosts : [..._groupFeedPosts, ...newPosts];
    _groupFeedHasMore = hasMore;
    _groupFeedPage++;

    if (reset) {
      if (!newPosts.length) {
        feedList.innerHTML = `<div style="text-align:center;padding:40px 16px;color:var(--txt3);font-size:14px">No posts yet in this group.</div>`;
      } else {
        feedList.innerHTML = newPosts
          .map((p) => buildPostCard(p, false))
          .join("");
        // Append load more sentinel
        if (hasMore) _attachGroupFeedSentinel(feedList);
      }
    } else {
      // Append new posts
      const existing = feedList.querySelector(".group-feed-sentinel");
      if (existing) existing.remove();
      newPosts.forEach((p) => {
        const div = document.createElement("div");
        div.innerHTML = buildPostCard(p, false);
        feedList.appendChild(div.firstElementChild);
      });
      if (hasMore) _attachGroupFeedSentinel(feedList);
    }
  } catch (e) {
    if (_groupFeedPage === 1) {
      feedList.innerHTML = `<div style="text-align:center;padding:32px;color:var(--rose);font-size:14px">Could not load feed.</div>`;
    }
  } finally {
    _groupFeedLoading = false;
    if (loader) loader.style.display = "none";
  }
}

function _attachGroupFeedSentinel(feedList) {
  const sentinel = document.createElement("div");
  sentinel.className = "group-feed-sentinel";
  sentinel.style.cssText = "height:40px;margin-top:8px";
  feedList.appendChild(sentinel);
  const obs = new IntersectionObserver(
    (entries) => {
      if (
        entries[0].isIntersecting &&
        _groupFeedHasMore &&
        !_groupFeedLoading
      ) {
        obs.disconnect();
        sentinel.remove();
        _loadGroupFeed(false);
      }
    },
    { rootMargin: "120px" },
  );
  obs.observe(sentinel);
}