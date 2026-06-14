// ─────────────────────────────────────────────────────────────
//  settings.js — CircleNet Settings module
//
//  Depends on: api(), currentUser, setCurrentUser(), goTo(),
//              showToast(), resolveMediaUrl(), stringToColor(),
//              defaultAvatar(), PostCache
// ─────────────────────────────────────────────────────────────

/* SETTINGS */

// ── Populate the settings form with the current user's data ───
async function populateSettings() {
  if (!currentUser) {
    goTo("login");
    return;
  }

  // Fetch fresh full profile data before populating
  try {
    const res = await api("GET", `/api/users/${currentUser.id}/profile`);
    if (res.data) {
      currentUser = { ...currentUser, ...res.data };
      localStorage.setItem("circle_user", JSON.stringify(currentUser));
    }
  } catch (_) { /* fall through with cached data */ }

  document.getElementById("settings-name").value       = currentUser.name || "";
  document.getElementById("settings-username").value   = currentUser.username || "";
  document.getElementById("settings-email").value      = currentUser.email || "";
  document.getElementById("settings-bio").value        = currentUser.bio || "";
  document.getElementById("settings-password").value   = "";
  document.getElementById("settings-location").value   = currentUser.location || "";
  document.getElementById("settings-school").value     = currentUser.school || "";
  document.getElementById("settings-occupation").value = currentUser.occupation || "";
  document.getElementById("settings-website").value    = currentUser.website || "";
  document.getElementById("settings-dob").value = currentUser.dateOfBirth
    ? currentUser.dateOfBirth.split("T")[0]
    : "";
  document.getElementById("settings-gender").value = currentUser.gender || "";

  // Phone — stored as "dialCode|digits", e.g. "+254|712345678"
  const phoneRaw   = currentUser.phone || "";
  const phoneParts = phoneRaw.split("|");
  if (phoneParts.length === 2) {
    // Populate dial-code dropdown first if not yet seeded
    const settingsDial = document.getElementById("settings-dial-code");
    if (settingsDial && !settingsDial.options.length) {
      const src = document.getElementById("reg-dial-code");
      if (src) settingsDial.innerHTML = src.innerHTML;
    }
    if (settingsDial) {
      for (const o of settingsDial.options) {
        if (o.value === phoneParts[0]) {
          o.selected = true;
          break;
        }
      }
    }
    document.getElementById("settings-phone").value = phoneParts[1];
  } else {
    document.getElementById("settings-phone").value = phoneRaw;
  }

  const sav = document.getElementById("settings-av");
  if (sav) {
    const pic     = resolveMediaUrl(currentUser.picture) || null;
    const initial = (currentUser.name || "?").charAt(0).toUpperCase();
    const color   = stringToColor(currentUser.name || "");
    if (pic) {
      sav.style.background = "transparent";
      sav.innerHTML = `<img src="${pic}" alt="${initial}" style="width:100%;height:100%;border-radius:inherit;object-fit:cover;display:block" onerror="this.parentElement.innerHTML=defaultAvatar();this.parentElement.style.background='${color}'"/>`;
    } else {
      sav.style.background = color;
      sav.innerHTML = defaultAvatar();
    }
  }

  const p = JSON.parse(localStorage.getItem("circle_notif_prefs") || "{}");
  [
    "likes",
    "comments",
    "reposts",
    "push",
    "new_post",
    "profile_pic",
    "mention",
    "milestone",
  ].forEach((k) => {
    const el = document.getElementById("notif-" + k);
    if (el && p[k] !== undefined) el.checked = p[k];
  });
  ["account", "activity"].forEach((k) => {
    const el = document.getElementById("priv-" + k);
    if (el && p[k] !== undefined) el.checked = p[k];
  });
}

// ── Save profile + preferences ─────────────────────────────────
async function saveProfile() {
  if (!currentUser) return;

  const name       = document.getElementById("settings-name").value.trim();
  const email      = document.getElementById("settings-email").value.trim();
  const bio        = document.getElementById("settings-bio").value.trim();
  const password   = document.getElementById("settings-password").value;
  const username   = document.getElementById("settings-username").value.trim().toLowerCase();
  const dialCode   = document.getElementById("settings-dial-code").value;
  const phoneRaw   = document.getElementById("settings-phone").value.trim().replace(/\D/g, "");
  const phone      = phoneRaw ? `${dialCode}|${phoneRaw}` : null;
  const location   = document.getElementById("settings-location").value.trim() || null;
  const school     = document.getElementById("settings-school").value.trim() || null;
  const occupation = document.getElementById("settings-occupation").value.trim() || null;
  const website    = document.getElementById("settings-website").value.trim() || null;
  const dob        = document.getElementById("settings-dob").value || null;
  const gender     = document.getElementById("settings-gender").value || null;

  if (!name)  { showToast("Name is required.");  return; }
  if (!email) { showToast("Email is required."); return; }

  // Validate username only if changed
  if (username !== (currentUser.username || "")) {
    if (username && !/^[a-z0-9_]{3,25}$/.test(username)) {
      showToast("Username must be 3–25 characters: letters, numbers, underscores only.");
      return;
    }
  }

  // Build patch — only include fields that actually changed.
  // name and email are always sent because the server requires them on PUT.
  const patch = { name, email };
  if (bio !== (currentUser.bio || "")) patch.bio = bio;
  if (password) patch.password = password;
  if (phone !== (currentUser.phone || null)) patch.phone = phone;
  if (location !== (currentUser.location || null)) patch.location = location;
  if (school !== (currentUser.school || null)) patch.school = school;
  if (occupation !== (currentUser.occupation || null)) patch.occupation = occupation;
  if (website !== (currentUser.website || null)) patch.website = website;
  const currentDob = currentUser.dateOfBirth ? currentUser.dateOfBirth.split("T")[0] : null;
  if (dob !== currentDob) patch.dateOfBirth = dob;
  if (gender !== (currentUser.gender || null)) patch.gender = gender;

  // Save notif prefs regardless
  const prefs = {
    likes:       document.getElementById("notif-likes").checked,
    comments:    document.getElementById("notif-comments").checked,
    reposts:     document.getElementById("notif-reposts").checked,
    push:        document.getElementById("notif-push").checked,
    new_post:    document.getElementById("notif-new_post").checked,
    profile_pic: document.getElementById("notif-profile_pic").checked,
    mention:     document.getElementById("notif-mention").checked,
    milestone:   document.getElementById("notif-milestone").checked,
    account:     document.getElementById("priv-account").checked,
    activity:    document.getElementById("priv-activity").checked,
  };
  localStorage.setItem("circle_notif_prefs", JSON.stringify(prefs));

  try {
    // Start from currentUser so no fields are ever lost
    let updatedUser = { ...currentUser };

    if (Object.keys(patch).length > 0) {
      const res = await api("PUT", `/api/users/${currentUser.id}`, patch);
      // Merge: currentUser base → patch → server response (server wins on conflicts)
      updatedUser = {
        ...updatedUser,
        ...patch,
        ...res.data,
        picture: resolveMediaUrl(res.data.picture || currentUser.picture) || null,
      };
    }

    // Save username separately if it changed
    if (username && username !== (currentUser.username || "")) {
      try {
        await api("PUT", `/api/users/${currentUser.id}/username`, { username });
        updatedUser.username = username;
      } catch (e) {
        showToast("Profile saved but username error: " + e.message);
        return;
      }
    }

    localStorage.setItem("circle_user", JSON.stringify(updatedUser));
    setCurrentUser(updatedUser);
    showToast("Profile updated! ✅");

    // Post a profile_update activity to the feed
    try {
      await api("POST", "/api/posts", {
        type: "profile_update",
        text: updatedUser.bio || "",
      });
      PostCache.invalidateFeed("global");
      PostCache.invalidateFeed("following");
    } catch (_) {}

    setTimeout(() => goTo("profile"), 600);
  } catch (e) {
    showToast("Error: " + e.message);
  }
}