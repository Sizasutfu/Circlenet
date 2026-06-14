// ─────────────────────────────────────────────────────────────
//  suggested-users.js — CircleNet Suggested Users (feed) module
//  Inline "People you may know" card injected into the feed
//
//  Depends on: api(), currentUser, posts, _masterPosts,
//              currentFeedTab, _followingSet,
//              goTo(), showToast(), escHtml(), stringToColor(),
//              viewProfile(), renderFeed()
// ─────────────────────────────────────────────────────────────

/*  SUGGESTED USERS  */
let _suggestionsLoaded = false;
let _feedSugUsers      = [];   // cached suggestion users for inline card
let _feedSugDismissed  = false; // session-only dismiss flag

// ── Build inline feed suggestions card ──────────────────────────
function buildFeedSugCard() {
  if (!_feedSugUsers.length) return "";
  const pills = _feedSugUsers
    .map((user) => {
      const initial = (user.name || "?").charAt(0).toUpperCase();
      const color   = stringToColor(user.name);
      const avBg    = user.picture ? "transparent" : color;
      const avInner = user.picture
        ? `<img src="${escHtml(user.picture)}" alt="${initial}" loading="lazy" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block"/>`
        : initial;
      const score  = user.score || 0;
      const reason =
        score === 0
          ? "New to Circle"
          : score === 1
            ? `<strong>1</strong> interaction`
            : `<strong>${score}</strong> interactions`;
      return `<div class="feed-sug-pill">
            <div class="sug-av" style="background:${avBg}" onclick="viewProfile(${user.id})">${avInner}</div>
            <div class="feed-sug-pill-name" onclick="viewProfile(${user.id})" title="${escHtml(user.name)}">${escHtml(user.name)}</div>
            <div class="feed-sug-reason">${reason}</div>
            <button class="feed-sug-pill-btn" onclick="feedSugFollow(${user.id},this)">Follow</button>
          </div>`;
    })
    .join("");

  return `<div class="feed-sug-card" id="feed-sug-inline">
          <div class="feed-sug-header">
            <span class="feed-sug-title">✨ People you may know</span>
            <span class="feed-sug-dismiss" onclick="dismissFeedSug()">✕ Dismiss</span>
          </div>
          <div class="feed-sug-scroll">${pills}</div>
        </div>`;
}

// ── Dismiss the inline card ───────────────────────────────────
function dismissFeedSug() {
  _feedSugDismissed = true;
  const el = document.getElementById("feed-sug-inline");
  if (el) {
    el.style.cssText +=
      ";transition:opacity .25s,max-height .3s;opacity:0;max-height:0;overflow:hidden;margin:0;padding:0;border:none";
    setTimeout(() => el.remove(), 320);
  }
}

// ── Follow a suggested user from the inline card ──────────────
async function feedSugFollow(userId, btn) {
  if (!currentUser) {
    showToast("Log in to follow.");
    goTo("login");
    return;
  }
  btn.disabled = true;
  try {
    await api("POST", "/api/follow/" + userId);
    btn.textContent = "Following";
    btn.classList.add("following");

    // Remove from inline list after short delay
    const pill = btn.closest(".feed-sug-pill");
    if (pill) {
      pill.style.cssText +=
        ";transition:opacity .3s,transform .3s;opacity:0;transform:scale(.85)";
      setTimeout(() => {
        pill.remove();
        _feedSugUsers = _feedSugUsers.filter((u) => u.id !== userId);
        if (!document.querySelectorAll(".feed-sug-pill").length)
          dismissFeedSug();
      }, 300);
    }

    _followingSet.add(userId);
    showToast("Following!");

    // Re-filter the following tab in memory — no full reload needed
    if (currentFeedTab === "following" && _masterPosts.length > 0) {
      posts = _masterPosts.filter(
        (p) => (currentUser && p.userId === currentUser.id) || _followingSet.has(p.userId),
      );
      renderFeed();
    }
  } catch (e) {
    showToast("Error: " + e.message);
  } finally {
    btn.disabled = false;
  }
}

// ── Load suggestions and inject card into the feed ────────────
async function loadSuggestions(force = false) {
  if (!currentUser) return;
  if (_suggestionsLoaded && !force) return;

  try {
    const res = await api(
      "GET",
      "/api/recommendations?userId=" + currentUser.id + "&limit=10",
    );
    _feedSugUsers      = res.data || [];
    _suggestionsLoaded = true;

    // If feed is already rendered, inject the card now
    if (!_feedSugDismissed && _feedSugUsers.length) {
      const feedList = document.getElementById("feed-list");
      if (feedList && !document.getElementById("feed-sug-inline")) {
        const postCards = feedList.querySelectorAll(".post-card");
        if (postCards.length >= 5) {
          const cardHtml = buildFeedSugCard();
          const temp = document.createElement("div");
          temp.innerHTML = cardHtml;
          const fifthPost = postCards[4];
          fifthPost.insertAdjacentElement("afterend", temp.firstElementChild);
        }
      }
    }
  } catch (e) {
    showToast("Couldn't load suggestions.");
  }
}