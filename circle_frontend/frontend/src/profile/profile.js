// ─────────────────────────────────────────────────────────────
//  profile.js — CircleNet Profile module
//  Depends on: api(), currentUser, posts, PostCache, goTo(),
//              resolveMediaUrl(), resolvePostMedia(), escHtml(),
//              formatTime(), fmtViews(), stringToColor(),
//              buildPostCard(), compressImage(), linkifyHashtags(),
//              toggleSeeMore(), openLightbox(), openVideoLightbox(),
//              openProfilePicLightbox(), openPostDetail(),
//              openOriginalPost(), goToPostDetail(), sharePostLink(),
//              openGroup(), openEditPostModal(), deletePost(),
//              toggleLike(), openRepostAsQuote(), DM,
//              _navStack, _historyNavigating, _updateBackButtons(),
//              _viewToPath(), _setPageTitle(), _followingSet,
//              feedPage, feedHasMore, loadPosts(), loadSuggestions(),
//              populateSettings(), showToast()
// ─────────────────────────────────────────────────────────────

// ── Navigate to the profile view ─────────────────────────────
function viewProfile(userId) {
  document
    .querySelectorAll(".view")
    .forEach((v) => v.classList.remove("active"));
  document.getElementById("view-profile").classList.add("active");
  const contentEl = document.querySelector(".content");
  if (contentEl) contentEl.classList.remove("feed-active");
  document
    .querySelectorAll(".nav-item")
    .forEach((n) => n.classList.remove("active"));
  const sn = document.getElementById("snav-profile");
  if (sn) sn.classList.add("active");
  document
    .querySelectorAll(".mnav-item")
    .forEach((n) => n.classList.remove("active"));
  const mn = document.getElementById("mnav-profile");
  if (mn) mn.classList.add("active");
  window.scrollTo(0, 0);
  if (!_historyNavigating) {
    if (_navStack[_navStack.length - 1] !== "profile") {
      if (_navStack.length >= 20) _navStack.shift();
      _navStack.push("profile");
    }
  }
  _updateBackButtons("profile");
  if (!_historyNavigating) {
    history.pushState(
      { view: "profile", userId: userId || null },
      "",
      _viewToPath("profile", { userId }),
    );
  }
  renderProfile(userId);
}

// ── Profile tab switcher ─────────────────────────────────────
function switchProfileTab(tab) {
  document
    .getElementById("ptab-posts")
    .classList.toggle("active", tab === "posts");
  document
    .getElementById("ptab-about")
    .classList.toggle("active", tab === "about");
  document.getElementById("profile-posts-panel").style.display =
    tab === "posts" ? "block" : "none";
  document.getElementById("profile-about-panel").style.display =
    tab === "about" ? "block" : "none";
  const base = window.location.pathname;
  const url = tab === "posts" ? base : `${base}?tab=${tab}`;
  history.replaceState({ ...history.state, profileTab: tab }, "", url);
}

// ── Render the full profile view ─────────────────────────────
async function renderProfile(viewedUserId = null) {
  if (!currentUser) {
    goTo("login");
    return;
  }
  const targetId =
    viewedUserId !== null && viewedUserId !== undefined
      ? parseInt(viewedUserId, 10)
      : currentUser.id;
  const isOwnProfile = targetId === currentUser.id;
  let profileData = null;
  try {
    const res = await api("GET", `/api/users/${targetId}/profile`);
    profileData = res.data;
  } catch (e) {
    showToast("Couldn't load profile. Showing cached info.");
  }
  const name = profileData?.name || currentUser.name;
  const email = isOwnProfile
    ? (profileData?.email || currentUser.email)
    : (profileData?.email || null);
  const pic = resolveMediaUrl(
    profileData?.picture || (isOwnProfile ? currentUser.picture : null),
  );
  const initial = name.charAt(0).toUpperCase();
  const color = stringToColor(name);

  if (isOwnProfile && profileData) {
    currentUser = { ...currentUser, ...profileData };
    localStorage.setItem("circle_user", JSON.stringify(currentUser));
  }

  _setPageTitle(isOwnProfile ? "Your Profile" : name);

  // ── Banner / cover image ──────────────────────────────────
  const bannerGrad  = document.getElementById("profile-banner-gradient");
  const coverImg    = document.getElementById("profile-cover-img");
  const coverEditBtn = document.getElementById("profile-cover-edit-btn");
  const coverUrl    = resolveMediaUrl(profileData?.coverImage || null);

  if (coverImg) {
    if (coverUrl) {
      coverImg.src = coverUrl;
      coverImg.style.display = "block";
      if (bannerGrad) bannerGrad.style.background = "rgba(0,0,0,0.25)";
    } else {
      coverImg.style.display = "none";
      coverImg.src = "";
      if (bannerGrad) {
        bannerGrad.style.background = `linear-gradient(135deg, ${color}cc 0%, ${color}55 60%, transparent 100%)`;
      }
    }
  } else if (bannerGrad) {
    bannerGrad.style.background = `linear-gradient(135deg, ${color}cc 0%, ${color}55 60%, transparent 100%)`;
  }

  if (coverEditBtn) coverEditBtn.style.display = isOwnProfile ? "flex" : "none";

  // ── Avatar ────────────────────────────────────────────────
  const av = document.getElementById("profile-av");
  if (pic) {
    av.style.background = "transparent";
    av.innerHTML = `<img src="${pic}" alt="${initial}" style="width:100%;height:100%;border-radius:inherit;object-fit:cover;display:block"/>`;
  } else {
    av.innerHTML = initial;
    av.style.background = color;
  }

  const avWrap    = document.getElementById("profile-av-wrap");
  const avOverlay = document.getElementById("profile-av-overlay");
  avWrap.classList.remove("av-view-mode", "av-disabled-mode");
  avWrap.onclick = null;
  if (isOwnProfile) {
    avWrap.title = pic ? "View or change profile picture" : "Add profile picture";
    avOverlay.innerHTML = `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>`;
    const viewBtn = document.getElementById("profile-av-view-btn");
    if (viewBtn) viewBtn.style.display = pic ? "flex" : "none";
    avWrap.dataset.currentPic  = pic || "";
    avWrap.dataset.currentName = name;
    avWrap.onclick = (e) => { e.stopPropagation(); toggleAvatarMenu(); };
  } else if (pic) {
    avWrap.classList.add("av-view-mode");
    avWrap.title = `View ${name}'s photo`;
    avOverlay.innerHTML = `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    avWrap.onclick = () => openProfilePicLightbox(pic, name);
  } else {
    avWrap.classList.add("av-disabled-mode");
    avWrap.title = "";
    avWrap.onclick = null;
  }

  // ── Meta row ──────────────────────────────────────────────
  document.getElementById("profile-name").textContent = name;
  const handleEl = document.getElementById("profile-email");
  handleEl.textContent = isOwnProfile
    ? email
    : profileData?.handle
      ? `@${profileData.handle}`
      : "";
  const bio   = profileData?.bio || (isOwnProfile ? currentUser.bio || "" : "");
  const bioEl = document.getElementById("profile-bio");
  if (bioEl) {
    bioEl.textContent    = bio;
    bioEl.style.display  = bio ? "block" : "none";
  }

  // ── Stats pills ───────────────────────────────────────────
  document.getElementById("stat-posts").textContent     = profileData?.postCount     || 0;
  document.getElementById("stat-followers").textContent = profileData?.followerCount  || 0;
  document.getElementById("stat-following").textContent = profileData?.followingCount || 0;
  const liked = posts.reduce(
    (n, p) => n + (p.likes.includes(currentUser.id) ? 1 : 0),
    0,
  );
  document.getElementById("stat-likes").textContent = liked;

  // ── Action buttons ────────────────────────────────────────
  const actionsEl = document.getElementById("profile-actions");
  if (isOwnProfile) {
    actionsEl.innerHTML = `
      <button class="btn btn-ghost" onclick="goTo('settings')" style="font-size:13px;padding:8px 16px">
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        Edit Profile
      </button>
      <button class="logout-btn-sm" onclick="logout()">
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        Log Out
      </button>`;
  } else {
    const isFollowing = profileData?.isFollowing || false;
    const _dmUser = JSON.stringify({ id: targetId, name, picture: pic || null });
    actionsEl.innerHTML = `
      <button class="btn ${isFollowing ? "btn-outline" : "btn-primary"}" style="font-size:13px;padding:8px 20px" data-following="${isFollowing}" onclick="toggleFollow(${targetId}, this)">${isFollowing ? "Following" : "Follow"}</button>
      <button class="btn btn-ghost" style="font-size:13px;padding:8px 18px;gap:7px" onclick='DM.startConvWithUser(${_dmUser})'>
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="14" height="14"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        Message
      </button>`;
  }

  // ── About panel ───────────────────────────────────────────
  const aboutEl = document.getElementById("profile-about-content");
  if (aboutEl) {
    const src = isOwnProfile
      ? { ...currentUser, ...profileData }
      : profileData || {};
    const esc  = escHtml;
    const rows = [];

    if (bio) {
      rows.push(`
        <div class="about-section-title">Bio</div>
        <p style="font-size:14px;color:var(--txt);line-height:1.6;margin-bottom:4px">${esc(bio)}</p>`);
    }

    const detailRows = [];

    if (src.location) {
      detailRows.push({
        label: "Location",
        value: esc(src.location),
        icon: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
      });
    }
    if (src.school) {
      detailRows.push({
        label: "School",
        value: esc(src.school),
        icon: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`,
      });
    }
    if (src.occupation) {
      detailRows.push({
        label: "Occupation",
        value: esc(src.occupation),
        icon: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>`,
      });
    }
    if (src.website) {
      const href = src.website.startsWith("http")
        ? src.website
        : `https://${src.website}`;
      detailRows.push({
        label: "Website",
        value: `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(src.website)}</a>`,
        icon: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/></svg>`,
      });
    }
    if (src.gender) {
      detailRows.push({
        label: "Gender",
        value: esc(src.gender.charAt(0).toUpperCase() + src.gender.slice(1)),
        icon: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M12 12v8M8 16h8"/></svg>`,
      });
    }
    if (isOwnProfile && src.phone) {
      const phoneParts   = src.phone.split("|");
      const phoneDisplay = phoneParts.length === 2
        ? `${phoneParts[0]} ${phoneParts[1]}`
        : src.phone;
      detailRows.push({
        label: "Phone",
        value: esc(phoneDisplay),
        icon: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013 5.18 2 2 0 015 3h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L9.09 10.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 17z"/></svg>`,
      });
    }
    if (isOwnProfile && src.dateOfBirth) {
      const dob = new Date(src.dateOfBirth);
      const age = Math.floor(
        (Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000),
      );
      const dobDisplay = dob.toLocaleDateString(undefined, {
        day: "numeric", month: "long", year: "numeric",
      });
      detailRows.push({
        label: "Date of Birth",
        value: `${esc(dobDisplay)} (${age} yrs)`,
        icon: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
      });
    }
    const joinDate = src.createdAt
      ? new Date(src.createdAt).toLocaleDateString(undefined, {
          month: "long", year: "numeric",
        })
      : null;
    if (joinDate) {
      detailRows.push({
        label: "Joined",
        value: esc(joinDate),
        icon: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
      });
    }

    if (detailRows.length) {
      rows.push(`<div class="about-section-title">Details</div>`);
      rows.push(
        ...detailRows.map(
          (r) => `
          <div class="about-row">
            <div class="about-row-icon">${r.icon}</div>
            <div class="about-row-body">
              <div class="about-row-label">${r.label}</div>
              <div class="about-row-value">${r.value}</div>
            </div>
          </div>`,
        ),
      );
    }

    const mutuals = profileData?.mutualFollowers;
    if (!isOwnProfile && mutuals && mutuals.length) {
      rows.push(`
        <div class="about-section-title">Connections</div>
        <div class="about-row">
          <div class="about-row-icon">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          </div>
          <div class="about-row-body">
            <div class="about-row-label">Mutual Followers</div>
            <div class="about-row-value">${mutuals.length} mutual follower${mutuals.length !== 1 ? "s" : ""}</div>
          </div>
        </div>`);
    }

    aboutEl.innerHTML = rows.length
      ? rows.join("")
      : `<div class="about-empty">No info added yet.</div>`;
  }

  // ── Profile posts ──────────────────────────────────────────
  switchProfileTab("posts");

  const c = document.getElementById("profile-feed");
  let _profilePage    = 1;
  let _profileHasMore = false;
  let _profileLoading = false;
  let _profileUserId  = targetId;

  async function loadProfilePosts(page, append = false) {
    if (_profileLoading) return;
    _profileLoading = true;

    if (!append) {
      c.innerHTML = `<div style="text-align:center;padding:32px;color:var(--txt2)"><div class="spinner" style="margin:0 auto 12px"></div></div>`;
    } else {
      const skel = document.createElement("div");
      skel.id = "profile-load-skel";
      skel.style.cssText = "text-align:center;padding:20px;color:var(--txt2)";
      skel.innerHTML = `<div class="spinner" style="margin:0 auto"></div>`;
      c.appendChild(skel);
    }

    document.getElementById("profile-load-more-btn")?.remove();

    try {
      const res = await api(
        "GET",
        `/api/posts?userId=${_profileUserId}&page=${page}&limit=20`,
      );
      const userPosts = res.data?.posts || [];
      const hasMore   = res.data?.hasMore ?? userPosts.length === 20;

      userPosts.forEach((p) => {
        if (!Array.isArray(p.likes))    p.likes    = [];
        if (!Array.isArray(p.reposts))  p.reposts  = [];
        if (!Array.isArray(p.comments)) p.comments = [];
        PostCache.putPost(p);
      });

      document.getElementById("profile-load-skel")?.remove();

      if (!append) {
        c.innerHTML = userPosts.length
          ? userPosts.map((p) => buildPostCard(p, isOwnProfile)).join("")
          : `<div class="empty"><div class="empty-icon"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M5.636 5.636a9 9 0 000 12.728M8.464 8.464a5 5 0 000 7.072M12 13a1 1 0 100-2 1 1 0 000 2z"/></svg></div><h3>No posts yet</h3><p>${isOwnProfile ? "Share your first post!" : "Nothing posted yet."}</p></div>`;
      } else {
        const frag = document.createElement("div");
        frag.innerHTML = userPosts.map((p) => buildPostCard(p, isOwnProfile)).join("");
        c.appendChild(frag);
      }

      _profileHasMore = hasMore;

      if (hasMore) {
        const btn = document.createElement("button");
        btn.id        = "profile-load-more-btn";
        btn.className = "btn btn-ghost";
        btn.style.cssText = "width:100%;margin-top:16px;";
        btn.textContent   = "Load more posts";
        btn.onclick = () => {
          _profilePage++;
          loadProfilePosts(_profilePage, true);
        };
        c.appendChild(btn);
      }
    } catch (e) {
      document.getElementById("profile-load-skel")?.remove();
      if (!append) {
        c.innerHTML = `<div class="empty"><h3>Could not load posts</h3><p>${e.message}</p></div>`;
      } else {
        showToast("Could not load more posts: " + e.message);
      }
    } finally {
      _profileLoading = false;
    }
  }

  loadProfilePosts(_profilePage);
}

// ── Profile picture upload ─────────────────────────────────
async function handleProfilePicUpload(event) {
  if (!currentUser) { showToast("Log in first."); return; }
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 100 * 1024 * 1024) { showToast("Image must be under 100 MB."); return; }
  showToast("Uploading…");
  event.target.value = "";
  try {
    let uploadFile = file;
    try {
      uploadFile = await compressImage(file, { maxW: 400, maxH: 400, quality: 0.88 });
    } catch (err) {
      console.warn("[Circle] Profile pic compression failed, using original:", err);
    }
    const fd = new FormData();
    fd.append("image", uploadFile);
    const res = await api("PUT", `/api/users/${currentUser.id}/picture`, fd);
    currentUser.picture = resolveMediaUrl(res.data.picture);
    localStorage.setItem("circle_user", JSON.stringify(currentUser));
    setCurrentUser(currentUser);
    renderProfile();
    populateSettings();
    showToast("Profile photo updated! 📸");
    try {
      await api("POST", "/api/posts", {
        type: "profile_pic",
        text: "",
        image: currentUser.picture,
      });
      PostCache.invalidateFeed("global");
      PostCache.invalidateFeed("following");
    } catch (_) {}
  } catch (e) {
    showToast("Upload failed: " + e.message);
  }
}

// ── Cover image upload ────────────────────────────────────
async function handleCoverImageUpload(event) {
  if (!currentUser) { showToast("Log in first."); return; }
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 100 * 1024 * 1024) { showToast("Image must be under 100 MB."); return; }
  showToast("Uploading cover…");
  event.target.value = "";
  try {
    let uploadFile = file;
    try {
      uploadFile = await compressImage(file, { maxW: 1500, maxH: 500, quality: 0.88 });
    } catch (err) {
      console.warn("[Circle] Cover image compression failed, using original:", err);
    }
    const fd = new FormData();
    fd.append("image", uploadFile);
    const res = await api("PUT", `/api/users/${currentUser.id}/cover`, fd);
    currentUser.coverImage = resolveMediaUrl(res.data.coverImage);
    localStorage.setItem("circle_user", JSON.stringify(currentUser));
    renderProfile();
    showToast("Cover image updated! 🖼️");
  } catch (e) {
    showToast("Upload failed: " + e.message);
  }
}

// ── Avatar action menu (own profile) ─────────────────────
function toggleAvatarMenu() {
  const menu = document.getElementById("profile-av-menu");
  if (!menu) return;
  if (menu.classList.contains("open")) {
    closeAvatarMenu();
  } else {
    const wrap = document.getElementById("profile-av-wrap");
    if (wrap) {
      const r    = wrap.getBoundingClientRect();
      const menuW = 180;
      let left    = r.left + r.width / 2 - menuW / 2;
      left        = Math.max(8, Math.min(left, window.innerWidth - menuW - 8));
      menu.style.top             = r.bottom + 10 + "px";
      menu.style.left            = left + "px";
      menu.style.transformOrigin = "top center";
    }
    menu.classList.add("open");
    setTimeout(() => {
      document.addEventListener("click", closeAvatarMenu, { once: true });
    }, 0);
  }
}

function closeAvatarMenu() {
  const menu = document.getElementById("profile-av-menu");
  if (menu) menu.classList.remove("open");
}

function profileAvViewPhoto() {
  closeAvatarMenu();
  const wrap = document.getElementById("profile-av-wrap");
  const pic  = wrap?.dataset.currentPic;
  const name = wrap?.dataset.currentName || "Your";
  if (pic) openProfilePicLightbox(pic, name);
}

function profileAvChangePhoto() {
  closeAvatarMenu();
  document.getElementById("profile-pic-input").click();
}

// ── Follow / unfollow helpers ─────────────────────────────
function buildSuggestionCard(user) {
  const initial = (user.name || "?").charAt(0).toUpperCase();
  const color   = stringToColor(user.name);
  const avBg    = user.picture ? "transparent" : color;
  const avInner = user.picture
    ? `<img src="${escHtml(user.picture)}" alt="${initial}" loading="lazy" onerror="this.parentElement.style.background=${color};this.parentElement.innerHTML=${initial}"/>`
    : initial;
  return (
    `<div class="sug-card" data-user-id="${user.id}">` +
    `<div class="sug-av" style="background:${avBg}" onclick="viewProfile(${user.id})" title="View profile">${avInner}</div>` +
    `<div class="sug-name" onclick="viewProfile(${user.id})" title="${escHtml(user.name)}">${escHtml(user.name)}</div>` +
    `<div class="sug-score">${user.score} interaction${user.score == 1 ? "" : "s"}</div>` +
    `<button class="sug-follow-btn follow" onclick="event.stopPropagation();sugFollow(${user.id},this)">Follow</button>` +
    `</div>`
  );
}

async function sugFollow(userId, btn) {
  if (!currentUser) {
    showToast("Log in to follow people.");
    goTo("login");
    return;
  }
  const following = btn.classList.contains("unfollow");
  btn.disabled = true;
  try {
    if (following) {
      await api("DELETE", "/api/unfollow/" + userId);
      _followingSet.delete(userId);
      btn.classList.replace("unfollow", "follow");
      btn.textContent = "Follow";
      showToast("Unfollowed.");
    } else {
      await api("POST", "/api/follow/" + userId);
      _followingSet.add(userId);
      btn.classList.replace("follow", "unfollow");
      btn.textContent = "Following";
      showToast("Following! Refreshing feed...");
      setTimeout(() => {
        const card = btn.closest(".sug-card");
        if (card) {
          card.style.cssText += ";transition:opacity .3s,transform .3s;opacity:0;transform:scale(.9)";
          setTimeout(() => {
            card.remove();
            if (!document.querySelectorAll(".sug-card").length)
              loadSuggestions(true);
          }, 300);
        }
      }, 900);
      setTimeout(() => {
        feedPage    = 1;
        feedHasMore = true;
        loadPosts();
      }, 1200);
    }
  } catch (e) {
    showToast("Error: " + e.message);
  } finally {
    btn.disabled = false;
  }
}

async function toggleFollow(targetId, btn) {
  if (!currentUser) {
    showToast("Log in to follow people.");
    goTo("login");
    return;
  }
  const isFollowing = btn.dataset.following === "true";
  const orig        = btn.textContent;
  btn.disabled      = true;
  btn.textContent   = "…";
  try {
    if (isFollowing) {
      await api("DELETE", `/api/unfollow/${targetId}`);
      _followingSet.delete(targetId);
      btn.dataset.following = "false";
      btn.textContent       = "Follow";
      btn.classList.remove("btn-outline", "unfollow");
      btn.classList.add("btn-primary", "follow");
      showToast("Unfollowed.");
    } else {
      await api("POST", `/api/follow/${targetId}`);
      _followingSet.add(targetId);
      btn.dataset.following = "true";
      btn.textContent       = "Following";
      btn.classList.remove("btn-primary", "follow");
      btn.classList.add("btn-outline", "unfollow");
      showToast("Following! 🎉");
    }
    const pv = document.getElementById("view-profile");
    if (pv && pv.classList.contains("active"))
      renderProfile(targetId === currentUser.id ? null : targetId);
  } catch (e) {
    btn.textContent = orig;
    showToast("Error: " + e.message);
  } finally {
    btn.disabled = false;
  }
}